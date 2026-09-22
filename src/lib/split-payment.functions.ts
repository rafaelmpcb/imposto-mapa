import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SplitPaymentPeriodo {
  ano: number;
  mes: number;
  vendasBrutas: number;
  debitoRetido: number;
  creditoDisponivel: number;
  debitoLiquidoRecolhido: number;
  resultadoLiquidoAno: number | null;
}

export interface SplitPaymentPayload {
  periodos: SplitPaymentPeriodo[];
  rateioReceitaUniforme: boolean;
}

/**
 * Leitura gerencial do split payment sobre valores já persistidos pelos
 * Pilares 3 e 4. Não recalcula débito, crédito, DRE ou fluxo de caixa.
 */
export const getSplitPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true; dados: SplitPaymentPayload }> => {
    const [fluxo, dre] = await Promise.all([
      context.supabase
        .from("fluxo_caixa_projecao_mensal")
        .select(
          "ano,mes,debito_ibscbs_retido,credito_ibscbs_disponivel,debito_liquido_recolhido",
        )
        .eq("case_id", data.caseId)
        .order("ano", { ascending: true })
        .order("mes", { ascending: true }),
      context.supabase
        .from("dre_projecao_anual")
        .select("ano,receita_bruta,resultado_liquido")
        .eq("case_id", data.caseId)
        .eq("cenario", "projetado")
        .order("ano", { ascending: true }),
    ]);

    if (fluxo.error) throw new Error(fluxo.error.message);
    if (dre.error) throw new Error(dre.error.message);

    const drePorAno = new Map(
      (dre.data ?? []).map((linha) => [
        Number(linha.ano),
        {
          receitaBruta: Number(linha.receita_bruta ?? 0),
          resultadoLiquido: linha.resultado_liquido == null ? null : Number(linha.resultado_liquido),
        },
      ]),
    );

    const periodos = (fluxo.data ?? []).map((linha) => {
      const ano = Number(linha.ano);
      const dreAno = drePorAno.get(ano);
      return {
        ano,
        mes: Number(linha.mes),
        // O fluxo mensal já usa distribuição anual uniforme, sem sazonalidade.
        vendasBrutas: Math.round(((dreAno?.receitaBruta ?? 0) / 12) * 100) / 100,
        debitoRetido: Number(linha.debito_ibscbs_retido ?? 0),
        creditoDisponivel: Number(linha.credito_ibscbs_disponivel ?? 0),
        debitoLiquidoRecolhido: Number(linha.debito_liquido_recolhido ?? 0),
        resultadoLiquidoAno: dreAno?.resultadoLiquido ?? null,
      } satisfies SplitPaymentPeriodo;
    });

    return {
      ok: true as const,
      dados: { periodos, rateioReceitaUniforme: true },
    };
  });