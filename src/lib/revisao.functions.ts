import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { creditoComReducao } from "@/lib/nfe/credito";
import { debitoComReducao } from "@/lib/nfe/debito";
import { EXCLUIDO_ANALISTA, MARCADO_REVISAO } from "@/lib/apuracao/liquido";

export type OrigemItem = "compra" | "venda";
export type AcaoRevisao = "classificar" | "excluir" | "marcar";

const TABELA: Record<OrigemItem, { tabela: string; valorCol: string }> = {
  compra: { tabela: "nota_fiscal_compra_xml_item", valorCol: "valor_credito_ibs_cbs" },
  venda: { tabela: "nota_fiscal_venda_xml_item", valorCol: "valor_debito_ibs_cbs" },
};

export interface RevisaoEvento {
  id: string;
  item_id: string;
  origem: OrigemItem;
  acao: AcaoRevisao;
  anexo: string | null;
  cclasstrib: string | null;
  reducao_pct: number | null;
  status_anterior: string | null;
  status_novo: string | null;
  valor_anterior: number | null;
  valor_novo: number | null;
  observacao: string | null;
  created_at: string;
}

/**
 * Aplica a mesma decisão a vários itens ambíguos de compra e/ou venda,
 * registrando um evento de histórico por item.
 */
export const aplicarAcaoLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      itens: { id: string; origem: OrigemItem }[];
      acao: AcaoRevisao;
      anexo?: string | null;
      cclasstrib?: string | null;
      reducaoPct?: number | null;
      observacao?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.itens.length === 0) return { ok: true as const, aplicados: 0 };
    if (data.acao === "classificar" && typeof data.reducaoPct !== "number") {
      throw new Error("Informe o percentual de redução para classificar em lote.");
    }

    const eventos: Record<string, unknown>[] = [];
    let aplicados = 0;

    for (const origem of ["compra", "venda"] as OrigemItem[]) {
      const ids = data.itens.filter((i) => i.origem === origem).map((i) => i.id);
      if (ids.length === 0) continue;
      const { tabela, valorCol } = TABELA[origem];

      const { data: rows, error: readErr } = await supabaseAdmin
        .from(tabela as never)
        .select(`id,valor_item,status_classificacao,${valorCol}`)
        .in("id", ids);
      if (readErr) throw new Error(readErr.message);

      for (const raw of (rows ?? []) as unknown as Record<string, unknown>[]) {
        const id = String(raw["id"]);
        const valorItem = Number(raw["valor_item"] ?? 0);
        const statusAnterior = String(raw["status_classificacao"] ?? "");
        const valorAnterior = Number(raw[valorCol] ?? 0);

        let statusNovo = statusAnterior;
        let valorNovo = valorAnterior;
        let fonte: string | null = null;
        let cclasstrib: string | null | undefined;

        if (data.acao === "classificar") {
          const reducao = Number(data.reducaoPct ?? 0);
          statusNovo = "ok";
          valorNovo =
            origem === "compra"
              ? creditoComReducao(valorItem, reducao)
              : debitoComReducao(valorItem, reducao);
          fonte = `revisão em lote — ${data.anexo ?? "decisão do analista"} (${reducao}%)`;
          cclasstrib = data.cclasstrib ?? null;
        } else if (data.acao === "excluir") {
          statusNovo = EXCLUIDO_ANALISTA;
          valorNovo = 0;
          fonte = "excluído da apuração pelo analista";
        } else {
          statusNovo = MARCADO_REVISAO;
          valorNovo = 0;
          fonte = "marcado pelo analista para decidir depois";
        }

        const update: Record<string, unknown> = {
          status_classificacao: statusNovo,
          [valorCol]: valorNovo,
          fonte,
        };
        if (data.acao === "classificar") {
          update["cclasstrib"] = cclasstrib ?? null;
          update["valor_base_calculo"] = valorItem;
        }

        const { error } = await supabaseAdmin
          .from(tabela as never)
          .update(update as never)
          .eq("id", id);
        if (error) throw new Error(error.message);

        aplicados += 1;
        eventos.push({
          case_id: data.caseId,
          item_id: id,
          origem,
          acao: data.acao,
          anexo: data.anexo ?? null,
          cclasstrib: cclasstrib ?? null,
          reducao_pct: data.acao === "classificar" ? (data.reducaoPct ?? null) : null,
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          valor_anterior: valorAnterior,
          valor_novo: valorNovo,
          observacao: data.observacao?.slice(0, 500) ?? null,
          decidido_por: context.userId,
        });
      }
    }

    if (eventos.length > 0) {
      const ins = await supabaseAdmin.from("item_revisao_evento").insert(eventos as never);
      if (ins.error) throw new Error(ins.error.message);
    }

    return { ok: true as const, aplicados };
  });

/** Histórico de decisões do Caso, do mais recente para o mais antigo. */
export const getHistoricoRevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("item_revisao_evento")
      .select(
        "id,item_id,origem,acao,anexo,cclasstrib,reducao_pct,status_anterior,status_novo,valor_anterior,valor_novo,observacao,created_at",
      )
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false })
      .limit(300);
    const eventos = ((rows ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      id: String(r["id"]),
      item_id: String(r["item_id"]),
      origem: (r["origem"] as OrigemItem) ?? "compra",
      acao: (r["acao"] as AcaoRevisao) ?? "classificar",
      anexo: (r["anexo"] as string | null) ?? null,
      cclasstrib: (r["cclasstrib"] as string | null) ?? null,
      reducao_pct: r["reducao_pct"] === null ? null : Number(r["reducao_pct"]),
      status_anterior: (r["status_anterior"] as string | null) ?? null,
      status_novo: (r["status_novo"] as string | null) ?? null,
      valor_anterior: r["valor_anterior"] === null ? null : Number(r["valor_anterior"]),
      valor_novo: r["valor_novo"] === null ? null : Number(r["valor_novo"]),
      observacao: (r["observacao"] as string | null) ?? null,
      created_at: String(r["created_at"]),
    })) as RevisaoEvento[];
    return { ok: true as const, eventos };
  });
