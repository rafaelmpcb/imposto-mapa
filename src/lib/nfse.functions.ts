import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NfseNota } from "@/lib/nfse/parse";
import {
  FONTE_DOCUMENTO,
  FONTE_DOCUMENTO_EMITIDA,
  creditoPorAliquotas,
  creditoPorNbs,
  type NbsExcecao,
  type OpcaoServico,
  type ServicoItemStatus,
} from "@/lib/nfse/credito";

export type DirecaoServico = "tomado" | "prestado";

const TABELA_ITEM: Record<DirecaoServico, string> = {
  tomado: "nota_servico_nfse_item",
  prestado: "nota_servico_nfse_item_prestado",
};

const COLUNA_VALOR: Record<DirecaoServico, string> = {
  tomado: "valor_credito_ibs_cbs",
  prestado: "valor_debito_ibs_cbs",
};

/**
 * Grava as notas de serviço (tomadas ou prestadas) e apura, item a item,
 * o crédito (compras) ou o débito (vendas) de IBS/CBS.
 */
export const saveNotasServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { caseId: string; notas: NfseNota[]; direcao?: DirecaoServico }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const direcao: DirecaoServico = data.direcao ?? "tomado";
    if (data.notas.length === 0) return { ok: true as const, inserted: 0, itens: 0 };

    const { data: existentes } = await supabaseAdmin
      .from("nota_servico_nfse")
      .select("id,chave_acesso,arquivo_original,direcao")
      .eq("case_id", data.caseId);
    const existentesRows = (existentes ?? []) as {
      id: string;
      chave_acesso: string | null;
      arquivo_original: string;
      direcao: string;
    }[];
    const jaGravadas = new Set(
      existentesRows.map((r) => r.chave_acesso).filter((c): c is string => Boolean(c)),
    );

    const vistas = new Set<string>();
    const notas = data.notas.filter((n) => {
      if (!n.chave) return true;
      if (jaGravadas.has(n.chave) || vistas.has(n.chave)) return false;
      vistas.add(n.chave);
      return true;
    });

    const payload = notas.map((n) => ({
      case_id: data.caseId,
      arquivo_original: n.arquivo.slice(0, 200),
      chave_acesso: n.chave,
      numero_nota: n.numero,
      serie: n.serie,
      cnpj_prestador: n.cnpjPrestador,
      razao_social_prestador: n.razaoSocialPrestador?.slice(0, 200) ?? null,
      cnpj_tomador: n.cnpjTomador,
      razao_social_tomador: n.razaoSocialTomador?.slice(0, 200) ?? null,
      codigo_servico: n.codigoServico,
      regime_prestador: n.regimePrestador,
      direcao,
      valor_total: n.valorTotal,
      data_emissao: n.dataEmissao,
      status_processamento: n.status,
    }));

    let inseridas: unknown[] = [];
    if (payload.length > 0) {
      const ins = await supabaseAdmin
        .from("nota_servico_nfse")
        .insert(payload as never)
        .select("id,chave_acesso,arquivo_original");
      if (ins.error) throw new Error(ins.error.message);
      inseridas = ins.data ?? [];
    }

    // Notas já gravadas na mesma direção também são reprocessadas em reenvios.
    const gravadas = [
      ...existentesRows.filter((n) => n.direcao === direcao),
      ...(inseridas as { id: string; chave_acesso: string | null; arquivo_original: string }[]),
    ];
    const idPorChave = new Map<string, string>();
    const idPorArquivo = new Map<string, string>();
    for (const n of gravadas) {
      if (n.chave_acesso) idPorChave.set(n.chave_acesso, n.id);
      idPorArquivo.set(n.arquivo_original, n.id);
    }

    // tabela de exceções por NBS, só para os serviços sem classificação no documento
    const codigos = [
      ...new Set(
        notas.flatMap((n) =>
          (n.itens ?? [])
            .filter((i) => !i.temClassificacaoDocumento && i.nbs)
            .map((i) => (i.nbs as string).trim()),
        ),
      ),
    ];
    const porNbs = new Map<string, NbsExcecao[]>();
    if (codigos.length > 0) {
      const { data: linhas } = await supabaseAdmin
        .from("nbs_excecao_ibscbs")
        .select(
          "nbs,item_nbs,descricao_nbs,cclasstrib,grupo_cclasstrib,nome_cclasstrib,aliquota_ibs_2026,aliquota_cbs_2026,regime_especifico_sem_aliquota_simples,n_cclasstrib_por_nbs,requer_revisao_humana",
        )
        .in("nbs", codigos);
      for (const linha of (linhas ?? []) as NbsExcecao[]) {
        const list = porNbs.get(linha.nbs) ?? [];
        list.push(linha);
        porNbs.set(linha.nbs, list);
      }
    }

    const colunaValor = COLUNA_VALOR[direcao];
    const fonteDocumento = direcao === "prestado" ? FONTE_DOCUMENTO_EMITIDA : FONTE_DOCUMENTO;

    const itensPayload: Record<string, unknown>[] = [];
    for (const nota of notas) {
      const notaId =
        (nota.chave ? idPorChave.get(nota.chave) : undefined) ??
        idPorArquivo.get(nota.arquivo.slice(0, 200));
      if (!notaId) continue;
      for (const item of nota.itens ?? []) {
        const base = {
          nota_servico_id: notaId,
          case_id: data.caseId,
          nbs: item.nbs,
          item_lc116: item.itemLc116,
          descricao: item.descricao?.slice(0, 300) ?? null,
          valor_servico: item.valorServico,
          tem_classificacao_documento: item.temClassificacaoDocumento,
        };
        if (item.temClassificacaoDocumento) {
          itensPayload.push({
            ...base,
            cclasstrib: item.cclasstrib,
            valor_base_calculo: item.baseCalculo || item.valorServico,
            [colunaValor]: Math.round((item.vCBS + item.vIBSUF + item.vIBSMun) * 100) / 100,
            fonte: fonteDocumento,
            status_classificacao: "ok",
            opcoes_candidatas: [],
          });
          continue;
        }
        const calc = creditoPorNbs(
          item.valorServico,
          item.nbs ? (porNbs.get(item.nbs.trim()) ?? []) : [],
        );
        itensPayload.push({
          ...base,
          cclasstrib: calc.cclasstrib,
          valor_base_calculo: calc.baseCalculo,
          [colunaValor]: calc.credito,
          fonte: calc.fonte,
          status_classificacao: calc.status,
          opcoes_candidatas: calc.opcoes,
        });
      }
    }

    if (itensPayload.length > 0) {
      const ins = await supabaseAdmin
        .from(TABELA_ITEM[direcao] as "nota_servico_nfse_item")
        .insert(itensPayload as never);
      if (ins.error) throw new Error(ins.error.message);
    }

    return { ok: true as const, inserted: payload.length, itens: itensPayload.length };
  });

export interface CreditoServicoItem {
  id: string;
  nbs: string | null;
  item_lc116: string | null;
  descricao: string | null;
  valor_servico: number;
  tem_classificacao_documento: boolean;
  cclasstrib: string | null;
  valor_credito_ibs_cbs: number;
  fonte: string;
  status_classificacao: ServicoItemStatus;
  opcoes_candidatas: OpcaoServico[];
  nota_servico_id: string;
  prestador: string | null;
  cnpj_prestador: string | null;
  nota_numero: string | null;
}

export interface DebitoServicoItem {
  id: string;
  nbs: string | null;
  item_lc116: string | null;
  descricao: string | null;
  valor_servico: number;
  tem_classificacao_documento: boolean;
  cclasstrib: string | null;
  valor_debito_ibs_cbs: number;
  fonte: string;
  status_classificacao: ServicoItemStatus;
  opcoes_candidatas: OpcaoServico[];
  nota_servico_id: string;
  tomador: string | null;
  cnpj_tomador: string | null;
  nota_numero: string | null;
}

/** Itens de crédito de serviços tomados do Caso, com o prestador de origem. */
export const getCreditoServicoItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: itens } = await supabaseAdmin
      .from("nota_servico_nfse_item")
      .select("*")
      .eq("case_id", data.caseId);
    const lista = (itens ?? []) as Record<string, unknown>[];
    const notaIds = [...new Set(lista.map((i) => String(i["nota_servico_id"])))];
    const notas = new Map<
      string,
      { nome: string | null; cnpj: string | null; numero: string | null }
    >();
    if (notaIds.length > 0) {
      const { data: notasData } = await supabaseAdmin
        .from("nota_servico_nfse")
        .select("id,razao_social_prestador,cnpj_prestador,numero_nota")
        .in("id", notaIds);
      for (const n of (notasData ?? []) as {
        id: string;
        razao_social_prestador: string | null;
        cnpj_prestador: string | null;
        numero_nota: string | null;
      }[]) {
        notas.set(n.id, {
          nome: n.razao_social_prestador,
          cnpj: n.cnpj_prestador,
          numero: n.numero_nota,
        });
      }
    }
    const rows: CreditoServicoItem[] = lista.map((i) => {
      const nota = notas.get(String(i["nota_servico_id"]));
      return {
        id: String(i["id"]),
        nbs: (i["nbs"] as string | null) ?? null,
        item_lc116: (i["item_lc116"] as string | null) ?? null,
        descricao: (i["descricao"] as string | null) ?? null,
        valor_servico: Number(i["valor_servico"] ?? 0),
        tem_classificacao_documento: Boolean(i["tem_classificacao_documento"]),
        cclasstrib: (i["cclasstrib"] as string | null) ?? null,
        valor_credito_ibs_cbs: Number(i["valor_credito_ibs_cbs"] ?? 0),
        fonte: String(i["fonte"] ?? ""),
        status_classificacao:
          (i["status_classificacao"] as ServicoItemStatus) ?? "sem_dado",
        opcoes_candidatas: (i["opcoes_candidatas"] as OpcaoServico[]) ?? [],
        nota_servico_id: String(i["nota_servico_id"]),
        prestador: nota?.nome ?? null,
        cnpj_prestador: nota?.cnpj ?? null,
        nota_numero: nota?.numero ?? null,
      };
    });
    return { ok: true as const, itens: rows };
  });

/** Itens de débito de serviços prestados pelo Caso, com o tomador de destino. */
export const getDebitoServicoItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: itens } = await supabaseAdmin
      .from("nota_servico_nfse_item_prestado" as "nota_servico_nfse_item")
      .select("*")
      .eq("case_id", data.caseId);
    const lista = (itens ?? []) as Record<string, unknown>[];
    const notaIds = [...new Set(lista.map((i) => String(i["nota_servico_id"])))];
    const notas = new Map<
      string,
      { nome: string | null; cnpj: string | null; numero: string | null }
    >();
    if (notaIds.length > 0) {
      const { data: notasData } = await supabaseAdmin
        .from("nota_servico_nfse")
        .select("id,razao_social_tomador,cnpj_tomador,numero_nota")
        .in("id", notaIds);
      for (const n of (notasData ?? []) as {
        id: string;
        razao_social_tomador: string | null;
        cnpj_tomador: string | null;
        numero_nota: string | null;
      }[]) {
        notas.set(n.id, {
          nome: n.razao_social_tomador,
          cnpj: n.cnpj_tomador,
          numero: n.numero_nota,
        });
      }
    }
    const rows: DebitoServicoItem[] = lista.map((i) => {
      const nota = notas.get(String(i["nota_servico_id"]));
      return {
        id: String(i["id"]),
        nbs: (i["nbs"] as string | null) ?? null,
        item_lc116: (i["item_lc116"] as string | null) ?? null,
        descricao: (i["descricao"] as string | null) ?? null,
        valor_servico: Number(i["valor_servico"] ?? 0),
        tem_classificacao_documento: Boolean(i["tem_classificacao_documento"]),
        cclasstrib: (i["cclasstrib"] as string | null) ?? null,
        valor_debito_ibs_cbs: Number(i["valor_debito_ibs_cbs"] ?? 0),
        fonte: String(i["fonte"] ?? ""),
        status_classificacao:
          (i["status_classificacao"] as ServicoItemStatus) ?? "sem_dado",
        opcoes_candidatas: (i["opcoes_candidatas"] as OpcaoServico[]) ?? [],
        nota_servico_id: String(i["nota_servico_id"]),
        tomador: nota?.nome ?? null,
        cnpj_tomador: nota?.cnpj ?? null,
        nota_numero: nota?.numero ?? null,
      };
    });
    return { ok: true as const, itens: rows };
  });

/** Decisão do analista para um serviço com classificação ambígua. */
export const resolverServicoAmbiguo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      cclasstrib: string | null;
      nome: string;
      ibsPct: number;
      cbsPct: number;
      direcao?: DirecaoServico;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const direcao: DirecaoServico = data.direcao ?? "tomado";
    const tabela = TABELA_ITEM[direcao] as "nota_servico_nfse_item";
    const colunaValor = COLUNA_VALOR[direcao];

    const { data: item } = await supabaseAdmin
      .from(tabela)
      .select("valor_servico")
      .eq("id", data.itemId)
      .maybeSingle();
    const valor = Number((item as { valor_servico?: number } | null)?.valor_servico ?? 0);
    const apurado = creditoPorAliquotas(valor, data.ibsPct, data.cbsPct);
    const { error } = await supabaseAdmin
      .from(tabela)
      .update({
        cclasstrib: data.cclasstrib,
        valor_base_calculo: valor,
        [colunaValor]: apurado,
        fonte: `revisão do analista — ${data.nome.slice(0, 120)}`,
        status_classificacao: "ok",
      } as never)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const, credito: apurado };
  });

/* ------------------------------------------------------------------ *
 * Composição de carteira a partir das NFS-e Nacionais
 * ------------------------------------------------------------------ */

export const FONTE_NFSE_DOCUMENTO = "NFS-e Nacional — regime do prestador (documento)";
export const FONTE_NFSE_PRESTADOR_BRASILAPI = "NFS-e Nacional (prestador) — BrasilAPI";
export const FONTE_NFSE_PRESTADOR_CNPJA = "NFS-e Nacional (prestador) — CNPJá (reserva)";
export const FONTE_NFSE_TOMADOR_BRASILAPI = "NFS-e Nacional (tomador) — BrasilAPI";
export const FONTE_NFSE_TOMADOR_CNPJA = "NFS-e Nacional (tomador) — CNPJá (reserva)";

/** Classifica o regime das contrapartes de serviço (BrasilAPI, com CNPJá de reserva). */
export const classifyContrapartesServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnpjs: string[]; lado: DirecaoServico }) => input)
  .handler(async ({ data }) => {
    const { classifyMany, FONTE_BRASILAPI } = await import("@/lib/carteira/classify.server");
    const results = await classifyMany(data.cnpjs.slice(0, 12), {
      concurrency: 4,
      maxFallback: 4,
    });
    const viaBrasilApi =
      data.lado === "tomado" ? FONTE_NFSE_PRESTADOR_BRASILAPI : FONTE_NFSE_TOMADOR_BRASILAPI;
    const viaCnpja =
      data.lado === "tomado" ? FONTE_NFSE_PRESTADOR_CNPJA : FONTE_NFSE_TOMADOR_CNPJA;
    return {
      ok: true as const,
      results: results.map((r) => ({
        cnpj: r.cnpj,
        regime: r.regime,
        status: r.status,
        fonte: r.regime === "erro" ? "" : r.fonte === FONTE_BRASILAPI ? viaBrasilApi : viaCnpja,
      })),
    };
  });

/** CNPJs já existentes na composição, por tipo (para avisar antes de gravar). */
export const getContrapartesExistentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; tipo: "cliente" | "fornecedor" }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("composicao_carteira")
      .select("cnpj")
      .eq("case_id", data.caseId)
      .eq("tipo", data.tipo);
    return { ok: true as const, cnpjs: ((rows ?? []) as { cnpj: string }[]).map((r) => r.cnpj) };
  });

/** Grava na composição de carteira as contrapartes conferidas vindas de NFS-e. */
export const applyNotasServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      tipo: "cliente" | "fornecedor";
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
    if (data.rows.length === 0) return { ok: true as const, inserted: 0, ignorados: 0 };
    const cnpjs = data.rows.map((r) => r.cnpj);

    const existing = await supabaseAdmin
      .from("composicao_carteira")
      .select("id,cnpj")
      .eq("case_id", data.caseId)
      .eq("tipo", data.tipo)
      .in("cnpj", cnpjs);
    const existentes = new Set(((existing.data ?? []) as { cnpj: string }[]).map((r) => r.cnpj));

    if (data.substituir && existentes.size > 0) {
      await supabaseAdmin
        .from("composicao_carteira")
        .delete()
        .eq("case_id", data.caseId)
        .eq("tipo", data.tipo)
        .in("cnpj", [...existentes]);
    }

    const processadoEm = new Date().toISOString();
    const payload = data.rows
      .filter((r) => data.substituir || !existentes.has(r.cnpj))
      .map((r) => ({
        case_id: data.caseId,
        nome: r.nome.slice(0, 200),
        cnpj: r.cnpj,
        tipo: data.tipo,
        valor_movimentado: r.valor,
        regime: r.regime === "erro" ? ("pendente" as const) : r.regime,
        status_consulta: r.regime === "erro" ? ("pendente" as const) : ("ok" as const),
        fonte_classificacao: r.fonte || FONTE_NFSE_DOCUMENTO,
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
      .from("nota_servico_nfse")
      .update({ aplicado_composicao_carteira: true } as never)
      .eq("case_id", data.caseId)
      .eq("direcao", data.tipo === "fornecedor" ? "tomado" : "prestado");

    return {
      ok: true as const,
      inserted: payload.length,
      ignorados: data.rows.length - payload.length,
    };
  });
