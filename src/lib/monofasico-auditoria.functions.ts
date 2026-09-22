import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CatalogoNcmMonofasico,
  ClassificacaoMonofasica,
  ItemClassificado,
} from "@/lib/monofasico/auditoria";

/** Catálogo público de NCMs monofásicos (leitura anônima permitida). */
export const listarCatalogoMonofasico = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("ncm_monofasico_pis_cofins")
    .select("ncm_prefixo, descricao, grupo, cst_esperado, cst_alternativos, base_legal, observacao")
    .order("grupo", { ascending: true });
  if (error) throw new Error(error.message);
  const linhas: CatalogoNcmMonofasico[] = (data ?? []).map((r: Record<string, unknown>) => ({
    ncmPrefixo: String(r["ncm_prefixo"] ?? ""),
    descricao: String(r["descricao"] ?? ""),
    grupo: String(r["grupo"] ?? ""),
    cstEsperado: String(r["cst_esperado"] ?? "04"),
    cstAlternativos: (r["cst_alternativos"] as string[] | null) ?? ["04", "06"],
    baseLegal: String(r["base_legal"] ?? ""),
    observacao: (r["observacao"] as string | null) ?? null,
  }));
  return { ok: true as const, linhas };
});

export interface SalvarAuditoriaInput {
  caseId: string;
  regime: string;
  itens: ItemClassificado[];
}

/** Substitui a auditoria monofásica gravada no Caso pelos itens conferidos. */
export const salvarAuditoriaMonofasica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SalvarAuditoriaInput) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("caso_monofasico_item")
      .delete()
      .eq("case_id", data.caseId);
    if (delErr) throw new Error(delErr.message);

    const rows = data.itens.map((i) => ({
      case_id: data.caseId,
      arquivo_original: i.arquivo,
      chave_acesso: i.chave,
      modelo: i.modelo,
      numero_nota: i.numero,
      data_emissao: i.dataEmissao,
      competencia: i.competencia,
      ncm: i.ncm,
      cfop: i.cfop,
      descricao: i.descricao,
      valor_item: i.valorItem,
      cst_pis: i.cstPis,
      cst_cofins: i.cstCofins,
      valor_pis: i.valorPis,
      valor_cofins: i.valorCofins,
      grupo: i.grupo,
      classificacao: i.classificacao,
      regime: data.regime,
      indebito_estimado: i.indebitoEstimado,
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("caso_monofasico_item")
        .insert(rows.slice(i, i + 500) as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const, gravados: rows.length };
  });

export const listarAuditoriaMonofasica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("caso_monofasico_item")
      .select("*")
      .eq("case_id", data.caseId)
      .order("data_emissao", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    const itens: ItemClassificado[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      arquivo: String(r["arquivo_original"] ?? ""),
      chave: (r["chave_acesso"] as string | null) ?? null,
      modelo: (r["modelo"] as string | null) ?? null,
      numero: (r["numero_nota"] as string | null) ?? null,
      dataEmissao: (r["data_emissao"] as string | null) ?? null,
      competencia: (r["competencia"] as string | null) ?? null,
      ncm: (r["ncm"] as string | null) ?? null,
      cfop: (r["cfop"] as string | null) ?? null,
      descricao: (r["descricao"] as string | null) ?? null,
      valorItem: Number(r["valor_item"] ?? 0) || 0,
      cstPis: (r["cst_pis"] as string | null) ?? null,
      cstCofins: (r["cst_cofins"] as string | null) ?? null,
      valorPis: Number(r["valor_pis"] ?? 0) || 0,
      valorCofins: Number(r["valor_cofins"] ?? 0) || 0,
      grupo: (r["grupo"] as string | null) ?? null,
      baseLegal: null,
      classificacao: String(r["classificacao"] ?? "nao_monofasico") as ClassificacaoMonofasica,
      indebitoEstimado: Number(r["indebito_estimado"] ?? 0) || 0,
    }));
    return { ok: true as const, itens };
  });
