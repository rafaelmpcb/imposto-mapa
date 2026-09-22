import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Percentual a partir do qual uma única contraparte é sinalizada como concentração crítica. */
export const LIMITE_CONCENTRACAO_CRITICA = 60;

export type ConcentracaoLinha = {
  codigo: string;
  /** CFOP da linha (só mercadorias; serviços não têm CFOP). */
  cfop: string | null;
  cnpj: string | null;
  nome: string | null;
  valorBase: number;
  valorApurado: number;
  itens: number;
  pendentes: number;
};

export type ConcentracaoDataset = {
  linhas: ConcentracaoLinha[];
  total: number;
  /** Notas de venda de mercadoria ainda sem itens processados (débito estimado no cabeçalho). */
  notasVendaSemItens: number;
  valorNotasVendaSemItens: number;
};

export type ConcentracaoPayload = {
  compras: ConcentracaoDataset;
  vendas: ConcentracaoDataset;
  servicosTomados: ConcentracaoDataset;
  servicosPrestados: ConcentracaoDataset;
};

const asRows = (r: { data: unknown }) => (r.data ?? []) as Record<string, unknown>[];

const toLinhas = (rows: Record<string, unknown>[]): ConcentracaoLinha[] =>
  rows.map((r) => ({
    codigo: String(r["codigo"] ?? "—"),
    cfop: (r["cfop"] as string | null) ?? null,
    cnpj: (r["cnpj_contraparte"] as string | null) ?? null,
    nome: (r["nome_contraparte"] as string | null) ?? null,
    valorBase: Number(r["valor_base_total"] ?? 0),
    valorApurado: Number(r["valor_apurado_total"] ?? 0),
    itens: Number(r["n_itens"] ?? 0),
    pendentes: Number(r["n_itens_pendentes"] ?? 0),
  }));

const dataset = (
  linhas: ConcentracaoLinha[],
  extra?: { notasVendaSemItens: number; valorNotasVendaSemItens: number },
): ConcentracaoDataset => ({
  linhas,
  total: linhas.reduce((acc, l) => acc + l.valorApurado, 0),
  notasVendaSemItens: extra?.notasVendaSemItens ?? 0,
  valorNotasVendaSemItens: extra?.valorNotasVendaSemItens ?? 0,
});

/**
 * Lê as views de agregação e devolve, por direção, as linhas
 * (código x contraparte) já somadas no banco. Não recalcula apuração.
 */
export const getConcentracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; dados: ConcentracaoPayload }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caseId = data.caseId;
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: unknown }> & {
            eq: (col: string, val: string) => Promise<{ data: unknown }>;
          };
        };
      };
    };

    const cols = "codigo,cnpj_contraparte,nome_contraparte,valor_base_total,valor_apurado_total,n_itens,n_itens_pendentes";
    const colsMercadoria = `${cols},cfop`;

    const [compras, vendas, tomados, prestados, notasVenda, itensVenda] = await Promise.all([
      db.from("vw_concentracao_compras_ncm").select(colsMercadoria).eq("case_id", caseId),
      db.from("vw_concentracao_vendas_ncm").select(colsMercadoria).eq("case_id", caseId),
      db
        .from("vw_concentracao_servicos_nbs")
        .select(cols)
        .eq("case_id", caseId)
        .eq("direcao", "tomado"),
      db
        .from("vw_concentracao_servicos_nbs")
        .select(cols)
        .eq("case_id", caseId)
        .eq("direcao", "prestado"),
      db.from("nota_fiscal_venda_xml").select("id,valor_total,status_processamento").eq("case_id", caseId),
      db.from("nota_fiscal_venda_xml_item").select("nota_fiscal_venda_xml_id").eq("case_id", caseId),
    ]);

    const comItens = new Set(
      asRows(itensVenda).map((i) => String(i["nota_fiscal_venda_xml_id"] ?? "")),
    );
    let notasSemItens = 0;
    let valorSemItens = 0;
    for (const n of asRows(notasVenda)) {
      if (String(n["status_processamento"] ?? "ok") !== "ok") continue;
      if (comItens.has(String(n["id"] ?? ""))) continue;
      notasSemItens += 1;
      valorSemItens += Number(n["valor_total"] ?? 0);
    }

    return {
      ok: true,
      dados: {
        compras: dataset(toLinhas(asRows(compras))),
        vendas: dataset(toLinhas(asRows(vendas)), {
          notasVendaSemItens: notasSemItens,
          valorNotasVendaSemItens: valorSemItens,
        }),
        servicosTomados: dataset(toLinhas(asRows(tomados))),
        servicosPrestados: dataset(toLinhas(asRows(prestados))),
      },
    };
  });
