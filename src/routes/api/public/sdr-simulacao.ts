import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

import { isValidCnpj, onlyDigits } from "@/lib/cnpj/types";
import { slugifyWords } from "@/lib/text";
import {
  defaultInput,
  inferSimplesAnexo,
  simulate,
  type SimulationInput,
  type TaxpayerType,
} from "@/lib/tax/calc";
import { UFS } from "@/lib/tax/constants";

/**
 * Calculadora pública para o SDR (agente de WhatsApp): recebe os dados
 * básicos de um lead, roda o motor de cálculo existente e devolve o link
 * do dashboard (/s/:token) já salvo — sem criar caso nem aparecer em
 * "Meus Cálculos" (case_id fica null de propósito).
 */

const REGIMES = ["simples", "presumido", "real", "mei", "pf"] as const;
const ATIVIDADES = [
  "advocacia",
  "contabilidade",
  "engenharia",
  "saude",
  "educacao",
  "cultura",
  "agro",
  "varejo",
  "industria",
  "tecnologia",
  "servicos_gerais",
] as const;
const UF_ENUM = UFS as unknown as [string, ...string[]];
const MAX_BODY_BYTES = 10 * 1024;
const ANO_SIMULACAO = 2033;

const schema = z.object({
  razao_social: z.string().trim().min(1).max(200),
  cnpj: z.string().trim().max(30).optional(),
  regime: z.enum(REGIMES),
  atividade: z.enum(ATIVIDADES).optional(),
  uf: z.enum(UF_ENUM),
  faturamento_mensal: z.number().finite().positive(),
  folha_mensal: z.number().finite().min(0).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function erro400(detalhes: string, valoresAceitos: Record<string, readonly string[]> = {}): Response {
  return json({ sucesso: false, erro: "dados inválidos", detalhes, valores_aceitos: valoresAceitos }, 400);
}

function chaveValida(fornecida: string, esperada: string): boolean {
  const a = Buffer.from(fornecida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

function arredonda(valor: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

export const Route = createFileRoute("/api/public/sdr-simulacao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const inicio = Date.now();

        const chaveEsperada = process.env["SDR_API_KEY"];
        const chaveRecebida = request.headers.get("x-api-key") ?? "";
        if (!chaveEsperada || !chaveRecebida || !chaveValida(chaveRecebida, chaveEsperada)) {
          return json({ sucesso: false, erro: "chave inválida" }, 401);
        }

        const texto = await request.text();
        if (texto.length > MAX_BODY_BYTES) {
          return erro400("corpo da requisição maior que 10 KB");
        }

        let corpo: unknown;
        try {
          corpo = texto ? JSON.parse(texto) : {};
        } catch {
          return erro400("JSON inválido");
        }

        const parsed = schema.safeParse(corpo);
        if (!parsed.success) {
          const detalhes = parsed.error.issues
            .map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`)
            .join("; ");
          return erro400(detalhes, {
            regime: REGIMES,
            atividade: ATIVIDADES,
            uf: UFS,
          });
        }
        const d = parsed.data;

        let cnpjDigits: string | null = null;
        if (d.cnpj) {
          cnpjDigits = onlyDigits(d.cnpj);
          if (!isValidCnpj(cnpjDigits)) {
            return erro400("cnpj com dígitos verificadores inválidos", { cnpj: ["14 dígitos, com DV válido"] });
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Limite de ~30 chamadas/min nesta rota, por minuto corrido (UTC).
        // `as never` necessário até a migração de `increment_rate_limit` rodar
        // e os tipos do Supabase serem regerados (a função ainda não existe
        // nos tipos gerados até essa migração ser aplicada no banco).
        const bucket = `sdr-simulacao:${Math.floor(Date.now() / 60000)}`;
        const { data: contagem, error: erroLimite } = await supabaseAdmin.rpc(
          "increment_rate_limit" as never,
          { p_bucket: bucket } as never,
        );
        if (!erroLimite && typeof contagem === "number" && contagem > 30) {
          return json({ sucesso: false, erro: "limite de chamadas" }, 429);
        }

        const atividade = d.atividade ?? "servicos_gerais";
        const taxpayerType = d.regime as TaxpayerType;
        const input: SimulationInput = {
          ...defaultInput(),
          taxpayerType,
          activityId: atividade,
          uf: d.uf,
          revenue: taxpayerType === "pf" ? 0 : d.faturamento_mensal,
          salary: taxpayerType === "pf" ? d.faturamento_mensal : 0,
          payroll: d.folha_mensal ?? 0,
          simplesAnexo: inferSimplesAnexo(atividade),
        };

        let resultado: ReturnType<typeof simulate>;
        try {
          resultado = simulate(input, ANO_SIMULACAO);
        } catch (e) {
          console.error("[sdr-simulacao] falha no cálculo", { ms: Date.now() - inicio });
          return json(
            { sucesso: false, erro: "falha ao calcular", detalhes: e instanceof Error ? e.message : "" },
            500,
          );
        }

        const slug = slugifyWords(d.razao_social, 40) || "lead";
        const sufixo = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
        const token = `${slug}-${sufixo}`;

        const { data: inserida, error: erroInsert } = await supabaseAdmin
          .from("simulations")
          .insert({
            client_name: d.razao_social,
            taxpayer_type: input.taxpayerType,
            activity_id: input.activityId,
            uf: input.uf,
            base_amount: resultado.base,
            year_id: ANO_SIMULACAO,
            current_total: resultado.current.total,
            reform_total: resultado.reform.total,
            current_rate: resultado.current.rate,
            reform_rate: resultado.reform.rate,
            input,
            cnpj: cnpjDigits,
            cnpj_data: null,
            case_id: null,
            share_enabled: true,
            share_token: token,
          } as never)
          .select("id")
          .single();
        if (erroInsert) {
          console.error("[sdr-simulacao] falha ao salvar", { ms: Date.now() - inicio });
          return json({ sucesso: false, erro: "falha ao salvar a simulação" }, 500);
        }

        const diff = resultado.reform.total - resultado.current.total;
        const variacaoPercentual =
          resultado.current.total === 0 ? null : arredonda((diff / resultado.current.total) * 100, 1);

        console.log("[sdr-simulacao] ok", { id: inserida.id, ms: Date.now() - inicio });

        return json({
          sucesso: true,
          web_url: `https://rcbinteligenciatributaria.com.br/s/${token}`,
          pdf_url: null,
          case_id: null,
          aviso: "Estimativa com base nos dados informados; não substitui o diagnóstico completo.",
          resumo: {
            carga_atual_reais: arredonda(resultado.current.total, 2),
            carga_reforma_reais: arredonda(resultado.reform.total, 2),
            variacao_reais: arredonda(diff, 2),
            variacao_percentual: variacaoPercentual,
            periodo: "mensal",
            cenario_reforma: "regime pleno (2033)",
            aliquota_efetiva_atual_percentual: arredonda(resultado.current.rate * 100, 1),
            aliquota_efetiva_reforma_percentual: arredonda(resultado.reform.rate * 100, 1),
          },
        });
      },
    },
  },
});
