import { createServerFn } from "@tanstack/react-start";

export type TaxConfigMap = Record<string, number>;

/** Leitura pública: os percentuais usados nas estimativas. */
export const getTaxConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("tax_config").select("key, value");
  if (error) return {} as TaxConfigMap;
  const out: TaxConfigMap = {};
  for (const row of data ?? []) out[row.key as string] = Number(row.value);
  return out;
});

export type TaxConfigMeta = Record<string, string>;

/** Leitura pública: data da última alteração de cada alíquota salva. */
export const getTaxConfigMeta = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("tax_config").select("key, updated_at");
  if (error) return {} as TaxConfigMeta;
  const out: TaxConfigMeta = {};
  for (const row of data ?? []) {
    if (row.updated_at) out[row.key as string] = row.updated_at as string;
  }
  return out;
});

function checkCode(code: string): boolean {
  const expected = process.env["ADVOGADO_ACCESS_CODE"] ?? "";
  return Boolean(expected) && code.trim() === expected;
}

export const saveTaxConfig = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; values: TaxConfigMap }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Object.entries(data.values)
      .filter(([, v]) => Number.isFinite(v))
      .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("tax_config").upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const resetTaxConfig = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tax_config").delete().neq("key", "");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
