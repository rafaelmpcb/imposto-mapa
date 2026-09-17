import { createServerFn } from "@tanstack/react-start";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface SavedSimulation {
  share_token?: string | null;
  share_enabled?: boolean;
  id: string;
  created_at: string;
  client_name: string | null;
  taxpayer_type: string;
  activity_id: string;
  uf: string;
  base_amount: number;
  year_id: number;
  current_total: number;
  reform_total: number;
  current_rate: number;
  reform_rate: number;
  input: JsonValue;
  cnpj?: string | null;
  cnpj_data?: JsonValue | null;
}

type SavePayload = {
  clientName: string;
  taxpayerType: string;
  activityId: string;
  uf: string;
  baseAmount: number;
  yearId: number;
  currentTotal: number;
  reformTotal: number;
  currentRate: number;
  reformRate: number;
  input: JsonValue;
  cnpj?: string | null;
  cnpjData?: JsonValue | null;
  id?: string | undefined;
};

export const saveSimulation = createServerFn({ method: "POST" })
  .inputValidator((input: SavePayload) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      client_name: data.clientName.trim() || null,
      taxpayer_type: data.taxpayerType,
      activity_id: data.activityId,
      uf: data.uf,
      base_amount: data.baseAmount,
      year_id: data.yearId,
      current_total: data.currentTotal,
      reform_total: data.reformTotal,
      current_rate: data.currentRate,
      reform_rate: data.reformRate,
      input: data.input,
      cnpj: data.cnpj ?? null,
      cnpj_data: data.cnpjData ?? null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("simulations")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("simulations")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const listSimulations = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const expected = process.env["ADVOGADO_ACCESS_CODE"] ?? "";
    if (!expected || data.code.trim() !== expected) {
      return { ok: false as const, items: [] as SavedSimulation[] };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("simulations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { ok: true as const, items: (rows ?? []) as unknown as SavedSimulation[] };
  });

function checkCode(code: string): boolean {
  const expected = process.env["ADVOGADO_ACCESS_CODE"] ?? "";
  return Boolean(expected) && code.trim() === expected;
}

export const deleteSimulation = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; id: string }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("simulations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Exclusão em lote: apaga vários cálculos de uma vez, com o mesmo código de acesso. */
export const deleteSimulationsBulk = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; ids: string[] }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const, deleted: 0 };
    const ids = data.ids.filter((id) => typeof id === "string" && id.length > 0);
    if (ids.length === 0) return { ok: true as const, deleted: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("simulations").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return { ok: true as const, deleted: ids.length };
  });

export const renameSimulation = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; id: string; clientName: string }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("simulations")
      .update({ client_name: data.clientName.trim() || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Liga ou desliga o link de compartilhamento somente-leitura. */
export const setSimulationShare = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; id: string; enabled: boolean }) => input)
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const, token: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = data.enabled ? crypto.randomUUID().replace(/-/g, "") : null;
    const patch = data.enabled
      ? { share_enabled: true, share_token: token }
      : { share_enabled: false, share_token: null };
    const { error } = await supabaseAdmin.from("simulations").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, token };
  });

/** Leitura pública de uma simulação compartilhada, apenas com token válido. */
export const getSharedSimulation = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    if (!data.token) return { found: false as const, item: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("simulations")
      .select("id, created_at, client_name, year_id, input, share_enabled")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error || !row || !row.share_enabled) return { found: false as const, item: null };
    return {
      found: true as const,
      item: {
        id: row.id as string,
        created_at: row.created_at as string,
        client_name: (row.client_name as string | null) ?? null,
        year_id: row.year_id as number,
        input: row.input as JsonValue,
      },
    };
  });
