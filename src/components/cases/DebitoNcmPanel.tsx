import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getCreditoItens } from "@/lib/nfe.functions";
import { getDebitoItens, type DebitoItem } from "@/lib/nfe-venda.functions";
import {
  aplicarAcaoLote,
  getHistoricoRevisao,
  type AcaoRevisao,
  type OrigemItem,
  type RevisaoEvento,
} from "@/lib/revisao.functions";
import { EXCLUIDO_ANALISTA, MARCADO_REVISAO, PENDENTE_REVISAO } from "@/lib/apuracao/liquido";
import { FONTE_TABELA, type OpcaoCandidata } from "@/lib/nfe/credito";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const ACAO_LABEL: Record<AcaoRevisao, string> = {
  classificar: "Classificado",
  excluir: "Excluído da apuração",
  marcar: "Marcado para decidir depois",
};

interface FilaItem {
  id: string;
  direcao: OrigemItem;
  status: string;
  ncm: string | null;
  descricao: string | null;
  valor: number;
  nota: string | null;
  contraparte: string | null;
  opcoes: OpcaoCandidata[];
}

/** Débito de IBS/CBS apurado item a item nas notas de venda de mercadoria. */
export function DebitoNcmPanel({ caseId }: { caseId: string }) {
  const fetchVendas = useServerFn(getDebitoItens);
  const fetchCompras = useServerFn(getCreditoItens);
  const aplicarLote = useServerFn(aplicarAcaoLote);
  const fetchHistorico = useServerFn(getHistoricoRevisao);

  const [itens, setItens] = useState<DebitoItem[]>([]);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [historico, setHistorico] = useState<RevisaoEvento[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [reducaoLote, setReducaoLote] = useState("0");
  const [anexoLote, setAnexoLote] = useState("");
  const [observacao, setObservacao] = useState("");
  const [abrirHistorico, setAbrirHistorico] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const emRevisao = (s: string) => s === PENDENTE_REVISAO || s === MARCADO_REVISAO;

  const load = useCallback(async () => {
    try {
      const [vendasRes, comprasRes, histRes] = await Promise.all([
        withAuthRetry(() => fetchVendas({ data: { caseId } })),
        withAuthRetry(() => fetchCompras({ data: { caseId } })),
        withAuthRetry(() => fetchHistorico({ data: { caseId } })),
      ]);
      setItens(vendasRes.itens);
      setHistorico(histRes.eventos);
      const filaVendas: FilaItem[] = vendasRes.itens
        .filter((i) => emRevisao(i.status_classificacao))
        .map((i) => ({
          id: i.id,
          direcao: "venda" as const,
          status: i.status_classificacao,
          ncm: i.ncm,
          descricao: i.descricao,
          valor: Number(i.valor_item),
          nota: i.nota_numero,
          contraparte: i.cliente,
          opcoes: i.opcoes_candidatas,
        }));
      const filaCompras: FilaItem[] = comprasRes.itens
        .filter((i) => emRevisao(i.status_classificacao))
        .map((i) => ({
          id: i.id,
          direcao: "compra" as const,
          status: i.status_classificacao,
          ncm: i.ncm,
          descricao: i.descricao,
          valor: Number(i.valor_item),
          nota: i.nota_numero,
          contraparte: i.fornecedor,
          opcoes: i.opcoes_candidatas,
        }));
      const nova = [...filaVendas, ...filaCompras];
      setFila(nova);
      setSelecionados((prev) => prev.filter((id) => nova.some((f) => f.id === id)));
    } catch {
      setError("Não foi possível carregar os itens das notas de venda.");
    }
  }, [caseId, fetchVendas, fetchCompras, fetchHistorico]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventosPorItem = useMemo(() => {
    const map = new Map<string, RevisaoEvento[]>();
    for (const e of historico) {
      const list = map.get(e.item_id) ?? [];
      list.push(e);
      map.set(e.item_id, list);
    }
    return map;
  }, [historico]);

  const resumo = useMemo(() => {
    const ok = itens.filter((i) => i.status_classificacao === "ok");
    const semDado = itens.filter((i) => i.status_classificacao === "sem_dado");
    const seletivo = itens.filter((i) => i.status_classificacao === "imposto_seletivo");
    const ambiguos = itens.filter((i) => emRevisao(i.status_classificacao));
    const excluidos = itens.filter((i) => i.status_classificacao === EXCLUIDO_ANALISTA);
    const totalItens = itens.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorSemDado = semDado.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorSeletivo = seletivo.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorAmbiguo = ambiguos.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const pct = (v: number) => (totalItens > 0 ? (v / totalItens) * 100 : 0);
    return {
      debito: ok.reduce((acc, i) => acc + Number(i.valor_debito_ibs_cbs), 0),
      okCount: ok.length,
      ambiguos: ambiguos.length,
      excluidos: excluidos.length,
      totalItens,
      valorSemDado,
      valorSeletivo,
      valorAmbiguo,
      pctSemDado: pct(valorSemDado),
      pctSeletivo: pct(valorSeletivo),
      pctAmbiguo: pct(valorAmbiguo),
    };
  }, [itens]);

  const topClientes = useMemo(() => {
    const map = new Map<string, { nome: string; cnpj: string | null; debito: number }>();
    for (const i of itens) {
      if (i.status_classificacao !== "ok") continue;
      const key = i.cnpj_cliente ?? i.cliente ?? "—";
      const found = map.get(key);
      if (found) found.debito += Number(i.valor_debito_ibs_cbs);
      else
        map.set(key, {
          nome: i.cliente ?? "—",
          cnpj: i.cnpj_cliente,
          debito: Number(i.valor_debito_ibs_cbs),
        });
    }
    return [...map.values()].sort((a, b) => b.debito - a.debito).slice(0, 5);
  }, [itens]);

  const topNcms = useMemo(() => {
    const map = new Map<string, { ncm: string; descricao: string | null; debito: number }>();
    for (const i of itens) {
      if (i.status_classificacao !== "ok" || !i.ncm) continue;
      const found = map.get(i.ncm);
      if (found) found.debito += Number(i.valor_debito_ibs_cbs);
      else
        map.set(i.ncm, {
          ncm: i.ncm,
          descricao: i.descricao,
          debito: Number(i.valor_debito_ibs_cbs),
        });
    }
    return [...map.values()].sort((a, b) => b.debito - a.debito).slice(0, 5);
  }, [itens]);

  const escolher = async (item: FilaItem, opcao: OpcaoCandidata) => {
    setBusy(true);
    setError("");
    try {
      await withAuthRetry(() =>
        aplicarLote({
          data: {
            caseId,
            itens: [{ id: item.id, origem: item.direcao }],
            acao: "classificar",
            anexo: opcao.anexo,
            cclasstrib: opcao.cclasstrib,
            reducaoPct: opcao.reducao_pct,
            observacao: null,
          },
        }),
      );
      await load();

    } catch {
      setError("Não foi possível registrar a decisão para este item.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleTodos = () =>
    setSelecionados((prev) => (prev.length === fila.length ? [] : fila.map((f) => f.id)));

  const executarLote = async (acao: AcaoRevisao) => {
    if (selecionados.length === 0) return;
    const reducao = Number(reducaoLote.replace(",", "."));
    if (acao === "classificar" && (!Number.isFinite(reducao) || reducao < 0 || reducao > 100)) {
      setError("Informe um percentual de redução entre 0 e 100 para classificar em lote.");
      return;
    }
    setBusy(true);
    setError("");
    setAviso("");
    try {
      const alvo = fila
        .filter((f) => selecionados.includes(f.id))
        .map((f) => ({ id: f.id, origem: f.direcao }));
      const res = await withAuthRetry(() =>
        aplicarLote({
          data: {
            caseId,
            itens: alvo,
            acao,
            anexo: acao === "classificar" ? anexoLote.trim() || null : null,
            cclasstrib: null,
            reducaoPct: acao === "classificar" ? reducao : null,
            observacao: observacao.trim() || null,
          },
        }),
      );
      setAviso(`${res.aplicados} ${res.aplicados === 1 ? "item" : "itens"} atualizados em lote.`);
      setSelecionados([]);
      setObservacao("");
      await load();
    } catch {
      setError("Não foi possível aplicar a ação em lote.");
    } finally {
      setBusy(false);
    }
  };

  if (itens.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Débito de IBS/CBS apurado item a item (notas de venda de mercadoria)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Apuração feita dentro de cada nota de venda (NCM, CFOP e bloco IBSCBS quando presente).
          Onde há itens apurados, este valor substitui a estimativa por alíquota fixa sobre o total
          da nota.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Débito apurado</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{brl(resumo.debito)}</p>
          <p className="text-xs text-muted-foreground">{resumo.okCount} itens classificados</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Sem dado de débito</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {brl(resumo.valorSemDado)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pct1(resumo.pctSemDado)} do valor dos itens
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Imposto Seletivo</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {brl(resumo.valorSeletivo)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pct1(resumo.pctSeletivo)} do valor dos itens
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Na fila de revisão</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {brl(resumo.valorAmbiguo)}
          </p>
          <p className="text-xs text-muted-foreground">
            {resumo.ambiguos} itens · {pct1(resumo.pctAmbiguo)} do valor
            {resumo.excluidos > 0 ? ` · ${resumo.excluidos} excluídos` : ""}
          </p>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}
      {aviso ? <Notice tone="muted">{aviso}</Notice> : null}

      {fila.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Fila de revisão do analista (compras e vendas)
            </p>
            <button
              type="button"
              onClick={toggleTodos}
              className="text-xs font-semibold text-navy underline"
            >
              {selecionados.length === fila.length ? "Limpar seleção" : "Selecionar todos"}
            </button>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ações em lote · {selecionados.length} selecionado(s)
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">
                Redução (%)
                <input
                  value={reducaoLote}
                  onChange={(e) => setReducaoLote(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 block w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Anexo / justificativa curta
                <input
                  value={anexoLote}
                  onChange={(e) => setAnexoLote(e.target.value)}
                  placeholder="ex.: Anexo I — alimentos"
                  className="mt-1 block w-56 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Observação (fica no histórico)
                <input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="mt-1 block w-64 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                disabled={busy || selecionados.length === 0}
                onClick={() => void executarLote("classificar")}
              >
                Classificar selecionados
              </Button>
              <Button
                variant="ghost"
                disabled={busy || selecionados.length === 0}
                onClick={() => void executarLote("marcar")}
              >
                Marcar para decidir depois
              </Button>
              <Button
                variant="ghost"
                disabled={busy || selecionados.length === 0}
                onClick={() => void executarLote("excluir")}
              >
                Excluir da apuração
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Itens excluídos e marcados ficam fora da soma de débito e crédito; toda decisão fica
              registrada no histórico do item.
            </p>
          </div>

          {fila.map((item) => {
            const eventos = eventosPorItem.get(item.id) ?? [];
            const aberto = abrirHistorico === item.id;
            return (
              <div
                key={`${item.direcao}-${item.id}`}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selecionados.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    aria-label={`Selecionar item ${item.ncm ?? item.id}`}
                    className="h-4 w-4"
                  />
                  <span className="rounded border border-input px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.direcao === "venda" ? "Venda" : "Compra"}
                  </span>
                  {item.status === MARCADO_REVISAO ? (
                    <span className="rounded border border-input px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Marcado
                    </span>
                  ) : null}
                  <p className="font-medium text-foreground">
                    NCM {item.ncm ?? "—"} · {item.descricao ?? "sem descrição"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nota {item.nota ?? "—"} · {item.contraparte ?? "—"} · {brl(item.valor)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.opcoes.map((o, idx) => (
                    <Button
                      key={`${item.id}-${idx}`}
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void escolher(item, o)}
                    >
                      {o.anexo} · {o.reducao_pct}%{o.cclasstrib ? ` · ${o.cclasstrib}` : ""}
                      {o.sugerida ? " (sugerido)" : ""}
                    </Button>
                  ))}
                </div>
                {eventos.length > 0 ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setAbrirHistorico(aberto ? null : item.id)}
                      className="text-xs font-semibold text-navy underline"
                    >
                      Histórico de decisões ({eventos.length})
                    </button>
                    {aberto ? (
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {eventos.map((e) => (
                          <li key={e.id}>
                            {new Date(e.created_at).toLocaleString("pt-BR")} ·{" "}
                            {ACAO_LABEL[e.acao] ?? e.acao}
                            {e.reducao_pct !== null ? ` · redução ${e.reducao_pct}%` : ""}
                            {e.anexo ? ` · ${e.anexo}` : ""} ·{" "}
                            {brl(e.valor_anterior ?? 0)} → {brl(e.valor_novo ?? 0)}
                            {e.observacao ? ` · ${e.observacao}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 clientes por débito
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {topClientes.map((c) => (
              <li key={c.cnpj ?? c.nome} className="flex justify-between gap-2">
                <span className="truncate">
                  {c.nome}
                  {c.cnpj ? ` · ${formatCnpjMask(c.cnpj)}` : ""}
                </span>
                <span className="tabular-nums">{brl(c.debito)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 NCMs por débito
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {topNcms.map((n) => (
              <li key={n.ncm} className="flex justify-between gap-2">
                <span className="truncate">
                  {n.ncm}
                  {n.descricao ? ` · ${n.descricao}` : ""}
                </span>
                <span className="tabular-nums">{brl(n.debito)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{FONTE_TABELA}</p>
    </div>
  );
}
