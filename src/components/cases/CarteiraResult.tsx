import { useMemo, useState } from "react";

import { Button, Notice } from "@/components/simulator/ui";
import { brl } from "@/lib/tax/calc";
import {
  REGIME_LABELS,
  STATUS_LABELS,
  formatCnpjMask,
  isStale,
  summarize,
  type CarteiraRegime,
  type CarteiraRow,
  type CarteiraTipo,
} from "@/lib/carteira/types";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function SummaryCard({ rows, tipo }: { rows: CarteiraRow[]; tipo: CarteiraTipo }) {
  const s = summarize(rows, tipo);
  if (s.linhas === 0) return null;
  const title = tipo === "cliente" ? "Clientes" : "Fornecedores";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {s.linhas} contraparte{s.linhas === 1 ? "" : "s"} · {brl(s.total)} no período
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div className="bg-navy" style={{ width: `${s.regularPct}%` }} />
        <div className="bg-success" style={{ width: `${s.simplesPct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <p>
          <span className="block font-semibold tabular-nums text-foreground">
            {pct1(s.regularPct)}
          </span>
          Regime regular
        </p>
        <p>
          <span className="block font-semibold tabular-nums text-foreground">
            {pct1(s.simplesPct)}
          </span>
          Simples Nacional
        </p>
        <p>
          <span className="block font-semibold tabular-nums text-foreground">
            {pct1(s.pendentePct)}
          </span>
          Sem classificação
        </p>
      </div>
    </div>
  );
}

export function CarteiraResult({
  rows,
  busy,
  onRefreshRows,
  onDeleteRow,
}: {
  rows: CarteiraRow[];
  busy: boolean;
  onRefreshRows: (ids: string[]) => void;
  onDeleteRow: (id: string) => void;
}) {
  const [tipoFilter, setTipoFilter] = useState<"todos" | CarteiraTipo>("todos");
  const [regimeFilter, setRegimeFilter] = useState<"todos" | CarteiraRegime>("todos");
  const [sort, setSort] = useState<"valor" | "nome" | "percentual">("valor");

  const visible = useMemo(() => {
    const list = rows.filter(
      (r) =>
        (tipoFilter === "todos" || r.tipo === tipoFilter) &&
        (regimeFilter === "todos" || r.regime === regimeFilter),
    );
    return [...list].sort((a, b) => {
      if (sort === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      if (sort === "percentual") return b.percentual_carteira - a.percentual_carteira;
      return Number(b.valor_movimentado) - Number(a.valor_movimentado);
    });
  }, [rows, tipoFilter, regimeFilter, sort]);

  const stale = rows.filter(isStale);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard rows={rows} tipo="cliente" />
        <SummaryCard rows={rows} tipo="fornecedor" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value as typeof tipoFilter)}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos os tipos</option>
          <option value="cliente">Clientes</option>
          <option value="fornecedor">Fornecedores</option>
        </select>
        <select
          value={regimeFilter}
          onChange={(e) => setRegimeFilter(e.target.value as typeof regimeFilter)}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos os regimes</option>
          <option value="regular">Regime regular</option>
          <option value="simples">Simples Nacional</option>
          <option value="pendente">Pendente</option>
          <option value="erro">Erro</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="valor">Ordenar por valor</option>
          <option value="percentual">Ordenar por % da carteira</option>
          <option value="nome">Ordenar por nome</option>
        </select>
        {stale.length > 0 ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onRefreshRows(stale.map((r) => r.id))}
          >
            Atualizar todas desatualizadas ({stale.length})
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">% da carteira</th>
              <th className="px-3 py-2">Regime</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Classificado em</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="max-w-64 truncate px-3 py-2">{row.nome || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{formatCnpjMask(row.cnpj)}</td>
                <td className="px-3 py-2">{row.tipo === "cliente" ? "Cliente" : "Fornecedor"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {brl(Number(row.valor_movimentado))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {pct1(Number(row.percentual_carteira))}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      row.regime === "regular"
                        ? "font-semibold text-navy"
                        : row.regime === "simples"
                          ? "font-semibold text-success"
                          : "text-muted-foreground"
                    }
                  >
                    {REGIME_LABELS[row.regime]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {STATUS_LABELS[row.status_consulta]}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {row.data_classificacao
                    ? new Date(row.data_classificacao).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" disabled={busy} onClick={() => onRefreshRows([row.id])}>
                      Atualizar
                    </Button>
                    <Button variant="ghost" onClick={() => onDeleteRow(row.id)}>
                      Remover
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Notice>
        Classificação obtida na API Pública da CNPJá, a partir do CNPJ de cada contraparte.
      </Notice>
    </div>
  );
}
