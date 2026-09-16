import { createServerFn } from "@tanstack/react-start";

export interface SavedSimulation {
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
  input: unknown;
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
  input: Record<string, unknown>;
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
