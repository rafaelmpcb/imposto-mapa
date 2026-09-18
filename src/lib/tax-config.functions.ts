import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PARAMETERS, defaultParameterValues } from "@/lib/tax/parameters";
import { getParameters } from "@/lib/tax-parameters.functions";

export type TaxConfigMap = Record<string, number>;
export type TaxConfigMeta = Record<string, string>;

/** Leitura pública: os percentuais e faixas vigentes usados nas estimativas. */
export const getTaxConfig = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await getParameters();
  return snapshot.values as TaxConfigMap;
});

/** Leitura pública: data da última alteração de cada parâmetro. */
export const getTaxConfigMeta = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await getParameters();
  const out: TaxConfigMeta = {};
  for (const [key, version] of Object.entries(snapshot.current)) out[key] = version.createdAt;
  return out;
});

async function insertVersions(
  values: TaxConfigMap,
  source: string,
  userId: string | undefined,
): Promise<void> {
  const snapshot = await getParameters();
  const rows = Object.entries(values)
    .filter(([key, value]) => Number.isFinite(value) && snapshot.values[key] !== value)
    .map(([key, value]) => ({
      param_key: key,
      value,
      effective_from: new Date().toISOString().slice(0, 10),
      source,
      created_by: userId ?? null,
    }));
  if (!rows.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("tax_parameters").insert(rows);
  if (error) throw new Error(error.message);
}

export const saveTaxConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { values: TaxConfigMap }) => input)
  .handler(async ({ data, context }) => {
    await insertVersions(data.values, "Ajuste manual no painel do escritório", context.userId);
    return { ok: true as const };
  });

export const resetTaxConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const defaults = defaultParameterValues();
    const only: TaxConfigMap = {};
    for (const def of PARAMETERS) only[def.key] = defaults[def.key]!;
    await insertVersions(only, "Restauração dos valores padrão (LC 214/2025)", context.userId);
    return { ok: true as const };
  });
