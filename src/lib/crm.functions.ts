import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeeModel = "fixo" | "exito" | "recorrente" | "hibrido";
export type CommercialStatus = "ativo" | "ganho" | "perdido";
export type InteractionKind = "reuniao" | "ligacao" | "email" | "whatsapp" | "nota";

export const FEE_MODEL_LABELS: Record<FeeModel, string> = {
  fixo: "Honorário fixo",
  exito: "Êxito",
  recorrente: "Mensalidade recorrente",
  hibrido: "Híbrido (fixo + êxito)",
};

export const STATUS_LABELS: Record<CommercialStatus, string> = {
  ativo: "Em negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const INTERACTION_LABELS: Record<InteractionKind, string> = {
  reuniao: "Reunião",
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  nota: "Nota interna",
};

export interface CaseContact {
  id: string;
  case_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface CaseInteraction {
  id: string;
  case_id: string;
  kind: InteractionKind;
  title: string;
  body: string | null;
  happened_at: string;
  author_name: string | null;
  created_at: string;
}

/** Atualiza os dados comerciais da oportunidade (honorários, chance, status, próxima ação). */
export const updateCaseCommercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      dealValue: number;
      feeModel: FeeModel;
      winProbability: number;
      commercialStatus: CommercialStatus;
      lostReason: string | null;
      nextActionTitle: string | null;
      nextActionDate: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cases")
      .update({
        deal_value: Number.isFinite(data.dealValue) ? Math.max(0, data.dealValue) : 0,
        fee_model: data.feeModel,
        win_probability: Math.min(100, Math.max(0, Math.round(data.winProbability))),
        commercial_status: data.commercialStatus,
        lost_reason: data.commercialStatus === "perdido" ? data.lostReason : null,
        next_action_title: data.nextActionTitle?.trim() || null,
        next_action_date: data.nextActionDate || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Lista contatos e interações de um Caso. */
export const getCaseCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [contactsRes, interactionsRes] = await Promise.all([
      supabaseAdmin
        .from("case_contacts")
        .select("*")
        .eq("case_id", data.caseId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("case_interactions")
        .select("*")
        .eq("case_id", data.caseId)
        .order("happened_at", { ascending: false })
        .limit(200),
    ]);
    if (contactsRes.error) throw new Error(contactsRes.error.message);
    if (interactionsRes.error) throw new Error(interactionsRes.error.message);
    return {
      ok: true as const,
      contacts: (contactsRes.data ?? []) as unknown as CaseContact[],
      interactions: (interactionsRes.data ?? []) as unknown as CaseInteraction[],
    };
  });

/** Cria um contato (interlocutor) no Caso. */
export const addCaseContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      name: string;
      role: string | null;
      email: string | null;
      phone: string | null;
      isPrimary: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isPrimary) {
      await supabaseAdmin
        .from("case_contacts")
        .update({ is_primary: false })
        .eq("case_id", data.caseId);
    }
    const { data: row, error } = await supabaseAdmin
      .from("case_contacts")
      .insert({
        case_id: data.caseId,
        name: data.name.trim(),
        role: data.role?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        is_primary: data.isPrimary,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, contact: row as unknown as CaseContact };
  });

/** Remove um contato do Caso. */
export const deleteCaseContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("case_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Registra uma interação comercial na linha do tempo do Caso. */
export const addCaseInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      kind: InteractionKind;
      title: string;
      body: string | null;
      happenedAt: string | null;
      authorName: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("case_interactions")
      .insert({
        case_id: data.caseId,
        kind: data.kind,
        title: data.title.trim(),
        body: data.body?.trim() || null,
        happened_at: data.happenedAt || new Date().toISOString(),
        author_id: context.userId,
        author_name: data.authorName?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, interaction: row as unknown as CaseInteraction };
  });

/** Remove uma interação da linha do tempo. */
export const deleteCaseInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("case_interactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
