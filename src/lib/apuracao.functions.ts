import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ANO_APURACAO,
  apurarLiquido,
  debitoEstimadoMercadorias,
  type ApuracaoLiquida,
  type ItemApurado,
} from "@/lib/apuracao/liquido";

/**
 * Consolida, por Caso, o valor líquido de IBS/CBS a recolher no cenário pós-reforma:
 * débitos de serviços prestados e mercadorias vendidas menos créditos de serviços
 * tomados e mercadorias adquiridas. Itens na fila de revisão ficam fora das somas.
 */
export const getApuracaoLiquida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; apuracao: ApuracaoLiquida }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caseId = data.caseId;

    const [compras, servicosTomados, servicosPrestados, vendas] = await Promise.all([
      supabaseAdmin
        .from("nota_fiscal_compra_xml_item")
        .select("valor_item,valor_credito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId),
      supabaseAdmin
        .from("nota_servico_nfse_item")
        .select("valor_servico,valor_credito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId),
      supabaseAdmin
        .from("nota_servico_nfse_item_prestado" as "nota_servico_nfse_item")
        .select("valor_servico,valor_debito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId),
      supabaseAdmin
        .from("nota_fiscal_venda_xml")
        .select("valor_total,status_processamento")
        .eq("case_id", caseId),
    ]);

    const asRows = (r: { data: unknown }) => (r.data ?? []) as Record<string, unknown>[];

    const creditoMercadorias: ItemApurado[] = asRows(compras).map((i) => ({
      valorBase: Number(i["valor_item"] ?? 0),
      valorTributo: Number(i["valor_credito_ibs_cbs"] ?? 0),
      status: String(i["status_classificacao"] ?? "sem_dado"),
    }));

    const creditoServicos: ItemApurado[] = asRows(servicosTomados).map((i) => ({
      valorBase: Number(i["valor_servico"] ?? 0),
      valorTributo: Number(i["valor_credito_ibs_cbs"] ?? 0),
      status: String(i["status_classificacao"] ?? "sem_dado"),
    }));

    const debitoServicos: ItemApurado[] = asRows(servicosPrestados).map((i) => ({
      valorBase: Number(i["valor_servico"] ?? 0),
      valorTributo: Number(i["valor_debito_ibs_cbs"] ?? 0),
      status: String(i["status_classificacao"] ?? "sem_dado"),
    }));

    // Mercadorias vendidas: o XML de venda é lido só no cabeçalho, então o débito
    // entra por estimativa (alíquota nominal do ano sobre o valor total da nota).
    const debitoMercadorias: ItemApurado[] = asRows(vendas)
      .filter((n) => String(n["status_processamento"] ?? "ok") === "ok")
      .map((n) => {
        const valor = Number(n["valor_total"] ?? 0);
        return {
          valorBase: valor,
          valorTributo: debitoEstimadoMercadorias(valor),
          status: "ok",
        };
      });

    return {
      ok: true as const,
      apuracao: apurarLiquido({
        ano: ANO_APURACAO,
        debitoServicos,
        debitoMercadorias,
        creditoServicos,
        creditoMercadorias,
        mercadoriasEstimadas: true,
      }),
    };
  });
