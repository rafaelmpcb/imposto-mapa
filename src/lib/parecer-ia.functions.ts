import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AREAS_PLANO, type ParecerSnapshot } from "@/lib/parecer/tipos";

export interface AnaliseIa {
  achados: { titulo: string; impacto: string; causa: string; decisao: string }[];
  compras: string;
  vendas: string;
  dre: string;
  fluxo: string;
  regimes: string;
  plano: {
    area: string;
    acao: string;
    responsavel: string;
    prazo: string;
    prioridade: string;
    indicador: string;
  }[];
  sintese: string;
}

const str = { type: "string" };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["achados", "compras", "vendas", "dre", "fluxo", "regimes", "plano", "sintese"],
  properties: {
    achados: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "impacto", "causa", "decisao"],
        properties: { titulo: str, impacto: str, causa: str, decisao: str },
      },
    },
    compras: str,
    vendas: str,
    dre: str,
    fluxo: str,
    regimes: str,
    plano: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "acao", "responsavel", "prazo", "prioridade", "indicador"],
        properties: {
          area: { type: "string", enum: AREAS_PLANO.map((a) => a.id) },
          acao: str,
          responsavel: str,
          prazo: str,
          prioridade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
          indicador: str,
        },
      },
    },
    sintese: str,
  },
};

/** Remove listas longas (notas, meses) para caber no contexto sem perder os totais. */
function resumir(s: ParecerSnapshot) {
  const corta = <T,>(l: T[] | undefined, n: number) => (l ?? []).slice(0, n);
  return {
    ...s,
    sec4: {
      ...s.sec4,
      fornecedores: corta(s.sec4.fornecedores, 15),
      ncms: corta(s.sec4.ncms, 15),
      detalhes: undefined,
    },
    sec5: { ...s.sec5, clientes: corta(s.sec5.clientes, 10).map((c) => ({ ...c, notas: [], meses: [] })) },
    sec6: { linhas: corta(s.sec6.linhas, 30) },
  };
}

const INSTRUCOES = `Você é um consultor tributário sênior de um escritório de advocacia brasileiro, especialista na Reforma Tributária do consumo (EC 132/2023 e LC 214/2025: CBS, IBS, Imposto Seletivo, transição 2026–2033, split payment, não cumulatividade plena).
Recebe o retrato JSON de um Diagnóstico Completo feito com documentos fiscais reais do cliente. Sua tarefa é interpretar os números para o analista preparar uma apresentação direcionada e assertiva.
Regras:
- Escreva em português do Brasil, linguagem executiva, direta, sem jargão desnecessário.
- Use SOMENTE os números presentes nos dados; cite valores em R$ e percentuais quando existirem. Nunca invente números. Se um bloco estiver vazio, diga que não há dado suficiente.
- achados: exatamente 3, os mais relevantes, no formato impacto → causa → decisão.
- compras, vendas, dre, fluxo, regimes: um parágrafo cada (3 a 6 frases) explicando o que mudou e por quê, de forma que o analista entenda o cálculo.
- regimes: compare os cenários de regime e indique o caminho mais indicado com justificativa; lembre que é insumo para o parecer do advogado.
- plano: uma ação concreta para cada uma das 8 áreas (${AREAS_PLANO.map((a) => `${a.id} = ${a.pergunta}`).join("; ")}). Responsável como cargo (ex.: "Gerente de compras"), prazo relativo (ex.: "30 dias"), indicador mensurável.
- sintese: conclusão estratégica em um parágrafo, respeitando as limitações listadas.`;

export const gerarAnaliseIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; analise: AnaliseIa } | { ok: false; motivo: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("parecer_padrao")
      .select("dados_compilados_json")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return { ok: false, motivo: "Parecer não encontrado." };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, motivo: "A IA não está configurada no servidor." };

    const snap = row.dados_compilados_json as unknown as ParecerSnapshot;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
        instructions: INSTRUCOES,
        input: [{ role: "user", content: JSON.stringify(resumir(snap)) }],
        text: { format: { type: "json_schema", name: "analise_parecer", strict: true, schema: SCHEMA } },
      }),
    });

    if (!res.ok || !res.body) {
      const corpo = await res.text().catch(() => "");
      console.error("IA parecer", res.status, corpo.slice(0, 500));
      if (res.status === 402)
        return { ok: false, motivo: "Créditos de IA esgotados. Adicione créditos em Configurações → Planos e créditos." };
      if (res.status === 429)
        return { ok: false, motivo: "Muitas solicitações à IA agora. Tente de novo em alguns instantes." };
      if (res.status === 403) return { ok: false, motivo: "O uso de IA está bloqueado neste espaço de trabalho." };
      return { ok: false, motivo: "A IA não respondeu. Tente novamente." };
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let texto = "";
    let recusa = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const linha = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!linha.startsWith("data:")) continue;
        const json = linha.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const ev = JSON.parse(json) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) texto += ev.delta;
          if (ev.type === "response.refusal.delta") recusa = true;
          if (ev.type === "response.failed" || ev.type === "error") {
            return { ok: false, motivo: "A IA não conseguiu concluir a análise." };
          }
        } catch {
          /* fragmento parcial */
        }
      }
    }
    if (recusa) return { ok: false, motivo: "A IA recusou gerar esta análise." };
    try {
      return { ok: true, analise: JSON.parse(texto) as AnaliseIa };
    } catch {
      return { ok: false, motivo: "A resposta da IA veio incompleta. Tente novamente." };
    }
  });
