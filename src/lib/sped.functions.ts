import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SpedArquivo, SpedContribResumo, SpedIcmsResumo, SpedTipo } from "@/lib/sped/parse";

export interface SpedRegistro {
  id: string;
  tipo: SpedTipo;
  cnpj: string | null;
  razao_social: string | null;
  periodo_ini: string;
  periodo_fim: string;
  retificadora: boolean;
  arquivo: string;
  resumo: SpedIcmsResumo | SpedContribResumo;
}

export interface SpedConferenciaMes {
  mes: string; // YYYY-MM
  xmlVendasNfe: number;
  xmlNfsePrestado: number;
  xmlCompras: number;
}

/** Grava os resumos lidos; reenvio do mesmo período/CNPJ substitui (retificadora). */
export const saveSped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; itens: SpedArquivo[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.itens.slice(0, 500).map((i) => ({
      case_id: data.caseId,
      tipo: i.tipo,
      cnpj: i.cnpj ?? "",
      razao_social: i.razaoSocial,
      periodo_ini: i.periodoIni,
      periodo_fim: i.periodoFim,
      retificadora: i.retificadora,
      arquivo: i.arquivo,
      resumo: i.resumo as never,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return { ok: true as const, gravados: 0 };
    const res = await supabaseAdmin
      .from("sped_apuracao" as never)
      .upsert(rows as never, { onConflict: "case_id,tipo,cnpj,periodo_ini" });
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const, gravados: rows.length };
  });

export const removeSped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("sped_apuracao" as never)
      .delete()
      .eq("case_id" as never, data.caseId as never)
      .eq("id" as never, data.id as never);
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const };
  });

/** Lista os SPEDs do Caso e os totais mensais dos XMLs para conferência. */
export const listSped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("sped_apuracao" as never)
      .select("id,tipo,cnpj,razao_social,periodo_ini,periodo_fim,retificadora,arquivo,resumo")
      .eq("case_id" as never, data.caseId as never)
      .order("periodo_ini" as never, { ascending: true });
    if (res.error) throw new Error(res.error.message);
    const itens = (res.data ?? []) as unknown as SpedRegistro[];

    const meses = new Map<string, SpedConferenciaMes>();
    const mes = (m: string) => {
      let x = meses.get(m);
      if (!x) {
        x = { mes: m, xmlVendasNfe: 0, xmlNfsePrestado: 0, xmlCompras: 0 };
        meses.set(m, x);
      }
      return x;
    };
    const todas = async (tabela: string, cols: string) => {
      const out: Record<string, unknown>[] = [];
      for (let de = 0; ; de += 1000) {
        const r = await supabaseAdmin
          .from(tabela as never)
          .select(cols)
          .eq("case_id" as never, data.caseId as never)
          .eq("status_processamento" as never, "ok" as never)
          .range(de, de + 999);
        if (r.error) throw new Error(r.error.message);
        const lote = (r.data ?? []) as unknown as Record<string, unknown>[];
        out.push(...lote);
        if (lote.length < 1000) break;
      }
      return out;
    };
    if (itens.length > 0) {
      const [vendas, compras, nfse] = await Promise.all([
        todas("nota_fiscal_venda_xml", "valor_total,data_emissao"),
        todas("nota_fiscal_compra_xml", "valor_total,data_emissao"),
        todas("nota_servico_nfse", "valor_total,data_emissao,direcao"),
      ]);
      const m = (r: Record<string, unknown>) => String(r["data_emissao"] ?? "").slice(0, 7);
      const v = (r: Record<string, unknown>) => Number(r["valor_total"] ?? 0);
      for (const r of vendas) if (m(r)) mes(m(r)).xmlVendasNfe += v(r);
      for (const r of compras) if (m(r)) mes(m(r)).xmlCompras += v(r);
      for (const r of nfse) if (m(r) && r["direcao"] === "prestado") mes(m(r)).xmlNfsePrestado += v(r);
    }
    return { ok: true as const, itens, conferencia: [...meses.values()] };
  });
