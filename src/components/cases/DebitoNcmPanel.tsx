import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getCreditoItens, resolverItemAmbiguo } from "@/lib/nfe.functions";
import { getDebitoItens, resolverItemVendaAmbiguo, type DebitoItem } from "@/lib/nfe-venda.functions";
import { FONTE_TABELA, type OpcaoCandidata } from "@/lib/nfe/credito";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

interface FilaItem {
  id: string;
  direcao: "compra" | "venda";
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
  const resolverVenda = useServerFn(resolverItemVendaAmbiguo);
  const resolverCompra = useServerFn(resolverItemAmbiguo);

  const [itens, setItens] = useState<DebitoItem[]>([]);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [vendasRes, comprasRes] = await Promise.all([
        withAuthRetry(() => fetchVendas({ data: { caseId } })),
        withAuthRetry(() => fetchCompras({ data: { caseId } })),
      ]);
      setItens(vendasRes.itens);
      const filaVendas: FilaItem[] = vendasRes.itens
        .filter((i) => i.status_classificacao === "ambiguo_revisao_pendente")
        .map((i) => ({
          id: i.id,
          direcao: "venda" as const,
          ncm: i.ncm,
          descricao: i.descricao,
          valor: Number(i.valor_item),
          nota: i.nota_numero,
          contraparte: i.cliente,
          opcoes: i.opcoes_candidatas,
        }));
      const filaCompras: FilaItem[] = comprasRes.itens
        .filter((i) => i.status_classificacao === "ambiguo_revisao_pendente")
        .map((i) => ({
          id: i.id,
          direcao: "compra" as const,
          ncm: i.ncm,
          descricao: i.descricao,
          valor: Number(i.valor_item),
          nota: i.nota_numero,
          contraparte: i.fornecedor,
          opcoes: i.opcoes_candidatas,
        }));
      setFila([...filaVendas, ...filaCompras]);
    } catch {
      setError("Não foi possível carregar os itens das notas de venda.");
    }
  }, [caseId, fetchVendas, fetchCompras]);

  useEffect(() => {
    void load();
  }, [load]);

  const resumo = useMemo(() => {
    const ok = itens.filter((i) => i.status_classificacao === "ok");
    const semDado = itens.filter((i) => i.status_classificacao === "sem_dado");
    const seletivo = itens.filter((i) => i.status_classificacao === "imposto_seletivo");
    const ambiguos = itens.filter((i) => i.status_classificacao === "ambiguo_revisao_pendente");
    const totalItens = itens.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorSemDado = semDado.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorSeletivo = seletivo.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const valorAmbiguo = ambiguos.reduce((acc, i) => acc + Number(i.valor_item), 0);
    const pct = (v: number) => (totalItens > 0 ? (v / totalItens) * 100 : 0);
    return {
      debito: ok.reduce((acc, i) => acc + Number(i.valor_debito_ibs_cbs), 0),
      okCount: ok.length,
      ambiguos: ambiguos.length,
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
      const payload = {
        data: {
          itemId: item.id,
          anexo: opcao.anexo,
          cclasstrib: opcao.cclasstrib,
          reducaoPct: opcao.reducao_pct,
        },
      };
      await withAuthRetry(() =>
        item.direcao === "venda" ? resolverVenda(payload) : resolverCompra(payload),
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
          </p>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {fila.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Fila de revisão do analista (compras e vendas)
          </p>
          {fila.map((item) => (
            <div
              key={`${item.direcao}-${item.id}`}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-input px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.direcao === "venda" ? "Venda" : "Compra"}
                </span>
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
            </div>
          ))}
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
