import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ClicksignPublico {
  temToken: boolean;
  tokenFinal: string;
  temHmac: boolean;
  ambiente: "sandbox" | "producao";
  signatarioNome: string;
  signatarioEmail: string;
  signatarioCelular: string;
  signatarioCpf: string;
}

const CHAVES = [
  "clicksign_token",
  "clicksign_hmac",
  "clicksign_ambiente",
  "clicksign_signatario_nome",
  "clicksign_signatario_email",
  "clicksign_signatario_celular",
  "clicksign_signatario_cpf",
] as const;

/** Lê a configuração no servidor (com o token). Uso interno. */
export async function lerConfigClicksign(): Promise<Record<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("integration_config").select("key,value").in("key", [...CHAVES]);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key as string] = String(r.value ?? "");
  return out;
}

export const getClicksignConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ClicksignPublico> => {
    const c = await lerConfigClicksign();
    const tok = c["clicksign_token"] ?? "";
    return {
      temToken: tok.length > 0,
      tokenFinal: tok ? tok.slice(-4) : "",
      temHmac: Boolean(c["clicksign_hmac"]),
      ambiente: c["clicksign_ambiente"] === "producao" ? "producao" : "sandbox",
      signatarioNome: c["clicksign_signatario_nome"] || "Leonardo Azevedo Pinheiro Borges",
      signatarioEmail: c["clicksign_signatario_email"] || "leonardo@azevedoeadvogados.adv.br",
      signatarioCelular: c["clicksign_signatario_celular"] ?? "",
      signatarioCpf: c["clicksign_signatario_cpf"] || "728.915.723-00",
    };
  });

export const saveClicksignConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      token?: string;
      hmac?: string;
      ambiente: "sandbox" | "producao";
      signatarioNome: string;
      signatarioEmail: string;
      signatarioCelular: string;
      signatarioCpf: string;
      removerToken?: boolean;
    }) => i,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows: { key: string; value: string; updated_at: string }[] = [
      { key: "clicksign_ambiente", value: data.ambiente, updated_at: now },
      { key: "clicksign_signatario_nome", value: data.signatarioNome.trim(), updated_at: now },
      { key: "clicksign_signatario_email", value: data.signatarioEmail.trim(), updated_at: now },
      { key: "clicksign_signatario_celular", value: data.signatarioCelular.trim(), updated_at: now },
      { key: "clicksign_signatario_cpf", value: data.signatarioCpf.trim(), updated_at: now },
    ];
    if (data.removerToken) rows.push({ key: "clicksign_token", value: "", updated_at: now });
    else if (data.token?.trim()) rows.push({ key: "clicksign_token", value: data.token.trim(), updated_at: now });
    if (data.hmac?.trim()) rows.push({ key: "clicksign_hmac", value: data.hmac.trim(), updated_at: now });
    const { error } = await supabaseAdmin.from("integration_config").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
