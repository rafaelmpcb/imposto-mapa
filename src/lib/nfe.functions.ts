import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NfeNota } from "@/lib/nfe/parse";

export interface NfeClassificacao {
  cnpj: string;
  regime: "simples" | "regular" | "erro";
  status: "ok" | "nao_encontrado" | "erro";
  fonte: string;
  updated: string | null;
}

/** Grava as notas lidas do XML (ignora chaves já registradas no Caso). */
export const saveNotasCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; notas: NfeNota[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.notas.length === 0) return { ok: true as const, inserted: 0 };

    // O índice de unicidade é parcial (só quando há chave), então o upsert por
    // ON CONFLICT não é aceito: filtramos as chaves já gravadas manualmente.
    const { data: existentes } = await supabaseAdmin
      .from("nota_fiscal_compra_xml")
      .select("chave_acesso")
      .eq("case_id", data.caseId);
    const jaGravadas = new Set(
      ((existentes ?? []) as { chave_acesso: string | null }[])
        .map((r) => r.chave_acesso)
        .filter((c): c is string => Boolean(c)),
    );

    const vistas = new Set<string>();
    const payload = data.notas
      .filter((n) => {
        if (!n.chave) return true;
        if (jaGravadas.has(n.chave) || vistas.has(n.chave)) return false;
        vistas.add(n.chave);
        return true;
      })
      .map((n) => ({
        case_id: data.caseId,
        arquivo_original: n.arquivo.slice(0, 200),
        chave_acesso: n.chave,
        numero_nota: n.numero,
        serie: n.serie,
        cnpj_emitente: n.cnpjEmitente,
        razao_social_emitente: n.razaoSocialEmitente?.slice(0, 200) ?? null,
        valor_total: n.valorTotal,
        data_emissao: n.dataEmissao,
        regime_emitente: n.regime,
        status_processamento: n.status,
      }));

    if (payload.length === 0) return { ok: true as const, inserted: 0 };
    const { error } = await supabaseAdmin
      .from("nota_fiscal_compra_xml")
      .insert(payload as never);
    if (error) throw new Error(error.message);
    return { ok: true as const, inserted: payload.length };
  });


/** Grava as contrapartes conferidas na composição de carteira, como fornecedores. */
export const applyNotasCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      rows: {
        cnpj: string;
        nome: string;
        valor: number;
        regime: "simples" | "regular" | "erro";
      }[];
      substituir: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cnpjs = data.rows.map((r) => r.cnpj);

    const existing = await supabaseAdmin
      .from("composicao_carteira")
      .select("id,cnpj")
      .eq("case_id", data.caseId)
      .eq("tipo", "fornecedor")
      .in("cnpj", cnpjs);
    const existentes = new Set(
      ((existing.data ?? []) as { cnpj: string }[]).map((r) => r.cnpj),
    );

    if (data.substituir && existentes.size > 0) {
      await supabaseAdmin
        .from("composicao_carteira")
        .delete()
        .eq("case_id", data.caseId)
        .eq("tipo", "fornecedor")
        .in("cnpj", [...existentes]);
    }

    const processadoEm = new Date().toISOString();
    const payload = data.rows
      .filter((r) => data.substituir || !existentes.has(r.cnpj))
      .map((r) => ({
        case_id: data.caseId,
        nome: r.nome.slice(0, 200),
        cnpj: r.cnpj,
        tipo: "fornecedor" as const,
        valor_movimentado: r.valor,
        regime: r.regime === "erro" ? ("pendente" as const) : r.regime,
        status_consulta: r.regime === "erro" ? ("pendente" as const) : ("ok" as const),
        fonte_classificacao: "XML de NF-e — CRT do emitente",
        data_classificacao: processadoEm,
      }));

    if (payload.length > 0) {
      const ins = await supabaseAdmin.from("composicao_carteira").insert(payload as never);
      if (ins.error) throw new Error(ins.error.message);
    }

    // recalcula os percentuais por tipo
    const { data: allRows } = await supabaseAdmin
      .from("composicao_carteira")
      .select("id,tipo,valor_movimentado")
      .eq("case_id", data.caseId);
    const rows = (allRows ?? []) as { id: string; tipo: string; valor_movimentado: number }[];
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.tipo, (totals.get(r.tipo) ?? 0) + Number(r.valor_movimentado));
    }
    await Promise.all(
      rows.map((r) => {
        const total = totals.get(r.tipo) ?? 0;
        const pct = total > 0 ? (Number(r.valor_movimentado) / total) * 100 : 0;
        return supabaseAdmin
          .from("composicao_carteira")
          .update({ percentual_carteira: Math.round(pct * 10000) / 10000 } as never)
          .eq("id", r.id);
      }),
    );

    await supabaseAdmin
      .from("case_diagnostic_docs")
      .upsert(
        { case_id: data.caseId, doc_key: "composicao_carteira", status: "processado" } as never,
        { onConflict: "case_id,doc_key" },
      );

    await supabaseAdmin
      .from("nota_fiscal_compra_xml")
      .update({ aplicado_composicao_carteira: true } as never)
      .eq("case_id", data.caseId);

    return { ok: true as const, inserted: payload.length, ignorados: data.rows.length - payload.length };
  });

/** CNPJs de fornecedores já existentes na composição (para avisar antes de gravar). */
export const getFornecedoresExistentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("composicao_carteira")
      .select("cnpj")
      .eq("case_id", data.caseId)
      .eq("tipo", "fornecedor");
    return { ok: true as const, cnpjs: ((rows ?? []) as { cnpj: string }[]).map((r) => r.cnpj) };
  });
