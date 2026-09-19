import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CaseStage } from "@/lib/cases/stages";
import type { SavedSimulation } from "@/lib/simulations.functions";

export interface CaseRecord {
  id: string;
  client_name: string | null;
  cnpj: string | null;
  stage: CaseStage;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  simulations: SavedSimulation[];
}

/** Lista os Casos com o histórico de cálculos vinculado a cada um. */
export const listCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [casesRes, simsRes] = await Promise.all([
      supabaseAdmin
        .from("cases")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("simulations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (casesRes.error) throw new Error(casesRes.error.message);
    if (simsRes.error) throw new Error(simsRes.error.message);

    const sims = (simsRes.data ?? []) as unknown as (SavedSimulation & {
      case_id: string | null;
    })[];

    const byCase = new Map<string, SavedSimulation[]>();
    for (const sim of sims) {
      if (!sim.case_id) continue;
      const list = byCase.get(sim.case_id) ?? [];
      list.push(sim);
      byCase.set(sim.case_id, list);
    }

    const items: CaseRecord[] = (casesRes.data ?? []).map((row) => ({
      id: row.id as string,
      client_name: (row.client_name as string | null) ?? null,
      cnpj: (row.cnpj as string | null) ?? null,
      stage: row.stage as CaseStage,
      owner_name: (row.owner_name as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      simulations: byCase.get(row.id as string) ?? [],
    }));

    return { ok: true as const, items };
  });

/** Move um Caso para outra etapa do funil. */
export const updateCaseStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; stage: CaseStage }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cases")
      .update({ stage: data.stage })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Renomeia o Caso (nome do cliente ou razão social). */
export const renameCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; clientName: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cases")
      .update({ client_name: data.clientName.trim() || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Exclui um Caso; os cálculos vinculados são removidos junto. */
export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const del = await supabaseAdmin.from("simulations").delete().eq("case_id", data.id);
    if (del.error) throw new Error(del.error.message);
    const { error } = await supabaseAdmin.from("cases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
