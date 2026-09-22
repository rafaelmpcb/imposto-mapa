/**
 * Ficha executiva de negociação comercial.
 * Recebe o retrato já compilado de uma contraparte (fornecedor ou cliente)
 * e produz um argumentário tático. Não recalcula nada: apenas interpreta.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Entrada = z.object({
  relacao: z.enum(["fornecedor", "cliente"]),
  nome: z.string().nullable(),
  cnpj: z.string().nullable(),
  regime: z.string().nullable(),
  valorBase: z.number(),
  credito: z.number(),
  participacaoPct: z.number(),
  notas: z.number(),
  itens: z.number(),
  pendentes: z.number(),
  meses: z.number(),
  topCodigos: z
    .array(z.object({ codigo: z.string(), descricao: z.string().nullable(), valorBase: z.number() }))
    .max(10),
  objetivo: z.string().max(400).nullable(),
  observacoes: z.string().max(2000).nullable(),
});

export type EntradaFichaNegociacao = z.infer<typeof Entrada>;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const regimeLabel = (r: string | null) =>
  r === "simples" ? "Simples Nacional" : r === "regular" ? "Regime Normal" : "não classificado";

export const gerarFichaNegociacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Entrada.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Serviço de IA indisponível: chave não configurada.");

    const fornecedor = data.relacao === "fornecedor";
    const efetiva = data.valorBase > 0 ? (data.credito / data.valorBase) * 100 : 0;

    const contexto = [
      `Tipo de contraparte: ${fornecedor ? "FORNECEDOR (compras da empresa)" : "CLIENTE/TOMADOR (vendas da empresa)"}`,
      `Razão social: ${data.nome ?? "não informada"}`,
      `CNPJ: ${data.cnpj ?? "não informado"}`,
      `Regime tributário da contraparte: ${regimeLabel(data.regime)}`,
      `Volume no período analisado: ${brl(data.valorBase)}`,
      `Participação na carteira: ${data.participacaoPct.toFixed(2)}%`,
      fornecedor
        ? `Crédito de IBS/CBS apurado nessas compras: ${brl(data.credito)} (${efetiva.toFixed(2)}% da base)`
        : `Crédito de IBS/CBS destacado e transferido a essa contraparte: ${brl(data.credito)} (${efetiva.toFixed(2)}% da base)`,
      `Notas fiscais: ${data.notas} · itens classificados: ${data.itens} · itens pendentes de revisão: ${data.pendentes}`,
      `Meses com movimento: ${data.meses}`,
      data.topCodigos.length
        ? `Principais itens (NCM/NBS): ${data.topCodigos
            .map((c) => `${c.codigo}${c.descricao ? ` - ${c.descricao}` : ""} (${brl(c.valorBase)})`)
            .join("; ")}`
        : "Principais itens: não disponíveis",
      data.objetivo ? `Objetivo da negociação: ${data.objetivo}` : "",
      data.observacoes ? `Observações do advogado: ${data.observacoes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system = [
      "Você é advogado tributarista sênior brasileiro, especialista na Reforma Tributária (IBS/CBS, LC 214/2025) e em negociação contratual.",
      "Produza uma FICHA EXECUTIVA DE NEGOCIAÇÃO em português do Brasil, objetiva, em markdown, pronta para ser levada a uma reunião.",
      "Use exclusivamente os números fornecidos. Nunca invente valores, alíquotas ou fatos; quando faltar dado, diga explicitamente que o dado não está disponível.",
      "Estruture exatamente nestas seções:",
      "## 1. Diagnóstico da relação",
      "## 2. Argumentos centrais (numerados, cada um com o número que o sustenta)",
      "## 3. Efeito líquido real (custo depois do aproveitamento de crédito)",
      "## 4. Cláusula contratual sugerida (minuta pronta para copiar)",
      "## 5. Respostas a objeções (tabela: objeção | resposta)",
      "## 6. Limites e cautelas",
      "Regras de conteúdo: contraparte no Simples Nacional normalmente não transfere crédito integral de IBS/CBS; considere a transição gradual 2026-2033; trate os valores como estimativas de diagnóstico, não como apuração fiscal definitiva.",
      "Tom: técnico, direto, sem floreio. Máximo aproximado de 900 palavras.",
    ].join("\n");

    const runIdFetch = createLovableRunId();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system,
        prompt: contexto,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const texto = await result.text;
      if (!texto.trim()) {
        throw new Error("O modelo não retornou conteúdo. Tente novamente.");
      }
      return { ficha: texto };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("402")) {
        throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace para continuar.");
      }
      if (msg.includes("429")) {
        throw new Error("Muitas solicitações em sequência. Aguarde alguns instantes e tente de novo.");
      }
      throw new Error(`Não foi possível gerar a ficha: ${msg}`);
    }
  });

function createLovableRunId() {
  // import dinâmico evitaria o bundle do cliente, mas o helper é puro e leve
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return createRunIdFetch();
}

import { createLovableAiGatewayRunIdFetch as createRunIdFetch } from "@/lib/ai-gateway.server";
