import { createServerFn } from "@tanstack/react-start";

export interface OfficeConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  advogado_nome: string;
  oab: string;
  foro: string;
}

export const OFFICE_FIELDS: { key: keyof OfficeConfig; label: string; placeholder: string }[] = [
  { key: "nome", label: "Nome do escritório", placeholder: "Silva & Associados Advocacia" },
  { key: "cnpj", label: "CNPJ do escritório", placeholder: "00.000.000/0001-00" },
  {
    key: "endereco",
    label: "Endereço completo",
    placeholder: "Rua X, 100, Centro, Fortaleza/CE, 60000-000",
  },
  { key: "advogado_nome", label: "Advogado responsável", placeholder: "Maria Silva" },
  { key: "oab", label: "Inscrição na OAB", placeholder: "OAB/CE 23.955" },
  { key: "foro", label: "Foro padrão (comarca)", placeholder: "Fortaleza/CE" },
];

export const emptyOfficeConfig = (): OfficeConfig => ({
  nome: "",
  cnpj: "",
  endereco: "",
  advogado_nome: "",
  oab: "",
  foro: "",
});

export type OfficeConfigMeta = Record<string, string>;

/** Leitura dos dados fixos do escritório usados no memorando. */
export const getOfficeConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("office_config").select("key, value, updated_at");
  const values = emptyOfficeConfig();
  const meta: OfficeConfigMeta = {};
  if (error) return { values, meta };
  for (const row of data ?? []) {
    const key = row.key as keyof OfficeConfig;
    if (key in values) values[key] = String(row.value ?? "");
    if (row.updated_at) meta[row.key as string] = row.updated_at as string;
  }
  return { values, meta };
});

function checkCode(code: string): boolean {
  const expected = process.env["ADVOGADO_ACCESS_CODE"] ?? "";
  return Boolean(expected) && code.trim() === expected;
}

export const saveOfficeConfig = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; values: OfficeConfig }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Object.entries(data.values).map(([key, value]) => ({
      key,
      value: String(value ?? "").slice(0, 500),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("office_config").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
