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
  /** Dados comerciais do CRM. */
  deal_value: number;
  fee_model: string;
  win_probability: number;
  commercial_status: string;
  lost_reason: string | null;
  next_action_title: string | null;
  next_action_date: string | null;
  /** Resumo de relacionamento, para os cards do funil. */
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  contacts_count: number;
  last_interaction_at: string | null;
}


/** Lista os Casos com o histórico de cálculos vinculado a cada um. */
export const listCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [casesRes, simsRes, contactsRes, interactionsRes] = await Promise.all([
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
      supabaseAdmin
        .from("case_contacts")
        .select("case_id,name,phone,is_primary,created_at")
        .limit(2000),
      supabaseAdmin
        .from("case_interactions")
        .select("case_id,happened_at")
        .order("happened_at", { ascending: false })
        .limit(3000),
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

    const contactsByCase = new Map<
      string,
      { name: string; phone: string | null; is_primary: boolean }[]
    >();
    for (const row of contactsRes.data ?? []) {
      const key = row.case_id as string;
      const list = contactsByCase.get(key) ?? [];
      list.push({
        name: row.name as string,
        phone: (row.phone as string | null) ?? null,
        is_primary: Boolean(row.is_primary),
      });
      contactsByCase.set(key, list);
    }

    const lastInteraction = new Map<string, string>();
    for (const row of interactionsRes.data ?? []) {
      const key = row.case_id as string;
      if (!lastInteraction.has(key)) lastInteraction.set(key, row.happened_at as string);
    }

    const items: CaseRecord[] = (casesRes.data ?? []).map((row) => {
      const id = row.id as string;
      const contacts = contactsByCase.get(id) ?? [];
      const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
      return {
        id,
        client_name: (row.client_name as string | null) ?? null,
        cnpj: (row.cnpj as string | null) ?? null,
        stage: row.stage as CaseStage,
        owner_name: (row.owner_name as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        simulations: byCase.get(id) ?? [],
        deal_value: Number((row as Record<string, unknown>)["deal_value"] ?? 0),
        fee_model: String((row as Record<string, unknown>)["fee_model"] ?? "fixo"),
        win_probability: Number((row as Record<string, unknown>)["win_probability"] ?? 0),
        commercial_status: String(
          (row as Record<string, unknown>)["commercial_status"] ?? "ativo",
        ),
        lost_reason: ((row as Record<string, unknown>)["lost_reason"] as string | null) ?? null,
        next_action_title:
          ((row as Record<string, unknown>)["next_action_title"] as string | null) ?? null,
        next_action_date:
          ((row as Record<string, unknown>)["next_action_date"] as string | null) ?? null,
        primary_contact_name: primary?.name ?? null,
        primary_contact_phone: primary?.phone ?? null,
        contacts_count: contacts.length,
        last_interaction_at: lastInteraction.get(id) ?? null,
      };
    });

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

export interface StageStat {
  stage: CaseStage;
  /** Casos atualmente nesta etapa. */
  count: number;
  /** Tempo médio, em milissegundos, que os casos passaram nesta etapa antes de avançar. */
  avgDurationMs: number | null;
  /** Quantas passagens concluídas geraram essa média. */
  samples: number;
  /** Tempo médio, em ms, dos casos que estão parados nesta etapa agora. */
  avgCurrentAgeMs: number | null;
}

/** Métricas do funil: casos por etapa e tempo médio entre etapas. */
export const getFunnelStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ALL_STAGES } = await import("@/lib/cases/stages");

    const [casesRes, eventsRes] = await Promise.all([
      supabaseAdmin.from("cases").select("id,stage").limit(2000),
      supabaseAdmin
        .from("case_stage_events")
        .select("case_id,to_stage,changed_at")
        .order("changed_at", { ascending: true })
        .limit(10000),
    ]);
    if (casesRes.error) throw new Error(casesRes.error.message);
    if (eventsRes.error) throw new Error(eventsRes.error.message);

    const now = Date.now();
    const counts = new Map<CaseStage, number>();
    for (const row of casesRes.data ?? []) {
      const stage = row.stage as CaseStage;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }

    const byCase = new Map<string, { stage: CaseStage; at: number }[]>();
    for (const ev of eventsRes.data ?? []) {
      const list = byCase.get(ev.case_id as string) ?? [];
      list.push({ stage: ev.to_stage as CaseStage, at: new Date(ev.changed_at as string).getTime() });
      byCase.set(ev.case_id as string, list);
    }

    const totals = new Map<CaseStage, { sum: number; n: number }>();
    const current = new Map<CaseStage, { sum: number; n: number }>();
    for (const list of byCase.values()) {
      list.sort((a, b) => a.at - b.at);
      for (let i = 0; i < list.length; i += 1) {
        const entry = list[i]!;
        const next = list[i + 1];
        if (next) {
          const acc = totals.get(entry.stage) ?? { sum: 0, n: 0 };
          acc.sum += Math.max(0, next.at - entry.at);
          acc.n += 1;
          totals.set(entry.stage, acc);
        } else {
          const acc = current.get(entry.stage) ?? { sum: 0, n: 0 };
          acc.sum += Math.max(0, now - entry.at);
          acc.n += 1;
          current.set(entry.stage, acc);
        }
      }
    }

    const stages: StageStat[] = ALL_STAGES.map((stage) => {
      const done = totals.get(stage);
      const open = current.get(stage);
      return {
        stage,
        count: counts.get(stage) ?? 0,
        avgDurationMs: done && done.n > 0 ? done.sum / done.n : null,
        samples: done?.n ?? 0,
        avgCurrentAgeMs: open && open.n > 0 ? open.sum / open.n : null,
      };
    });

    const totalCases = (casesRes.data ?? []).length;
    return { ok: true as const, stages, totalCases };
  });
