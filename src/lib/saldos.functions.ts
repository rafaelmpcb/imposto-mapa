import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularSaldos, type ResultadoSaldos, type SaldosInput } from "@/lib/saldos/calculo";

export interface EstudoSaldosRow {
  id: string;
  case_id: string | null;
  titulo: string;
  uf: string;
  saldo_icms: number;
  saldo_pis_cofins: number;
  custo_oportunidade_aa_pct: number;
  ipca_aa_pct: number;
  desagio_cessao_pct: number;
  meses_compensacao_cbs: number;
  observacao: string | null;
  resultado: ResultadoSaldos | null;
  created_at: string;
  updated_at: string;
}

export interface EstudoSaldosInput {
  id?: string;
  caseId?: string | null;
  titulo: string;
  uf: string;
  saldoIcms: number;
  saldoPisCofins: number;
  custoOportunidadeAaPct: number;
  ipcaAaPct: number;
  desagioCessaoPct: number;
  mesesCompensacaoCbs: number;
  observacao?: string | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

function toRow(row: Record<string, unknown>): EstudoSaldosRow {
  return {
    id: String(row["id"]),
    case_id: (row["case_id"] as string | null) ?? null,
    titulo: String(row["titulo"] ?? ""),
    uf: String(row["uf"] ?? ""),
    saldo_icms: num(row["saldo_icms"]),
    saldo_pis_cofins: num(row["saldo_pis_cofins"]),
    custo_oportunidade_aa_pct: num(row["custo_oportunidade_aa_pct"]),
    ipca_aa_pct: num(row["ipca_aa_pct"]),
    desagio_cessao_pct: num(row["desagio_cessao_pct"]),
    meses_compensacao_cbs: num(row["meses_compensacao_cbs"]),
    observacao: (row["observacao"] as string | null) ?? null,
    resultado: (row["resultado_json"] as ResultadoSaldos | null) ?? null,
    created_at: String(row["created_at"] ?? ""),
    updated_at: String(row["updated_at"] ?? ""),
  };
}

const toInput = (d: EstudoSaldosInput): SaldosInput => ({
  saldoIcms: d.saldoIcms,
  saldoPisCofins: d.saldoPisCofins,
  custoOportunidadeAaPct: d.custoOportunidadeAaPct,
  ipcaAaPct: d.ipcaAaPct,
  desagioCessaoPct: d.desagioCessaoPct,
  mesesCompensacaoCbs: d.mesesCompensacaoCbs,
});

/** Grava (ou atualiza) um estudo de saldos credores com o resultado calculado. */
export const salvarEstudoSaldos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EstudoSaldosInput) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resultado = calcularSaldos(toInput(data));

    const payload = {
      case_id: data.caseId ?? null,
      titulo: data.titulo.trim() || "Estudo de saldos credores",
      uf: data.uf || "SP",
      saldo_icms: data.saldoIcms,
      saldo_pis_cofins: data.saldoPisCofins,
      custo_oportunidade_aa_pct: data.custoOportunidadeAaPct,
      ipca_aa_pct: data.ipcaAaPct,
      desagio_cessao_pct: data.desagioCessaoPct,
      meses_compensacao_cbs: data.mesesCompensacaoCbs,
      observacao: data.observacao?.trim() || null,
      resultado_json: resultado as unknown as never,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("estudo_saldos_credores")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id, resultado };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("estudo_saldos_credores")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: String(inserted?.["id"] ?? ""), resultado };
  });

export const listEstudosSaldos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("estudo_saldos_credores")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { ok: true as const, items: (rows ?? []).map((r) => toRow(r as Record<string, unknown>)) };
  });

export const excluirEstudoSaldos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("estudo_saldos_credores")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
