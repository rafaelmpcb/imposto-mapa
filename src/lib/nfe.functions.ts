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

    if (payload.length === 0) return { ok: true as const, inserted: 0, itens: 0 };
    const { data: inseridas, error } = await supabaseAdmin
      .from("nota_fiscal_compra_xml")
      .insert(payload as never)
      .select("id,chave_acesso,arquivo_original");
    if (error) throw new Error(error.message);

    // --- itens da nota: crédito de IBS/CBS apurado item a item ---
    const notasGravadas = (inseridas ?? []) as {
      id: string;
      chave_acesso: string | null;
      arquivo_original: string;
    }[];
    const idPorChave = new Map<string, string>();
    const idPorArquivo = new Map<string, string>();
    for (const n of notasGravadas) {
      if (n.chave_acesso) idPorChave.set(n.chave_acesso, n.id);
      idPorArquivo.set(n.arquivo_original, n.id);
    }

    const notasComItens = data.notas.filter((n) => (n.itens?.length ?? 0) > 0);
    const ncms = [
      ...new Set(
        notasComItens.flatMap((n) =>
          (n.itens ?? []).filter((i) => !i.temIbscbs && i.ncm).map((i) => i.ncm as string),
        ),
      ),
    ];
    const excecoesPorNcm = new Map<string, NcmExcecao[]>();
    if (ncms.length > 0) {
      const { data: excecoes } = await supabaseAdmin
        .from("ncm_excecao_ibscbs")
        .select("ncm,anexo,anexo_desc,cclasstrib,reducao_pct,imposto_seletivo,n_classificacoes_ncm,requer_revisao_humana")
        .in("ncm", ncms);
      for (const linha of (excecoes ?? []) as NcmExcecao[]) {
        const list = excecoesPorNcm.get(linha.ncm) ?? [];
        list.push(linha);
        excecoesPorNcm.set(linha.ncm, list);
      }
    }

    const itensPayload: Record<string, unknown>[] = [];
    for (const nota of notasComItens) {
      const notaId =
        (nota.chave ? idPorChave.get(nota.chave) : undefined) ??
        idPorArquivo.get(nota.arquivo.slice(0, 200));
      if (!notaId) continue;
      for (const item of nota.itens ?? []) {
        const base = {
          nota_fiscal_compra_xml_id: notaId,
          case_id: data.caseId,
          ncm: item.ncm,
          cfop: item.cfop,
          descricao: item.descricao?.slice(0, 300) ?? null,
          quantidade: item.quantidade,
          valor_item: item.valorItem,
          tem_ibscbs: item.temIbscbs,
        };
        if (item.temIbscbs) {
          itensPayload.push({
            ...base,
            cclasstrib: item.cclasstrib,
            valor_base_calculo: item.baseCalculo || item.valorItem,
            valor_credito_ibs_cbs:
              Math.round((item.vCBS + item.vIBSUF + item.vIBSMun) * 100) / 100,
            fonte: FONTE_XML,
            status_classificacao: "ok",
            opcoes_candidatas: [],
          });
          continue;
        }
        const calc = creditoPorNcm(
          item.valorItem,
          item.descricao,
          item.ncm ? (excecoesPorNcm.get(item.ncm) ?? []) : [],
        );
        itensPayload.push({
          ...base,
          cclasstrib: calc.cclasstrib,
          valor_base_calculo: calc.baseCalculo,
          valor_credito_ibs_cbs: calc.credito,
          fonte: calc.fonte,
          status_classificacao: calc.status,
          opcoes_candidatas: calc.opcoes,
        });
      }
    }

    if (itensPayload.length > 0) {
      const insItens = await supabaseAdmin
        .from("nota_fiscal_compra_xml_item")
        .insert(itensPayload as never);
      if (insItens.error) throw new Error(insItens.error.message);
    }

    return { ok: true as const, inserted: payload.length, itens: itensPayload.length };
  });

export interface CreditoItem {
  id: string;
  ncm: string | null;
  cfop: string | null;
  descricao: string | null;
  quantidade: number;
  valor_item: number;
  tem_ibscbs: boolean;
  cclasstrib: string | null;
  valor_credito_ibs_cbs: number;
  fonte: string;
  status_classificacao: ItemStatus;
  opcoes_candidatas: OpcaoCandidata[];
  nota_fiscal_compra_xml_id: string;
  fornecedor: string | null;
  cnpj_fornecedor: string | null;
  nota_numero: string | null;
}

/** Itens de crédito apurados no Caso, com o fornecedor de origem. */
export const getCreditoItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: itens } = await supabaseAdmin
      .from("nota_fiscal_compra_xml_item")
      .select("*")
      .eq("case_id", data.caseId);
    const lista = (itens ?? []) as Record<string, unknown>[];
    const notaIds = [
      ...new Set(lista.map((i) => String(i["nota_fiscal_compra_xml_id"]))),
    ];
    const notas = new Map<string, { nome: string | null; cnpj: string | null; numero: string | null }>();
    if (notaIds.length > 0) {
      const { data: notasData } = await supabaseAdmin
        .from("nota_fiscal_compra_xml")
        .select("id,razao_social_emitente,cnpj_emitente,numero_nota")
        .in("id", notaIds);
      for (const n of (notasData ?? []) as {
        id: string;
        razao_social_emitente: string | null;
        cnpj_emitente: string | null;
        numero_nota: string | null;
      }[]) {
        notas.set(n.id, {
          nome: n.razao_social_emitente,
          cnpj: n.cnpj_emitente,
          numero: n.numero_nota,
        });
      }
    }
    const rows: CreditoItem[] = lista.map((i) => {
      const nota = notas.get(String(i["nota_fiscal_compra_xml_id"]));
      return {
        id: String(i["id"]),
        ncm: (i["ncm"] as string | null) ?? null,
        cfop: (i["cfop"] as string | null) ?? null,
        descricao: (i["descricao"] as string | null) ?? null,
        quantidade: Number(i["quantidade"] ?? 0),
        valor_item: Number(i["valor_item"] ?? 0),
        tem_ibscbs: Boolean(i["tem_ibscbs"]),
        cclasstrib: (i["cclasstrib"] as string | null) ?? null,
        valor_credito_ibs_cbs: Number(i["valor_credito_ibs_cbs"] ?? 0),
        fonte: String(i["fonte"] ?? ""),
        status_classificacao: (i["status_classificacao"] as ItemStatus) ?? "sem_dado",
        opcoes_candidatas: (i["opcoes_candidatas"] as OpcaoCandidata[]) ?? [],
        nota_fiscal_compra_xml_id: String(i["nota_fiscal_compra_xml_id"]),
        fornecedor: nota?.nome ?? null,
        cnpj_fornecedor: nota?.cnpj ?? null,
        nota_numero: nota?.numero ?? null,
      };
    });
    return { ok: true as const, itens: rows };
  });

/** Decisão do analista para um item com classificação ambígua. */
export const resolverItemAmbiguo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      anexo: string;
      cclasstrib: string | null;
      reducaoPct: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("nota_fiscal_compra_xml_item")
      .select("valor_item")
      .eq("id", data.itemId)
      .maybeSingle();
    const valor = Number((item as { valor_item?: number } | null)?.valor_item ?? 0);
    const credito = creditoComReducao(valor, data.reducaoPct);
    const { error } = await supabaseAdmin
      .from("nota_fiscal_compra_xml_item")
      .update({
        cclasstrib: data.cclasstrib,
        valor_credito_ibs_cbs: credito,
        valor_base_calculo: valor,
        fonte: `revisão do analista — ${data.anexo} (${data.reducaoPct}%)`,
        status_classificacao: "ok",
      } as never)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const, credito };
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
