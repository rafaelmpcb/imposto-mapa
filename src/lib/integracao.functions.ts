import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AssinafyPublico {
  temApiKey: boolean;
  apiKeyFinal: string;
  temAccountId: boolean;
  temWebhookSecret: boolean;
  ambiente: "sandbox" | "producao";
  signatarioNome: string;
  signatarioEmail: string;
  signatarioCelular: string;
  signatarioCpf: string;
}

const CHAVES = [
  "assinafy_api_key",
  "assinafy_account_id",
  "assinafy_webhook_secret",
  "assinafy_ambiente",
  "assinafy_signatario_nome",
  "assinafy_signatario_email",
  "assinafy_signatario_celular",
  "assinafy_signatario_cpf",
] as const;

/** Lê a configuração no servidor (com a chave de API). Uso interno. */
export async function lerConfigAssinafy(): Promise<Record<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("integration_config").select("key,value").in("key", [...CHAVES]);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key as string] = String(r.value ?? "");
  return out;
}

export const getAssinafyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AssinafyPublico> => {
    const c = await lerConfigAssinafy();
    const key = c["assinafy_api_key"] ?? "";
    return {
      temApiKey: key.length > 0,
      apiKeyFinal: key ? key.slice(-4) : "",
      temAccountId: Boolean(c["assinafy_account_id"]),
      temWebhookSecret: Boolean(c["assinafy_webhook_secret"]),
      ambiente: c["assinafy_ambiente"] === "producao" ? "producao" : "sandbox",
      signatarioNome: c["assinafy_signatario_nome"] || "Leonardo Azevedo Pinheiro Borges",
      signatarioEmail: c["assinafy_signatario_email"] || "leonardo@azevedoeadvogados.adv.br",
      signatarioCelular: c["assinafy_signatario_celular"] ?? "",
      signatarioCpf: c["assinafy_signatario_cpf"] || "728.915.723-00",
    };
  });

export const saveAssinafyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      apiKey?: string;
      accountId?: string;
      webhookSecret?: string;
      ambiente: "sandbox" | "producao";
      signatarioNome: string;
      signatarioEmail: string;
      signatarioCelular: string;
      signatarioCpf: string;
      removerApiKey?: boolean;
    }) => i,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows: { key: string; value: string; updated_at: string }[] = [
      { key: "assinafy_ambiente", value: data.ambiente, updated_at: now },
      { key: "assinafy_signatario_nome", value: data.signatarioNome.trim(), updated_at: now },
      { key: "assinafy_signatario_email", value: data.signatarioEmail.trim(), updated_at: now },
      { key: "assinafy_signatario_celular", value: data.signatarioCelular.trim(), updated_at: now },
      { key: "assinafy_signatario_cpf", value: data.signatarioCpf.trim(), updated_at: now },
    ];
    if (data.removerApiKey) rows.push({ key: "assinafy_api_key", value: "", updated_at: now });
    else if (data.apiKey?.trim()) rows.push({ key: "assinafy_api_key", value: data.apiKey.trim(), updated_at: now });
    if (data.accountId?.trim()) rows.push({ key: "assinafy_account_id", value: data.accountId.trim(), updated_at: now });
    if (data.webhookSecret?.trim())
      rows.push({ key: "assinafy_webhook_secret", value: data.webhookSecret.trim(), updated_at: now });
    const { error } = await supabaseAdmin.from("integration_config").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
