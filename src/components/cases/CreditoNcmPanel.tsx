import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getCreditoItens, resolverItemAmbiguo, type CreditoItem } from "@/lib/nfe.functions";
import { FONTE_TABELA, type OpcaoCandidata } from "@/lib/nfe/credito";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Crédito de IBS/CBS apurado item a item nas notas de compra. */
export function CreditoNcmPanel({ caseId }: { caseId: string }) {
  const fetchItens = useServerFn(getCreditoItens);
  const resolver = useServerFn(resolverItemAmbiguo);

  const [itens, setItens] = useState<CreditoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => fetchItens({ data: { caseId } }));
      setItens(res.itens);
    } catch {
      setError("Não foi possível carregar os itens das notas de compra.");
    }
  }, [caseId, fetchItens]);

  useEffect(() => {
    void load();
  }, [load]);

  const cfopsDisponiveis = useMemo(
    () => [...new Set(itens.map((i) => i.cfop).filter((c): c is string => Boolean(c)))].sort(),
    [itens],
  );

  const itensFiltrados = useMemo(
    () =>
      cfopSelecionados.length === 0
        ? itens
        : itens.filter((i) => i.cfop && cfopSelecionados.includes(i.cfop)),
    [itens, cfopSelecionados],
  );

  const resumo = useMemo(() => {
    const ok = itensFiltrados.filter((i) => i.status_classificacao === "ok");
    const semDado = itens.filter(
      (i) => i.status_classificacao === "sem_dado" || i.status_classificacao === "imposto_seletivo",
    );
    const ambiguos = itens.filter((i) => i.status_classificacao === "ambiguo_revisao_pendente");
    const totalItens = itens.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorSemDado = semDado.reduce((acc, i) => acc + Number(i.valor_item), 0);
    return {
      credito: ok.reduce((acc, i) => acc + Number(i.valor_credito_ibs_cbs), 0),
      okCount: ok.length,
      ambiguos,
      totalItens,
      valorSemDado,
      pctSemDado: totalItens > 0 ? (valorSemDado / totalItens) * 100 : 0,
    };
  }, [itens]);

  const topFornecedores = useMemo(() => {
    const map = new Map<string, { nome: string; cnpj: string | null; credito: number }>();
    for (const i of itens) {
      if (i.status_classificacao !== "ok") continue;
      const key = i.cnpj_fornecedor ?? i.fornecedor ?? "—";
      const found = map.get(key);
      if (found) found.credito += Number(i.valor_credito_ibs_cbs);
      else
        map.set(key, {
          nome: i.fornecedor ?? "—",
          cnpj: i.cnpj_fornecedor,
          credito: Number(i.valor_credito_ibs_cbs),
        });
    }
    return [...map.values()].sort((a, b) => b.credito - a.credito).slice(0, 5);
  }, [itens]);

  const topNcms = useMemo(() => {
    const map = new Map<string, { ncm: string; descricao: string | null; credito: number }>();
    for (const i of itens) {
      if (i.status_classificacao !== "ok" || !i.ncm) continue;
      const found = map.get(i.ncm);
      if (found) found.credito += Number(i.valor_credito_ibs_cbs);
      else map.set(i.ncm, { ncm: i.ncm, descricao: i.descricao, credito: Number(i.valor_credito_ibs_cbs) });
    }
    return [...map.values()].sort((a, b) => b.credito - a.credito).slice(0, 5);
  }, [itens]);

  const escolher = async (item: CreditoItem, opcao: OpcaoCandidata) => {
    setBusy(true);
    setError("");
    try {
      await withAuthRetry(() =>
        resolver({
          data: {
            itemId: item.id,
            anexo: opcao.anexo,
            cclasstrib: opcao.cclasstrib,
            reducaoPct: opcao.reducao_pct,
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

  if (itens.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Crédito de IBS/CBS apurado item a item (notas de compra)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Apuração feita dentro de cada nota (NCM, CFOP e bloco IBSCBS quando presente), em paralelo
          à classificação de regime por CRT — uma não substitui a outra.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Crédito apurado</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{brl(resumo.credito)}</p>
          <p className="text-xs text-muted-foreground">{resumo.okCount} itens classificados</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Sem dado de crédito</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {brl(resumo.valorSemDado)}
          </p>
          <p className="text-xs text-muted-foreground">{pct1(resumo.pctSemDado)} do valor dos itens</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Na fila de revisão</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {resumo.ambiguos.length}
          </p>
          <p className="text-xs text-muted-foreground">itens com classificação ambígua</p>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {resumo.ambiguos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Fila de revisão do analista</p>
          {resumo.ambiguos.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                NCM {item.ncm ?? "—"} · {item.descricao ?? "sem descrição"}
              </p>
              <p className="text-xs text-muted-foreground">
                Nota {item.nota_numero ?? "—"} · {item.fornecedor ?? "—"} ·{" "}
                {brl(Number(item.valor_item))}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.opcoes_candidatas.map((o, idx) => (
                  <button
                    key={`${item.id}-${idx}`}
                    type="button"
                    disabled={busy}
                    onClick={() => void escolher(item, o)}
                    className={`rounded border px-2 py-1 text-xs font-semibold hover:bg-secondary ${
                      o.sugerida ? "border-navy text-navy" : "border-input text-foreground"
                    }`}
                  >
                    {o.anexo} · {o.reducao_pct}%{o.cclasstrib ? ` · ${o.cclasstrib}` : ""}
                    {o.sugerida ? " (sugerido)" : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 fornecedores por crédito
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {topFornecedores.map((f) => (
              <li key={f.cnpj ?? f.nome} className="flex justify-between gap-2">
                <span className="truncate">
                  {f.nome}
                  {f.cnpj ? ` · ${formatCnpjMask(f.cnpj)}` : ""}
                </span>
                <span className="tabular-nums">{brl(f.credito)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 NCMs por crédito
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {topNcms.map((n) => (
              <li key={n.ncm} className="flex justify-between gap-2">
                <span className="truncate">
                  {n.ncm}
                  {n.descricao ? ` · ${n.descricao}` : ""}
                </span>
                <span className="tabular-nums">{brl(n.credito)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{FONTE_TABELA}</p>
    </div>
  );
}
