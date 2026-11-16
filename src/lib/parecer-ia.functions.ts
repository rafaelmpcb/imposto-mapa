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

/** Converte o JSON Schema (estilo OpenAI) acima para o formato que a API do Gemini aceita em generationConfig.responseSchema. */
function toGeminiSchema(schema: unknown): unknown {
  if (schema === null || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  const s = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof s["type"] === "string") out["type"] = (s["type"] as string).toUpperCase();
  if (s["required"]) out["required"] = s["required"];
  if (s["enum"]) out["enum"] = s["enum"];
  if (s["items"]) out["items"] = toGeminiSchema(s["items"]);
  if (s["properties"]) {
    out["properties"] = Object.fromEntries(
      Object.entries(s["properties"] as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  return out;
}

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

const INSTRUCOES = `Você é um consultor tributário sênior e estrategista de negócios de um escritório de advocacia brasileiro, especialista na Reforma Tributária do consumo (EC 132/2023 e LC 214/2025: CBS, IBS, Imposto Seletivo, transição 2026–2033, split payment, não cumulatividade plena).
Recebe o retrato JSON de um Diagnóstico Completo feito com documentos fiscais reais do cliente, mais as premissas da simulação (folha de pagamento, faturamento, margem). Sua tarefa é INTERPRETAR os números e traduzi-los em impacto no negócio, para o analista preparar uma apresentação direcionada e assertiva.
Postura: você é ESTRATEGISTA, não auditor. É PROIBIDO centrar a análise em apontar documentos faltantes, lacunas de carga ou falhas do cálculo. Trabalhe com o que existe.
Regras:
- Escreva em português do Brasil, linguagem executiva, direta.
- Use SOMENTE os números presentes nos dados; cite valores em R$ e percentuais. Nunca invente números.
- Eixos de análise: valor adicionado e margem de contribuição tributária; ganho ou perda de créditos nas compras; necessidade de repasse de preço (B2B x B2C); efeito do split payment no capital de giro; comparativo de regimes.
- Folha de pagamento não gera crédito de IBS/CBS. Use a folha informada na simulação (premissas.folhaMensal / folhaAnual) para: peso na DRE e no IRPJ/CSLL, relação folha/faturamento e Fator R (≥ 28% permite Anexo III no Simples). Leve isso para o plano de RH e Financeiro.
- Se despesas operacionais não estiverem detalhadas na DRE, analise a geração de caixa operacional com receita, custo, créditos e folha — não diga que "faltam dados".
- Só mencione ausência de dado em, no máximo, uma frase curta e apenas se impedir uma conclusão essencial.
- achados: exatamente 3, os de maior impacto financeiro, no formato impacto → causa → decisão.
- compras, vendas, dre, fluxo, regimes: um parágrafo cada (3 a 6 frases) explicando o que muda, por quê e o que isso significa para o negócio.
- regimes: compare os cenários e indique o caminho mais indicado com justificativa; é insumo para o parecer do advogado.
- plano: uma ação concreta e executável para cada uma das 8 áreas (${AREAS_PLANO.map((a) => `${a.id} = ${a.pergunta}`).join("; ")}). Responsável como cargo, prazo relativo, indicador mensurável. Nada de ações genéricas do tipo "enviar documentos".
- sintese: conclusão estratégica em um parágrafo.`;

export const gerarAnaliseIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; analise: AnaliseIa } | { ok: false; motivo: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("parecer_padrao")
      .select("dados_compilados_json, case_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return { ok: false, motivo: "Parecer não encontrado." };

    const key = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
    if (!key) return { ok: false, motivo: "A IA não está configurada no servidor." };

    const snap = row.dados_compilados_json as unknown as ParecerSnapshot;
    const { data: sim } = await supabaseAdmin
      .from("simulations")
      .select("input")
      .eq("case_id", row.case_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const inp = (sim?.input ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
    const folha = num(inp["payroll"]);
    const fat = num(inp["revenue"]);
    const premissas = {
      folhaMensal: folha != null ? Math.round((folha / 12) * 100) / 100 : null,
      folhaAnual: folha,
      faturamentoMensal: fat,
      relacaoFolhaFaturamentoPct: folha != null && fat ? Math.round((folha / fat) * 1000) / 10 : null,
      margemLucroPct: num(inp["profitMargin"]),
      comprasMensais: num(inp["purchases"]),
      anexoSimples: inp["simplesAnexo"] ?? null,
    };
    const { data: speds } = await supabaseAdmin
      .from("sped_apuracao" as never)
      .select("tipo,periodo_ini,resumo")
      .eq("case_id" as never, row.case_id as never)
      .order("periodo_ini" as never, { ascending: true });
    const escrituracao = ((speds ?? []) as unknown as { tipo: string; periodo_ini: string; resumo: Record<string, unknown> }[]).map(
      (s) => {
        const r = s.resumo as Record<string, any>;
        return s.tipo === "icms_ipi"
          ? { tipo: "EFD ICMS-IPI", mes: s.periodo_ini.slice(0, 7), saidas: r["saidas"], entradas: r["entradas"], icms: r["icms"], ipi: r["ipi"] }
          : { tipo: "EFD Contribuições", mes: s.periodo_ini.slice(0, 7), regime: r["regime"], receitaBruta: r["receitaBruta"], pis: r["pis"], cofins: r["cofins"] };
      },
    );
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCOES }] },
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify({ premissas, escrituracaoSped: escrituracao, diagnostico: resumir(snap) }) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(SCHEMA),
          },
        }),
      },
    );

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      console.error("IA parecer", res.status, corpo.slice(0, 500));
      if (res.status === 429) return { ok: false, motivo: "Cota ou limite de requisições da IA atingido. Tente de novo em alguns instantes." };
      if (res.status === 403) return { ok: false, motivo: "A chave de IA é inválida ou não tem acesso a este modelo." };
      return { ok: false, motivo: "A IA não respondeu. Tente novamente." };
    }

    const corpo = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const candidato = corpo.candidates?.[0];
    if (candidato?.finishReason === "SAFETY" || candidato?.finishReason === "PROHIBITED_CONTENT") {
      return { ok: false, motivo: "A IA recusou gerar esta análise." };
    }
    const texto = candidato?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return { ok: true, analise: JSON.parse(texto) as AnaliseIa };
    } catch {
      return { ok: false, motivo: "A resposta da IA veio incompleta. Tente novamente." };
    }
  });
