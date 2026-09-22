import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calcularContrato,
  type ContratoInput,
  type CriterioRepactuacao,
  type RegimeLocador,
  type ResultadoAluguel,
} from "@/lib/aluguel/calculo";

export interface ContratoAluguelRow {
  id: string;
  case_id: string | null;
  titulo: string;
  contraparte: string | null;
  papel: "locador" | "locatario";
  regime_locador: RegimeLocador;
  aluguel_mensal: number;
  substituida_pct: number;
  mantida_pct: number;
  aproveitamento_credito_pct: number;
  aliquota_plena_pct: number;
  redutor_pct: number;
  ano_referencia: number;
  criterio: CriterioRepactuacao;
  observacao: string | null;
  resultado: ResultadoAluguel | null;
  created_at: string;
  updated_at: string;
}

export interface ContratoAluguelInput {
  id?: string;
  caseId?: string | null;
  titulo: string;
  contraparte?: string | null;
  papel: "locador" | "locatario";
  regimeLocador: RegimeLocador;
  aluguelMensal: number;
  substituidaPct: number;
  mantidaPct: number;
  aproveitamentoCreditoPct: number;
  aliquotaPlenaPct: number;
  redutorPct: number;
  ano: number;
  criterio: CriterioRepactuacao;
  observacao?: string | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

function toRow(row: Record<string, unknown>): ContratoAluguelRow {
  return {
    id: String(row["id"]),
    case_id: (row["case_id"] as string | null) ?? null,
    titulo: String(row["titulo"] ?? ""),
    contraparte: (row["contraparte"] as string | null) ?? null,
    papel: (row["papel"] as ContratoAluguelRow["papel"]) ?? "locador",
    regime_locador: (row["regime_locador"] as RegimeLocador) ?? "presumido",
    aluguel_mensal: num(row["aluguel_mensal"]),
    substituida_pct: num(row["substituida_pct"]),
    mantida_pct: num(row["mantida_pct"]),
    aproveitamento_credito_pct: num(row["aproveitamento_credito_pct"]),
    aliquota_plena_pct: num(row["aliquota_plena_pct"]),
    redutor_pct: num(row["redutor_pct"]),
    ano_referencia: num(row["ano_referencia"]),
    criterio: (row["criterio"] as CriterioRepactuacao) ?? "liquido_locador",
    observacao: (row["observacao"] as string | null) ?? null,
    resultado: (row["resultado_json"] as ResultadoAluguel | null) ?? null,
    created_at: String(row["created_at"] ?? ""),
    updated_at: String(row["updated_at"] ?? ""),
  };
}

const toInput = (data: ContratoAluguelInput): ContratoInput => ({
  aluguelMensal: data.aluguelMensal,
  regimeLocador: data.regimeLocador,
  aproveitamentoCreditoPct: data.aproveitamentoCreditoPct,
  ano: data.ano,
  criterio: data.criterio,
  aliquotaPlenaPct: data.aliquotaPlenaPct,
  redutorPct: data.redutorPct,
  substituidaPct: data.substituidaPct,
  mantidaPct: data.mantidaPct,
});

/** Grava (ou atualiza) um contrato de locação, já com o resultado calculado. */
export const salvarContratoAluguel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ContratoAluguelInput) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resultado = calcularContrato(toInput(data));

    const payload = {
      case_id: data.caseId ?? null,
      titulo: data.titulo.trim() || "Contrato de locação",
      contraparte: data.contraparte?.trim() || null,
      papel: data.papel,
      regime_locador: data.regimeLocador,
      aluguel_mensal: data.aluguelMensal,
      substituida_pct: data.substituidaPct,
      mantida_pct: data.mantidaPct,
      aproveitamento_credito_pct: data.aproveitamentoCreditoPct,
      aliquota_plena_pct: data.aliquotaPlenaPct,
      redutor_pct: data.redutorPct,
      ano_referencia: data.ano,
      criterio: data.criterio,
      observacao: data.observacao?.trim() || null,
      resultado_json: resultado as unknown as never,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("contrato_aluguel")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id, resultado };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("contrato_aluguel")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: String(inserted?.["id"] ?? ""), resultado };
  });

/** Contratos de um Caso (ou os sem Caso, quando caseId vem vazio). */
export const listContratosAluguel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId?: string | null }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("contrato_aluguel")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    query = data.caseId ? query.eq("case_id", data.caseId) : query.is("case_id", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const, items: (rows ?? []).map((r) => toRow(r as Record<string, unknown>)) };
  });

export const excluirContratoAluguel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contrato_aluguel").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Casos disponíveis para vincular uma simulação de aluguel. */
export const listCasosParaAluguel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cases")
      .select("id,client_name,cnpj")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      items: (data ?? []).map((r) => ({
        id: String(r["id"]),
        nome: (r["client_name"] as string | null) ?? "Caso sem nome",
        cnpj: (r["cnpj"] as string | null) ?? null,
      })),
    };
  });

/** Todos os contratos de locação salvos, com ou sem Caso vinculado. */
export const listTodosContratosAluguel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("contrato_aluguel")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      items: (rows ?? []).map((r) => toRow(r as Record<string, unknown>)),
    };
  });
