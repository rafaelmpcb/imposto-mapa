import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calcularCapex,
  type CapexInput,
  type RegimeCapex,
  type ResultadoCapex,
  type TipoAtivo,
} from "@/lib/capex/calculo";

export interface EstudoCapexRow {
  id: string;
  case_id: string | null;
  titulo: string;
  tipo_ativo: TipoAtivo;
  regime: RegimeCapex;
  valor_investimento: number;
  icms_pct: number;
  ipi_pct: number;
  fator_ciap_pct: number;
  custo_oportunidade_aa_pct: number;
  aliquota_plena_pct: number;
  ano_aquisicao: number;
  observacao: string | null;
  resultado: ResultadoCapex | null;
  created_at: string;
  updated_at: string;
}

export interface EstudoCapexInput {
  id?: string;
  caseId?: string | null;
  titulo: string;
  tipoAtivo: TipoAtivo;
  regime: RegimeCapex;
  valorInvestimento: number;
  icmsPct: number;
  ipiPct: number;
  fatorCiapPct: number;
  custoOportunidadeAaPct: number;
  aliquotaPlenaPct: number;
  ano: number;
  observacao?: string | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

function toRow(row: Record<string, unknown>): EstudoCapexRow {
  return {
    id: String(row["id"]),
    case_id: (row["case_id"] as string | null) ?? null,
    titulo: String(row["titulo"] ?? ""),
    tipo_ativo: (row["tipo_ativo"] as TipoAtivo) ?? "maquinas",
    regime: (row["regime"] as RegimeCapex) ?? "real",
    valor_investimento: num(row["valor_investimento"]),
    icms_pct: num(row["icms_pct"]),
    ipi_pct: num(row["ipi_pct"]),
    fator_ciap_pct: num(row["fator_ciap_pct"]),
    custo_oportunidade_aa_pct: num(row["custo_oportunidade_aa_pct"]),
    aliquota_plena_pct: num(row["aliquota_plena_pct"]),
    ano_aquisicao: num(row["ano_aquisicao"]),
    observacao: (row["observacao"] as string | null) ?? null,
    resultado: (row["resultado_json"] as ResultadoCapex | null) ?? null,
    created_at: String(row["created_at"] ?? ""),
    updated_at: String(row["updated_at"] ?? ""),
  };
}

const toInput = (data: EstudoCapexInput): CapexInput => ({
  valorInvestimento: data.valorInvestimento,
  tipoAtivo: data.tipoAtivo,
  regime: data.regime,
  icmsPct: data.icmsPct,
  ipiPct: data.ipiPct,
  fatorCiapPct: data.fatorCiapPct,
  custoOportunidadeAaPct: data.custoOportunidadeAaPct,
  ano: data.ano,
  aliquotaPlenaPct: data.aliquotaPlenaPct,
});

/** Grava (ou atualiza) um estudo de CAPEX com o resultado calculado. */
export const salvarEstudoCapex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EstudoCapexInput) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resultado = calcularCapex(toInput(data));

    const payload = {
      case_id: data.caseId ?? null,
      titulo: data.titulo.trim() || "Estudo de CAPEX",
      tipo_ativo: data.tipoAtivo,
      regime: data.regime,
      valor_investimento: data.valorInvestimento,
      icms_pct: data.icmsPct,
      ipi_pct: data.ipiPct,
      fator_ciap_pct: data.fatorCiapPct,
      custo_oportunidade_aa_pct: data.custoOportunidadeAaPct,
      aliquota_plena_pct: data.aliquotaPlenaPct,
      ano_aquisicao: data.ano,
      observacao: data.observacao?.trim() || null,
      resultado_json: resultado as unknown as never,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("estudo_capex").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id, resultado };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("estudo_capex")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: String(inserted?.["id"] ?? ""), resultado };
  });

/** Todos os estudos de CAPEX salvos. */
export const listEstudosCapex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("estudo_capex")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { ok: true as const, items: (rows ?? []).map((r) => toRow(r as Record<string, unknown>)) };
  });

export const excluirEstudoCapex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("estudo_capex").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
