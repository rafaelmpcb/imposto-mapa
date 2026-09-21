import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NfeVendaNota } from "@/lib/nfe/parse-venda";

export const FONTE_VENDA_BRASILAPI = "XML de NF-e (dest) — BrasilAPI";
export const FONTE_VENDA_CNPJA = "XML de NF-e (dest) — CNPJá (reserva)";

/** Grava as notas de venda lidas do XML (ignora chaves já registradas no Caso). */
export const saveNotasVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; notas: NfeVendaNota[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.notas.length === 0) return { ok: true as const, inserted: 0 };

    const { data: existentes } = await supabaseAdmin
      .from("nota_fiscal_venda_xml")
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
        cnpj_destinatario: n.cnpjDestinatario,
        razao_social_destinatario: n.razaoSocialDestinatario?.slice(0, 200) ?? null,
        valor_total: n.valorTotal,
        data_emissao: n.dataEmissao,
        status_processamento: n.status,
      }));

    if (payload.length === 0) return { ok: true as const, inserted: 0 };
    const { error } = await supabaseAdmin
      .from("nota_fiscal_venda_xml")
      .insert(payload as never);
    if (error) throw new Error(error.message);
    return { ok: true as const, inserted: payload.length };
  });

/** Classifica um lote de CNPJs de clientes (BrasilAPI, com CNPJá de reserva). */
export const classifyClientesVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnpjs: string[] }) => input)
  .handler(async ({ data }) => {
    const { classifyMany, FONTE_BRASILAPI } = await import("@/lib/carteira/classify.server");
    const results = await classifyMany(data.cnpjs.slice(0, 12), {
      concurrency: 4,
      maxFallback: 4,
    });
    return {
      ok: true as const,
      results: results.map((r) => ({
        cnpj: r.cnpj,
        regime: r.regime,
        status: r.status,
        fonte:
          r.regime === "erro"
            ? ""
            : r.fonte === FONTE_BRASILAPI
              ? FONTE_VENDA_BRASILAPI
              : FONTE_VENDA_CNPJA,
      })),
    };
  });

/** CNPJs de clientes já existentes na composição (para avisar antes de gravar). */
export const getClientesExistentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("composicao_carteira")
      .select("cnpj")
      .eq("case_id", data.caseId)
      .eq("tipo", "cliente");
    return { ok: true as const, cnpjs: ((rows ?? []) as { cnpj: string }[]).map((r) => r.cnpj) };
  });

/** Grava os clientes conferidos na composição de carteira. */
export const applyNotasVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      rows: {
        cnpj: string;
        nome: string;
        valor: number;
        regime: "simples" | "regular" | "erro";
        fonte: string;
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
      .eq("tipo", "cliente")
      .in("cnpj", cnpjs);
    const existentes = new Set(((existing.data ?? []) as { cnpj: string }[]).map((r) => r.cnpj));

    if (data.substituir && existentes.size > 0) {
      await supabaseAdmin
        .from("composicao_carteira")
        .delete()
        .eq("case_id", data.caseId)
        .eq("tipo", "cliente")
        .in("cnpj", [...existentes]);
    }

    const processadoEm = new Date().toISOString();
    const payload = data.rows
      .filter((r) => data.substituir || !existentes.has(r.cnpj))
      .map((r) => ({
        case_id: data.caseId,
        nome: r.nome.slice(0, 200),
        cnpj: r.cnpj,
        tipo: "cliente" as const,
        valor_movimentado: r.valor,
        regime: r.regime === "erro" ? ("pendente" as const) : r.regime,
        status_consulta: r.regime === "erro" ? ("pendente" as const) : ("ok" as const),
        fonte_classificacao: r.fonte || FONTE_VENDA_BRASILAPI,
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
      .from("nota_fiscal_venda_xml")
      .update({ aplicado_composicao_carteira: true } as never)
      .eq("case_id", data.caseId);

    return {
      ok: true as const,
      inserted: payload.length,
      ignorados: data.rows.length - payload.length,
    };
  });
