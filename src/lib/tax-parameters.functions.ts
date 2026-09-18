import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PARAMETER_BY_KEY, defaultParameterValues } from "@/lib/tax/parameters";

export interface ParameterVersion {
  id: string;
  key: string;
  value: number;
  effectiveFrom: string;
  source: string;
  createdAt: string;
  /** Último dia em que este valor esteve vigente (null = vigente hoje). */
  validUntil: string | null;
}

export interface ParametersSnapshot {
  values: Record<string, number>;
  current: Record<string, ParameterVersion>;
  /** Data do cadastro mais recente (ISO) — usado no rodapé do resultado. */
  lastUpdatedAt: string | null;
}

interface Row {
  id: string;
  param_key: string;
  value: number | string;
  effective_from: string;
  source: string | null;
  created_at: string;
}

const dayBefore = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

async function fetchRows(): Promise<Row[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tax_parameters")
    .select("id, param_key, value, effective_from, source, created_at")
    .order("effective_from", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as Row[];
}

function toVersions(rows: Row[]): Record<string, ParameterVersion[]> {
  const byKey: Record<string, ParameterVersion[]> = {};
  for (const row of rows) {
    const list = (byKey[row.param_key] ??= []);
    list.push({
      id: row.id,
      key: row.param_key,
      value: Number(row.value),
      effectiveFrom: row.effective_from,
      source: row.source ?? "",
      createdAt: row.created_at,
      validUntil: null,
    });
  }
  for (const list of Object.values(byKey)) {
    list.forEach((item, index) => {
      const next = list[index + 1];
      if (next) item.validUntil = dayBefore(next.effectiveFrom);
    });
  }
  return byKey;
}

/** Leitura pública: valores vigentes hoje + fonte e data de vigência de cada um. */
export const getParameters = createServerFn({ method: "GET" }).handler(
  async (): Promise<ParametersSnapshot> => {
    const rows = await fetchRows();
    const byKey = toVersions(rows);
    const values = defaultParameterValues();
    const current: Record<string, ParameterVersion> = {};
    const today = new Date().toISOString().slice(0, 10);
    let lastUpdatedAt: string | null = null;

    for (const [key, list] of Object.entries(byKey)) {
      if (!PARAMETER_BY_KEY[key]) continue;
      const vigente = [...list].reverse().find((v) => v.effectiveFrom <= today);
      if (!vigente) continue;
      values[key] = vigente.value;
      current[key] = vigente;
      if (!lastUpdatedAt || vigente.createdAt > lastUpdatedAt) lastUpdatedAt = vigente.createdAt;
    }

    return { values, current, lastUpdatedAt };
  },
);

/** Histórico completo (área restrita). */
export const getParameterHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Record<string, ParameterVersion[]>> => {
    const rows = await fetchRows();
    const byKey = toVersions(rows);
    for (const key of Object.keys(byKey)) {
      byKey[key] = [...byKey[key]!].reverse();
    }
    return byKey;
  });

export interface ParameterUpdateInput {
  key: string;
  value: number;
  effectiveFrom: string;
  source: string;
}

/** Cadastra uma nova versão do parâmetro — nunca sobrescreve a anterior. */
export const addParameterVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ParameterUpdateInput) => input)
  .handler(async ({ data, context }) => {
    if (!PARAMETER_BY_KEY[data.key]) throw new Error("Parâmetro desconhecido.");
    if (!Number.isFinite(data.value)) throw new Error("Valor inválido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom)) throw new Error("Data inválida.");
    const source = data.source.trim();
    if (!source) throw new Error("Informe a base legal/fonte.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tax_parameters").insert({
      param_key: data.key,
      value: data.value,
      effective_from: data.effectiveFrom,
      source: source.slice(0, 300),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
