import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PgdasdAnexo, PgdasdRecord, PgdasdStatus, PgdasdTributo } from "@/lib/pgdasd/types";

interface SaveInput {
  caseId: string;
  arquivo: string;
  competencia: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  rbt12: number | null;
  receitaBrutaPa: number | null;
  anexos: PgdasdAnexo[];
  folha12Meses: number | null;
  valorTotalDas: number | null;
  tributos: PgdasdTributo[];
  status: PgdasdStatus;
}

/** Lista os extratos de PGDAS-D já conferidos para o Caso. */
export const listPgdasd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("pgdasd_extraido")
      .select("*")
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const, items: (res.data ?? []) as unknown as PgdasdRecord[] };
  });

/** Grava o extrato conferido pelo advogado (nada é gravado antes da confirmação). */
export const savePgdasd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveInput) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insert = await supabaseAdmin
      .from("pgdasd_extraido")
      .insert({
        case_id: data.caseId,
        arquivo_original: data.arquivo,
        competencia: data.competencia,
        cnpj_extraido: data.cnpj,
        razao_social_extraida: data.razaoSocial,
        rbt12: data.rbt12,
        receita_bruta_pa: data.receitaBrutaPa,
        anexos: data.anexos as never,
        folha_12_meses: data.folha12Meses,
        valor_total_das: data.valorTotalDas,
        detalhamento_tributos: { tributos: data.tributos } as never,
        status_extracao: data.status,
      })
      .select("*")
      .single();
    if (insert.error) throw new Error(insert.error.message);

    await supabaseAdmin
      .from("case_diagnostic_docs")
      .upsert(
        { case_id: data.caseId, doc_key: "dados_regime", status: "processado" },
        { onConflict: "case_id,doc_key" },
      );

    return { ok: true as const, item: insert.data as unknown as PgdasdRecord };
  });

/** Marca o extrato como já levado ao motor de cálculo. */
export const markPgdasdApplied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("pgdasd_extraido")
      .update({ aplicado_ao_calculo: true })
      .eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const };
  });

/** Remove um extrato gravado. */
export const deletePgdasd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.from("pgdasd_extraido").delete().eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const };
  });
