import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface OfficeConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  advogado_nome: string;
  oab: string;
  foro: string;
  whatsapp: string;
  email_contato: string;
  telefone: string;
  site: string;
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

/** Contatos exibidos ao cliente (opcionais). */
export const OFFICE_CONTACT_FIELDS: {
  key: keyof OfficeConfig;
  label: string;
  placeholder: string;
}[] = [
  { key: "whatsapp", label: "WhatsApp (com DDD)", placeholder: "85 99999-9999" },
  { key: "email_contato", label: "E-mail de contato", placeholder: "contato@escritorio.com.br" },
  { key: "telefone", label: "Telefone fixo", placeholder: "85 3333-3333" },
  { key: "site", label: "Site", placeholder: "https://www.escritorio.com.br" },
];

export const emptyOfficeConfig = (): OfficeConfig => ({
  nome: "",
  cnpj: "",
  endereco: "",
  advogado_nome: "",
  oab: "",
  foro: "",
  whatsapp: "",
  email_contato: "",
  telefone: "",
  site: "",
});

export interface OfficeContact {
  nome: string;
  whatsapp: string;
  email_contato: string;
  telefone: string;
  site: string;
}

export const emptyOfficeContact = (): OfficeContact => ({
  nome: "",
  whatsapp: "",
  email_contato: "",
  telefone: "",
  site: "",
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

/** Leitura pública: apenas os contatos exibidos ao cliente. */
export const getOfficeContact = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const contact = emptyOfficeContact();
  const { data, error } = await supabaseAdmin
    .from("office_config")
    .select("key, value")
    .in("key", ["nome", "whatsapp", "email_contato", "telefone", "site"]);
  if (error) return contact;
  for (const row of data ?? []) {
    const key = row.key as keyof OfficeContact;
    if (key in contact) contact[key] = String(row.value ?? "");
  }
  return contact;
});

export const saveOfficeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { values: OfficeConfig }) => input)
  .handler(async ({ data }) => {
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
