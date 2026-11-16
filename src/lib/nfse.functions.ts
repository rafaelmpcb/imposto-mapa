import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filtrarNotasDuplicadas } from "@/lib/carga/dedup";
import { registrarDuplicados } from "@/lib/carga/duplicados";
import { aggregateNfse } from "@/lib/nfse/parse";
import { fetchAllRows } from "@/lib/supabase-paginate";
import type { NfseNota, NfseServicoItem } from "@/lib/nfse/parse";
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

/** Chave de negócio para deduplicar NFS-e sem chave de acesso nacional. */
function chaveCompostaServico(
  cnpjPrestador: string | null,
  serie: string | null,
  numero: string | null,
): string | null {
  if (!numero) return null;
  return `${cnpjPrestador ?? ""}|${serie ?? ""}|${numero}`;
}

/** Agrupa por prestador + tomador + dia de emissão (sem hora). */
function chaveCorrespondenciaServico(nota: NfseNota): string | null {
  if (!nota.cnpjPrestador || !nota.cnpjTomador || !nota.dataEmissao) return null;
  return `${nota.cnpjPrestador}|${nota.cnpjTomador}|${nota.dataEmissao.slice(0, 10)}`;
}

/**
 * Quando a mesma nota existe em layout municipal legado e em NFS-e Nacional
 * (mesmo prestador, tomador e dia de emissão), descarta a municipal: a
 * nacional é o padrão que todos os municípios estão migrando para adotar, e
 * os dois formatos nunca deveriam entrar como duas notas separadas — além de
 * terem numeração interna que não bate entre si, trazem valores diferentes
 * (bruto no municipal vs líquido na nacional) para a mesma operação.
 * Uma nota municipal sem par nacional no lote é mantida normalmente.
 */
function preferirNacional(notas: NfseNota[]): { mantidas: NfseNota[]; descartadas: NfseNota[] } {
  const gruposComNacional = new Set<string>();
  for (const n of notas) {
    if (!n.formatoNacional) continue;
    const chave = chaveCorrespondenciaServico(n);
    if (chave) gruposComNacional.add(chave);
  }
  const mantidas: NfseNota[] = [];
  const descartadas: NfseNota[] = [];
  for (const n of notas) {
    const chave = !n.formatoNacional ? chaveCorrespondenciaServico(n) : null;
    if (chave && gruposComNacional.has(chave)) descartadas.push(n);
    else mantidas.push(n);
  }
  return { mantidas, descartadas };
}

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

    // Paginado: o servidor devolve no máximo 1000 linhas por consulta.
    const existentesRows: {
      id: string;
      chave_acesso: string | null;
      numero_nota: string | null;
      serie: string | null;
      cnpj_prestador: string | null;
      arquivo_original: string;
      direcao: string;
    }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: pagina, error } = await supabaseAdmin
        .from("nota_servico_nfse")
        .select("id,chave_acesso,numero_nota,serie,cnpj_prestador,arquivo_original,direcao")
        .eq("case_id", data.caseId)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      existentesRows.push(...((pagina ?? []) as typeof existentesRows));
      if (!pagina || pagina.length < 1000) break;
    }
    const jaGravadas = new Set(
      existentesRows.map((r) => r.chave_acesso).filter((c): c is string => Boolean(c)),
    );
    // Trava de negócio: layouts municipais nem sempre têm chave nacional, então
    // a duplicidade também é reconhecida por CNPJ do prestador + série + número.
    const jaGravadasCompostas = new Set(
      existentesRows
        .map((r) => chaveCompostaServico(r.cnpj_prestador, r.serie, r.numero_nota))
        .filter((c): c is string => Boolean(c)),
    );

    const tipoCarga = direcao === "prestado" ? "nfse_prestado" : "nfse_tomado";

    // Dentro do próprio lote: se a mesma operação veio em layout municipal
    // legado e em NFS-e Nacional, fica só a nacional.
    const { mantidas: notasPreferidas, descartadas: municipaisSuperadas } = preferirNacional(
      data.notas,
    );
    await registrarDuplicados(
      supabaseAdmin,
      data.caseId,
      tipoCarga,
      municipaisSuperadas.map((n) => ({ chave: n.chave ?? n.arquivo, arquivo: n.arquivo })),
      "layout_municipal_superado_por_nfse_nacional",
    );

    const { novas: notas, repetidas } = filtrarNotasDuplicadas(
      notasPreferidas.map((n) => ({
        ...n,
        composta: chaveCompostaServico(n.cnpjPrestador, n.serie, n.numero),
      })),
      jaGravadas,
      jaGravadasCompostas,
    );
    const duplicados = await registrarDuplicados(
      supabaseAdmin,
      data.caseId,
      tipoCarga,
      repetidas,
    );

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
        .select("id,chave_acesso,numero_nota,serie,cnpj_prestador,arquivo_original");
      if (ins.error) throw new Error(ins.error.message);
      inseridas = ins.data ?? [];
    }

    // Notas já gravadas na mesma direção também são reprocessadas em reenvios.
    const gravadas = [
      ...existentesRows.filter((n) => n.direcao === direcao),
      ...(inseridas as (typeof existentesRows)[number][]),
    ];
    const idPorChave = new Map<string, string>();
    const idPorComposta = new Map<string, string>();
    const idPorArquivo = new Map<string, string>();
    for (const n of gravadas) {
      if (n.chave_acesso) idPorChave.set(n.chave_acesso, n.id);
      const composta = chaveCompostaServico(n.cnpj_prestador, n.serie, n.numero_nota);
      if (composta) idPorComposta.set(composta, n.id);
      idPorArquivo.set(n.arquivo_original, n.id);
    }

    // tabela de exceções por NBS, só para os serviços sem classificação no documento
    const codigos = [
      ...new Set(
        data.notas.flatMap((n) =>
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
    const notaIdsReprocessados = new Set<string>();
    for (const nota of data.notas) {
      // Layouts municipais podem não detalhar o serviço: usa o total da nota
      // como um item único para que a receita/crédito entre no cálculo.
      const itensNota: NfseServicoItem[] =
        (nota.itens?.length ?? 0) > 0
          ? nota.itens
          : nota.valorTotal > 0
            ? [
                {
                  nbs: null,
                  itemLc116: nota.codigoServico ?? null,
                  descricao: null,
                  valorServico: nota.valorTotal,
                  // layout municipal não destaca IBS/CBS: estima pela alíquota
                  // nominal do ano (regime geral), como qualquer nota sem cClassTrib
                  temClassificacaoDocumento: false,
                  cclasstrib: null,
                  baseCalculo: 0,
                  vCBS: 0,
                  vIBSUF: 0,
                  vIBSMun: 0,
                  vISS: 0,
                  vPIS: 0,
                  vCOFINS: 0,
                },
              ]
            : [];
      if (itensNota.length === 0) continue;
      const notaId =
        (nota.chave ? idPorChave.get(nota.chave) : undefined) ??
        idPorComposta.get(chaveCompostaServico(nota.cnpjPrestador, nota.serie, nota.numero) ?? "") ??
        idPorArquivo.get(nota.arquivo.slice(0, 200));
      if (!notaId || notaIdsReprocessados.has(notaId)) continue;
      notaIdsReprocessados.add(notaId);
      for (const item of itensNota) {
        const base = {
          nota_servico_id: notaId,
          case_id: data.caseId,
          nbs: item.nbs,
          item_lc116: item.itemLc116,
          descricao: item.descricao?.slice(0, 300) ?? null,
          valor_servico: item.valorServico,
          tem_classificacao_documento: item.temClassificacaoDocumento,
          valor_iss: item.vISS,
          valor_pis: item.vPIS,
          valor_cofins: item.vCOFINS,
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

    // Lotes pequenos: listas grandes de IDs estouram o limite de URL do servidor.
    const ids = [...notaIdsReprocessados];
    for (let i = 0; i < ids.length; i += 100) {
      const delItens = await supabaseAdmin
        .from(TABELA_ITEM[direcao] as "nota_servico_nfse_item")
        .delete()
        .in("nota_servico_id", ids.slice(i, i + 100));
      if (delItens.error) throw new Error(delItens.error.message);
    }

    for (let i = 0; i < itensPayload.length; i += 500) {
      const ins = await supabaseAdmin
        .from(TABELA_ITEM[direcao] as "nota_servico_nfse_item")
        .insert(itensPayload.slice(i, i + 500) as never);
      if (ins.error) throw new Error(ins.error.message);
    }

    // Alimenta automaticamente a composição de carteira com as contrapartes
    // desta leva, sem exigir um upload separado: entra como "pendente" e o
    // processamento de regime (BrasilAPI/CNPJá, já existente para a carteira
    // de NF-e) resolve na sequência. Quando o próprio documento já informa o
    // regime do prestador (lado "tomado"), usa direto — sem precisar consultar.
    const tipoCarteira: "cliente" | "fornecedor" = direcao === "prestado" ? "cliente" : "fornecedor";
    const agregadosCarteira = aggregateNfse(notas, direcao);
    let novasPendentesCarteira = 0;
    if (agregadosCarteira.length > 0) {
      const { data: existentesCarteira } = await supabaseAdmin
        .from("composicao_carteira")
        .select("cnpj")
        .eq("case_id", data.caseId)
        .eq("tipo", tipoCarteira);
      const cnpjsExistentes = new Set(
        ((existentesCarteira ?? []) as { cnpj: string }[]).map((r) => r.cnpj),
      );
      const novasContrapartes = agregadosCarteira.filter((a) => !cnpjsExistentes.has(a.cnpj));
      novasPendentesCarteira = novasContrapartes.filter((a) => !a.regimeDocumento).length;
      if (novasContrapartes.length > 0) {
        const insCarteira = await supabaseAdmin.from("composicao_carteira").insert(
          novasContrapartes.map((a) => ({
            case_id: data.caseId,
            nome: a.nome.slice(0, 200),
            cnpj: a.cnpj,
            tipo: tipoCarteira,
            valor_movimentado: a.valor,
            regime: a.regimeDocumento ?? "pendente",
            status_consulta: a.regimeDocumento ? "ok" : "pendente",
            fonte_classificacao: a.regimeDocumento
              ? FONTE_NFSE_DOCUMENTO
              : "CNPJá — API Pública",
          })) as never,
        );
        if (insCarteira.error) throw new Error(insCarteira.error.message);
      }
    }

    return {
      ok: true as const,
      inserted: payload.length,
      itens: itensPayload.length,
      duplicados,
      municipaisSuperadas: municipaisSuperadas.length,
      pendentesCarteira: novasPendentesCarteira,
    };
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
    // Paginado: o PostgREST limita toda resposta a 1000 linhas por padrão,
    // mesmo sem .limit() — um caso real com 1000+ itens perderia os itens
    // além do corte, silenciosamente.
    const lista = await fetchAllRows<Record<string, unknown>>((from, to) =>
      supabaseAdmin
        .from("nota_servico_nfse_item")
        .select("*")
        .eq("case_id", data.caseId)
        .order("id")
        .range(from, to),
    );
    const notaIds = [...new Set(lista.map((i) => String(i["nota_servico_id"])))];
    const notas = new Map<
      string,
      { nome: string | null; cnpj: string | null; numero: string | null }
    >();
    if (notaIds.length > 0) {
      // Escopado por case_id e paginado (não por lista de ids): um caso real
      // pode ter centenas de notas, e .in("id", [...]) com tantos UUIDs
      // estoura o limite de ~16KB de headers HTTP do PostgREST — e mesmo sem
      // isso, a resposta sem paginar vem truncada em 1000 linhas.
      const notasData = await fetchAllRows<{
        id: string;
        razao_social_prestador: string | null;
        cnpj_prestador: string | null;
        numero_nota: string | null;
      }>((from, to) =>
        supabaseAdmin
          .from("nota_servico_nfse")
          .select("id,razao_social_prestador,cnpj_prestador,numero_nota")
          .eq("case_id", data.caseId)
          .order("id")
          .range(from, to),
      );
      for (const n of notasData) {
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
    // Paginado: mesmo motivo do getCreditoServicoItens acima.
    const lista = await fetchAllRows<Record<string, unknown>>((from, to) =>
      supabaseAdmin
        .from("nota_servico_nfse_item_prestado" as "nota_servico_nfse_item")
        .select("*")
        .eq("case_id", data.caseId)
        .order("id")
        .range(from, to),
    );
    const notaIds = [...new Set(lista.map((i) => String(i["nota_servico_id"])))];
    const notas = new Map<
      string,
      { nome: string | null; cnpj: string | null; numero: string | null }
    >();
    if (notaIds.length > 0) {
      // Mesmo motivo do getCreditoServicoItens acima: escopa por case_id e
      // pagina, em vez de .in("id", [...centenas de UUIDs...]).
      const notasData = await fetchAllRows<{
        id: string;
        razao_social_tomador: string | null;
        cnpj_tomador: string | null;
        numero_nota: string | null;
      }>((from, to) =>
        supabaseAdmin
          .from("nota_servico_nfse")
          .select("id,razao_social_tomador,cnpj_tomador,numero_nota")
          .eq("case_id", data.caseId)
          .order("id")
          .range(from, to),
      );
      for (const n of notasData) {
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
