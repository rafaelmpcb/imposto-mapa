import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CarteiraRow,
  CarteiraTipo,
  SavedMapping,
} from "@/lib/carteira/types";

const FONTE = "CNPJá — API Pública";

interface DraftInput {
  nome: string;
  cnpj: string;
  tipo: CarteiraTipo;
  valor: number;
}

/** Recalcula o % da carteira de cada linha, por tipo, dentro do Caso. */
async function recalcPercentuals(
  admin: { from: (t: string) => any },
  caseId: string,
): Promise<void> {
  const { data } = await admin
    .from("composicao_carteira")
    .select("id,tipo,valor_movimentado")
    .eq("case_id", caseId);
  const rows = (data ?? []) as { id: string; tipo: CarteiraTipo; valor_movimentado: number }[];
  const totals = new Map<CarteiraTipo, number>();
  for (const r of rows) {
    totals.set(r.tipo, (totals.get(r.tipo) ?? 0) + Number(r.valor_movimentado));
  }
  await Promise.all(
    rows.map((r) => {
      const total = totals.get(r.tipo) ?? 0;
      const pct = total > 0 ? (Number(r.valor_movimentado) / total) * 100 : 0;
      return admin
        .from("composicao_carteira")
        .update({ percentual_carteira: Math.round(pct * 10000) / 10000 })
        .eq("id", r.id);
    }),
  );
}

async function setDocStatus(
  admin: { from: (t: string) => any },
  caseId: string,
  docKey: string,
  status: string,
): Promise<void> {
  await admin
    .from("case_diagnostic_docs")
    .upsert({ case_id: caseId, doc_key: docKey, status }, { onConflict: "case_id,doc_key" });
}

/** Carrega a composição de carteira, os status dos documentos e o mapeamento salvo. */
export const getCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [rowsRes, docsRes, caseRes] = await Promise.all([
      supabaseAdmin
        .from("composicao_carteira")
        .select("*")
        .eq("case_id", data.caseId)
        .order("valor_movimentado", { ascending: false })
        .limit(5000),
      supabaseAdmin.from("case_diagnostic_docs").select("*").eq("case_id", data.caseId),
      supabaseAdmin
        .from("cases")
        .select("carteira_column_mapping,carteira_uploaded_at")
        .eq("id", data.caseId)
        .maybeSingle(),
    ]);
    if (rowsRes.error) throw new Error(rowsRes.error.message);

    const rows = (rowsRes.data ?? []) as unknown as CarteiraRow[];
    const docs = ((docsRes.data ?? []) as unknown as { doc_key: string; status: string }[]).reduce<
      Record<string, string>
    >((acc, d) => {
      acc[d.doc_key] = d.status;
      return acc;
    }, {});
    const caseRow = (caseRes.data ?? null) as {
      carteira_column_mapping: SavedMapping | null;
      carteira_uploaded_at: string | null;
    } | null;

    return {
      ok: true as const,
      rows,
      docs,
      mapping: caseRow?.carteira_column_mapping ?? null,
      uploadedAt: caseRow?.carteira_uploaded_at ?? null,
      pending: rows.filter((r) => r.status_consulta === "pendente").length,
    };
  });

/** Grava a composição conferida pelo usuário (substituindo ou somando à existente). */
export const saveCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      rows: DraftInput[];
      replace: boolean;
      mapping: SavedMapping | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.replace) {
      const del = await supabaseAdmin
        .from("composicao_carteira")
        .delete()
        .eq("case_id", data.caseId);
      if (del.error) throw new Error(del.error.message);
    }

    const payload = data.rows
      .filter((r) => /^\d{14}$/.test(r.cnpj) && r.valor > 0)
      .map((r) => ({
        case_id: data.caseId,
        nome: r.nome.slice(0, 200),
        cnpj: r.cnpj,
        tipo: r.tipo,
        valor_movimentado: r.valor,
        regime: "pendente" as const,
        status_consulta: "pendente" as const,
        fonte_classificacao: FONTE,
      }));

    if (payload.length > 0) {
      const ins = await supabaseAdmin.from("composicao_carteira").insert(payload as never);
      if (ins.error) throw new Error(ins.error.message);
    }

    await recalcPercentuals(supabaseAdmin as never, data.caseId);
    await setDocStatus(supabaseAdmin as never, data.caseId, "composicao_carteira", "enviado");
    await supabaseAdmin
      .from("cases")
      .update({
        carteira_column_mapping: (data.mapping ?? null) as never,
        carteira_uploaded_at: new Date().toISOString(),
      } as never)
      .eq("id", data.caseId);

    return { ok: true as const, inserted: payload.length };
  });

interface Classification {
  regime: "simples" | "regular" | "erro";
  status: "ok" | "nao_encontrado" | "erro";
  updated: string | null;
}

/** Consulta o regime tributário na API Pública da CNPJá. */
async function classify(cnpj: string): Promise<Classification> {
  try {
    const res = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { regime: "erro", status: "nao_encontrado", updated: null };
    if (!res.ok) return { regime: "erro", status: "erro", updated: null };
    const raw = (await res.json()) as Record<string, any>;
    const optant =
      raw?.["company"]?.["simples"]?.["optant"] ?? raw?.["simples"]?.["optant"] ?? null;
    if (optant === null || optant === undefined) {
      return { regime: "regular", status: "ok", updated: raw?.["updated"] ?? null };
    }
    return {
      regime: optant ? "simples" : "regular",
      status: "ok",
      updated: raw?.["updated"] ?? null,
    };
  } catch {
    return { regime: "erro", status: "erro", updated: null };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Processa um lote pequeno de CNPJs, respeitando o limite de 5 consultas por
 * minuto da API pública (~12 s entre chamadas). O progresso fica gravado no
 * banco: o usuário pode sair da tela e retomar depois.
 */
export const processCarteiraBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; ids?: string[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const BATCH = 4;

    let query = supabaseAdmin
      .from("composicao_carteira")
      .select("id,cnpj")
      .eq("case_id", data.caseId);
    query = data.ids?.length
      ? query.in("id", data.ids)
      : query.in("status_consulta", ["pendente", "erro"]);

    const { data: rows, error } = await query.limit(BATCH);
    if (error) throw new Error(error.message);
    const batch = (rows ?? []) as { id: string; cnpj: string }[];

    for (let i = 0; i < batch.length; i += 1) {
      const row = batch[i]!;
      if (i > 0) await sleep(12_000);
      const result = await classify(row.cnpj);
      await supabaseAdmin
        .from("composicao_carteira")
        .update({
          regime: result.regime,
          status_consulta: result.status,
          fonte_classificacao: FONTE,
          data_classificacao: result.updated ?? new Date().toISOString(),
        } as never)
        .eq("id", row.id);
    }

    const { count } = await supabaseAdmin
      .from("composicao_carteira")
      .select("id", { count: "exact", head: true })
      .eq("case_id", data.caseId)
      .eq("status_consulta", "pendente");

    const remaining = count ?? 0;
    if (remaining === 0 && !data.ids?.length) {
      await setDocStatus(supabaseAdmin as never, data.caseId, "composicao_carteira", "processado");
    }

    return { ok: true as const, processed: batch.length, remaining };
  });

/** Remove uma contraparte da composição e recalcula os percentuais. */
export const deleteCarteiraRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("composicao_carteira")
      .delete()
      .eq("id", data.id)
      .eq("case_id", data.caseId);
    if (error) throw new Error(error.message);
    await recalcPercentuals(supabaseAdmin as never, data.caseId);
    return { ok: true as const };
  });

/** Marca linhas para nova consulta (usado em "Atualizar classificação"). */
export const resetCarteiraRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; ids: string[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.ids.length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("composicao_carteira")
      .update({ status_consulta: "pendente", regime: "pendente" } as never)
      .eq("case_id", data.caseId)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    await setDocStatus(supabaseAdmin as never, data.caseId, "composicao_carteira", "enviado");
    return { ok: true as const };
  });
