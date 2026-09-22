import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getDebitoServicoItens, type DebitoServicoItem } from "@/lib/nfse.functions";
import { FONTE_TABELA_NBS } from "@/lib/nfse/credito";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Débito de IBS/CBS apurado serviço a serviço nas NFS-e emitidas (vendas). */
export function DebitoNbsPanel({ caseId, reloadKey = 0 }: { caseId: string; reloadKey?: number }) {
  const fetchItens = useServerFn(getDebitoServicoItens);

  const [itens, setItens] = useState<DebitoServicoItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => fetchItens({ data: { caseId } }));
      setItens(res.itens);
    } catch {
      setError("Não foi possível carregar os serviços das notas emitidas.");
    }
  }, [caseId, fetchItens]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const resumo = useMemo(() => {
    const ok = itens.filter((i) => i.status_classificacao === "ok");
    const semDado = itens.filter((i) => i.status_classificacao === "sem_dado");
    const especificos = itens.filter((i) => i.status_classificacao === "regime_especifico");
    const ambiguos = itens.filter((i) => i.status_classificacao === "ambiguo_revisao_pendente");
    const total = itens.reduce((acc, i) => acc + Number(i.valor_servico), 0);
    const foraDoCalculo = [...semDado, ...especificos].reduce(
      (acc, i) => acc + Number(i.valor_servico),
      0,
    );
    return {
      debito: ok.reduce((acc, i) => acc + Number(i.valor_debito_ibs_cbs), 0),
      okCount: ok.length,
      ambiguosCount: ambiguos.length,
      especificosCount: especificos.length,
      total,
      foraDoCalculo,
      pctFora: total > 0 ? (foraDoCalculo / total) * 100 : 0,
    };
  }, [itens]);

  const topTomadores = useMemo(() => {
    const map = new Map<string, { nome: string; cnpj: string | null; debito: number }>();
    for (const i of itens) {
      if (i.status_classificacao !== "ok") continue;
      const key = i.cnpj_tomador ?? i.tomador ?? "—";
      const found = map.get(key);
      if (found) found.debito += Number(i.valor_debito_ibs_cbs);
      else
        map.set(key, {
          nome: i.tomador ?? "—",
          cnpj: i.cnpj_tomador,
          debito: Number(i.valor_debito_ibs_cbs),
        });
    }
    return [...map.values()].sort((a, b) => b.debito - a.debito).slice(0, 5);
  }, [itens]);

  const topNbs = useMemo(() => {
    const map = new Map<string, { nbs: string; descricao: string | null; debito: number }>();
    for (const i of itens) {
      if (i.status_classificacao !== "ok" || !i.nbs) continue;
      const found = map.get(i.nbs);
      if (found) found.debito += Number(i.valor_debito_ibs_cbs);
      else
        map.set(i.nbs, {
          nbs: i.nbs,
          descricao: i.descricao,
          debito: Number(i.valor_debito_ibs_cbs),
        });
    }
    return [...map.values()].sort((a, b) => b.debito - a.debito).slice(0, 5);
  }, [itens]);

  if (itens.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Débito de IBS/CBS apurado serviço a serviço (NFS-e emitidas)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Carga sobre a receita de serviços prestados pelo Caso. O valor líquido a recolher
          (débito menos crédito) não é calculado nesta etapa.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Débito apurado em serviços</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{brl(resumo.debito)}</p>
          <p className="text-xs text-muted-foreground">{resumo.okCount} serviços classificados</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Sem dado ou regime específico</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {brl(resumo.foraDoCalculo)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pct1(resumo.pctFora)} do valor dos serviços · {resumo.especificosCount} em regime
            específico
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Na fila de revisão</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {resumo.ambiguosCount}
          </p>
          <p className="text-xs text-muted-foreground">serviços com classificação ambígua</p>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 clientes por débito
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {topTomadores.map((t) => (
              <li key={t.cnpj ?? t.nome} className="flex justify-between gap-2">
                <span className="truncate">
                  {t.nome}
                  {t.cnpj ? ` · ${formatCnpjMask(t.cnpj)}` : ""}
                </span>
                <span className="tabular-nums">{brl(t.debito)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 NBS por débito
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {topNbs.map((n) => (
              <li key={n.nbs} className="flex justify-between gap-2">
                <span className="truncate">
                  {n.nbs}
                  {n.descricao ? ` · ${n.descricao}` : ""}
                </span>
                <span className="tabular-nums">{brl(n.debito)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{FONTE_TABELA_NBS}</p>
    </div>
  );
}
