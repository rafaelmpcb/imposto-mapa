import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NfseNota } from "@/lib/nfse/parse";
import {
  FONTE_DOCUMENTO,
  creditoPorAliquotas,
  creditoPorNbs,
  type NbsExcecao,
  type OpcaoServico,
  type ServicoItemStatus,
} from "@/lib/nfse/credito";

/** Grava as notas de serviço tomadas e apura o crédito item a item. */
export const saveNotasServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; notas: NfseNota[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.notas.length === 0) return { ok: true as const, inserted: 0, itens: 0 };

    const { data: existentes } = await supabaseAdmin
      .from("nota_servico_nfse")
      .select("chave_acesso")
      .eq("case_id", data.caseId);
    const jaGravadas = new Set(
      ((existentes ?? []) as { chave_acesso: string | null }[])
        .map((r) => r.chave_acesso)
        .filter((c): c is string => Boolean(c)),
    );

    const vistas = new Set<string>();
    const notas = data.notas.filter((n) => {
      if (!n.chave) return true;
      if (jaGravadas.has(n.chave) || vistas.has(n.chave)) return false;
      vistas.add(n.chave);
      return true;
    });
    if (notas.length === 0) return { ok: true as const, inserted: 0, itens: 0 };

    const payload = notas.map((n) => ({
      case_id: data.caseId,
      arquivo_original: n.arquivo.slice(0, 200),
      chave_acesso: n.chave,
      numero_nota: n.numero,
      serie: n.serie,
      cnpj_prestador: n.cnpjPrestador,
      razao_social_prestador: n.razaoSocialPrestador?.slice(0, 200) ?? null,
      valor_total: n.valorTotal,
      data_emissao: n.dataEmissao,
      status_processamento: n.status,
    }));

    const { data: inseridas, error } = await supabaseAdmin
      .from("nota_servico_nfse")
      .insert(payload as never)
      .select("id,chave_acesso,arquivo_original");
    if (error) throw new Error(error.message);

    const gravadas = (inseridas ?? []) as {
      id: string;
      chave_acesso: string | null;
      arquivo_original: string;
    }[];
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
            valor_credito_ibs_cbs:
              Math.round((item.vCBS + item.vIBSUF + item.vIBSMun) * 100) / 100,
            fonte: FONTE_DOCUMENTO,
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
          valor_credito_ibs_cbs: calc.credito,
          fonte: calc.fonte,
          status_classificacao: calc.status,
          opcoes_candidatas: calc.opcoes,
        });
      }
    }

    if (itensPayload.length > 0) {
      const ins = await supabaseAdmin
        .from("nota_servico_nfse_item")
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
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("nota_servico_nfse_item")
      .select("valor_servico")
      .eq("id", data.itemId)
      .maybeSingle();
    const valor = Number((item as { valor_servico?: number } | null)?.valor_servico ?? 0);
    const credito = creditoPorAliquotas(valor, data.ibsPct, data.cbsPct);
    const { error } = await supabaseAdmin
      .from("nota_servico_nfse_item")
      .update({
        cclasstrib: data.cclasstrib,
        valor_base_calculo: valor,
        valor_credito_ibs_cbs: credito,
        fonte: `revisão do analista — ${data.nome.slice(0, 120)}`,
        status_classificacao: "ok",
      } as never)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const, credito };
  });
