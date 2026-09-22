import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MesFluxo, ParametrosFluxo } from "@/lib/fluxo/projecao";
import { projetarFluxo } from "@/lib/fluxo/projecao";

export const PARAMETROS_FLUXO_PADRAO: ParametrosFluxo = {
  prazoRecebimentoDias: 30,
  prazoPagamentoDias: 30,
  periodicidadeCreditoDias: 30,
};

export interface FluxoPayload {
  meses: MesFluxo[];
  parametros: ParametrosFluxo;
  /** Verdadeiro quando ainda não há nenhum documento apurado para projetar. */
  vazio: boolean;
}

/**
 * Projeção mensal de caixa do Caso, a partir da DRE projetada já gravada.
 * Não altera a apuração líquida nem os painéis de crédito/débito.
 */
export const getFluxoCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; dados: FluxoPayload }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caseId = data.caseId;

    const [dre, param] = await Promise.all([
      supabaseAdmin
        .from("dre_projecao_anual")
        .select("ano,cenario,receita_liquida,custo,despesas_operacionais,deducoes")
        .eq("case_id", caseId)
        .eq("cenario", "projetado"),
      supabaseAdmin
        .from("parametro_fluxo_caixa")
        .select(
          "prazo_medio_recebimento_dias,prazo_medio_pagamento_fornecedores_dias,periodicidade_compensacao_credito_dias",
        )
        .eq("case_id", caseId)
        .maybeSingle(),
    ]);

    const creditos = await supabaseAdmin
      .from("dre_projecao_anual")
      .select("ano,custo")
      .eq("case_id", caseId)
      .eq("cenario", "atual");

    const custoAtualPorAno = new Map<number, number>();
    for (const r of (creditos.data ?? []) as Record<string, unknown>[]) {
      custoAtualPorAno.set(Number(r["ano"]), Number(r["custo"] ?? 0));
    }

    const p = param.data as Record<string, unknown> | null;
    const parametros: ParametrosFluxo = {
      prazoRecebimentoDias: Number(
        p?.["prazo_medio_recebimento_dias"] ?? PARAMETROS_FLUXO_PADRAO.prazoRecebimentoDias,
      ),
      prazoPagamentoDias: Number(
        p?.["prazo_medio_pagamento_fornecedores_dias"] ??
          PARAMETROS_FLUXO_PADRAO.prazoPagamentoDias,
      ),
      periodicidadeCreditoDias: Number(
        p?.["periodicidade_compensacao_credito_dias"] ??
          PARAMETROS_FLUXO_PADRAO.periodicidadeCreditoDias,
      ),
    };

    const anos = ((dre.data ?? []) as Record<string, unknown>[])
      .map((r) => {
        const ano = Number(r["ano"]);
        const custoProjetado = Number(r["custo"] ?? 0);
        const custoAtual = custoAtualPorAno.get(ano) ?? custoProjetado;
        return {
          ano,
          // Entradas de clientes: receita já líquida do IBS/CBS retido na origem.
          entradasAno: Number(r["receita_liquida"] ?? 0),
          saidasFornecedoresAno: custoAtual,
          despesasAno: Number(r["despesas_operacionais"] ?? 0),
          debitoAno: Number(r["deducoes"] ?? 0),
          // Crédito do ano = quanto o custo projetado ficou abaixo do custo cheio.
          creditoAno: Math.max(0, custoAtual - custoProjetado),
        };
      })
      .sort((a, b) => a.ano - b.ano);

    const meses = projetarFluxo(anos, parametros);

    if (meses.length > 0) {
      const agora = new Date().toISOString();
      await supabaseAdmin.from("fluxo_caixa_projecao_mensal").upsert(
        meses.map((m) => ({
          case_id: caseId,
          ano: m.ano,
          mes: m.mes,
          entradas_clientes: m.entradasClientes,
          saidas_fornecedores: m.saidasFornecedores,
          saidas_despesas: m.saidasDespesas,
          debito_ibscbs_retido: m.debitoIbsCbsRetido,
          credito_ibscbs_disponivel: m.creditoIbsCbsDisponivel,
          debito_liquido_recolhido: m.debitoLiquidoRecolhido,
          saldo_credor_acumulado: m.saldoCredorAcumulado,
          variacao_caixa: m.variacaoCaixa,
          calculado_em: agora,
        })) as never,
        { onConflict: "case_id,ano,mes" },
      );
    }

    return {
      ok: true as const,
      dados: {
        meses,
        parametros,
        vazio: anos.every(
          (a) => a.entradasAno === 0 && a.saidasFornecedoresAno === 0 && a.debitoAno === 0,
        ),
      },
    };
  });

/** Salva os prazos estimados usados na projeção de caixa do Caso. */
export const salvarParametrosFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; parametros: ParametrosFluxo }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.from("parametro_fluxo_caixa").upsert(
      {
        case_id: data.caseId,
        prazo_medio_recebimento_dias: data.parametros.prazoRecebimentoDias,
        prazo_medio_pagamento_fornecedores_dias: data.parametros.prazoPagamentoDias,
        periodicidade_compensacao_credito_dias: data.parametros.periodicidadeCreditoDias,
        atualizado_em: new Date().toISOString(),
      } as never,
      { onConflict: "case_id" },
    );
    if (up.error) throw new Error(up.error.message);
    return { ok: true as const };
  });
