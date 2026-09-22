import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calcularMonofasico,
  type MonofasicoInput,
  type RegimeMonofasico,
  type ResultadoMonofasico,
  type SegmentoMonofasico,
} from "@/lib/monofasico/calculo";

export interface EstudoMonofasicoRow {
  id: string;
  case_id: string | null;
  titulo: string;
  segmento: string;
  regime: string;
  faturamento_mensal: number;
  participacao_monofasica_pct: number;
  aliquota_efetiva_das_pct: number;
  parcela_pis_cofins_pct: number;
  meses_retroativos: number;
  selic_aa_pct: number;
  honorario_exito_pct: number;
  observacao: string | null;
  resultado: ResultadoMonofasico | null;
  created_at: string;
  updated_at: string;
}

export interface EstudoMonofasicoInput {
  id?: string;
  caseId?: string | null;
  titulo: string;
  segmento: SegmentoMonofasico;
  regime: RegimeMonofasico;
  faturamentoMensal: number;
  participacaoMonofasicaPct: number;
  aliquotaEfetivaDasPct: number;
  parcelaPisCofinsPct: number;
  mesesRetroativos: number;
  selicAaPct: number;
  honorarioExitoPct: number;
  observacao?: string | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

function toRow(row: Record<string, unknown>): EstudoMonofasicoRow {
  return {
    id: String(row["id"]),
    case_id: (row["case_id"] as string | null) ?? null,
    titulo: String(row["titulo"] ?? ""),
    segmento: String(row["segmento"] ?? ""),
    regime: String(row["regime"] ?? ""),
    faturamento_mensal: num(row["faturamento_mensal"]),
    participacao_monofasica_pct: num(row["participacao_monofasica_pct"]),
    aliquota_efetiva_das_pct: num(row["aliquota_efetiva_das_pct"]),
    parcela_pis_cofins_pct: num(row["parcela_pis_cofins_pct"]),
    meses_retroativos: num(row["meses_retroativos"]),
    selic_aa_pct: num(row["selic_aa_pct"]),
    honorario_exito_pct: num(row["honorario_exito_pct"]),
    observacao: (row["observacao"] as string | null) ?? null,
    resultado: (row["resultado_json"] as ResultadoMonofasico | null) ?? null,
    created_at: String(row["created_at"] ?? ""),
    updated_at: String(row["updated_at"] ?? ""),
  };
}

const toInput = (d: EstudoMonofasicoInput): MonofasicoInput => ({
  segmento: d.segmento,
  regime: d.regime,
  faturamentoMensal: d.faturamentoMensal,
  participacaoMonofasicaPct: d.participacaoMonofasicaPct,
  aliquotaEfetivaDasPct: d.aliquotaEfetivaDasPct,
  parcelaPisCofinsPct: d.parcelaPisCofinsPct,
  mesesRetroativos: d.mesesRetroativos,
  selicAaPct: d.selicAaPct,
  honorarioExitoPct: d.honorarioExitoPct,
});

/** Grava (ou atualiza) um estudo estimativo de recuperação monofásica. */
export const salvarEstudoMonofasico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EstudoMonofasicoInput) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resultado = calcularMonofasico(toInput(data));

    const payload = {
      case_id: data.caseId ?? null,
      titulo: data.titulo.trim() || "Estudo de recuperação monofásica",
      segmento: data.segmento,
      regime: data.regime,
      faturamento_mensal: data.faturamentoMensal,
      participacao_monofasica_pct: data.participacaoMonofasicaPct,
      aliquota_efetiva_das_pct: data.aliquotaEfetivaDasPct,
      parcela_pis_cofins_pct: data.parcelaPisCofinsPct,
      meses_retroativos: data.mesesRetroativos,
      selic_aa_pct: data.selicAaPct,
      honorario_exito_pct: data.honorarioExitoPct,
      observacao: data.observacao?.trim() || null,
      resultado_json: resultado as unknown as never,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("estudo_monofasico")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id, resultado };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("estudo_monofasico")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: String(inserted?.["id"] ?? ""), resultado };
  });

export const listEstudosMonofasico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("estudo_monofasico")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      items: (rows ?? []).map((r) => toRow(r as Record<string, unknown>)),
    };
  });

export const excluirEstudoMonofasico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("estudo_monofasico").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
