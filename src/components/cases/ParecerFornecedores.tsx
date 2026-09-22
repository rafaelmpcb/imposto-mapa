/**
 * Aba "Fornecedores e créditos" do relatório executivo.
 * Camada puramente visual: consome o snapshot já compilado (sec4) e apenas
 * organiza/apresenta. Não recalcula crédito, imposto ou classificação.
 */
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { brl } from "@/lib/tax/calc";
import type { ParecerSnapshot } from "@/lib/parecer/tipos";

const COR_NORMAL = "#f97316";
const COR_SIMPLES = "#12234a";
const COR_OUTRO = "#c7cbd6";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

type Forn = ParecerSnapshot["sec4"]["fornecedores"][number];

function regimeLabel(r: string | null | undefined) {
  if (r === "simples") return "Simples Nacional";
  if (r === "regular") return "Regime Normal";
  return "Não classificado";
}

function Box({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function ParecerFornecedores({ sec4 }: { sec4: ParecerSnapshot["sec4"] }) {
  const [filtro, setFiltro] = useState<"todos" | "simples" | "regular">("todos");
  const [busca, setBusca] = useState("");

  const lista = sec4.fornecedores;

  /* ---- Regime Normal x Simples Nacional ---- */
  const porRegime = useMemo(() => {
    const acc = { regular: 0, simples: 0, outro: 0 };
    for (const f of lista) {
      const k = f.regime === "simples" ? "simples" : f.regime === "regular" ? "regular" : "outro";
      acc[k] += f.valorBase;
    }
    const total = acc.regular + acc.simples + acc.outro;
    return {
      total,
      partes: [
        { nome: "Regime Normal", valor: acc.regular, cor: COR_NORMAL },
        { nome: "Simples Nacional", valor: acc.simples, cor: COR_SIMPLES },
        { nome: "Não classificado", valor: acc.outro, cor: COR_OUTRO },
      ].filter((p) => p.valor > 0),
    };
  }, [lista]);

  /* ---- Curva ABC por volume de compra ---- */
  const abc = useMemo(() => {
    const ordenada = [...lista].sort((a, b) => b.valorBase - a.valorBase);
    const total = ordenada.reduce((a, f) => a + f.valorBase, 0);
    const grupos = { A: [] as Forn[], B: [] as Forn[], C: [] as Forn[] };
    let acumulado = 0;
    for (const f of ordenada) {
      const antes = total > 0 ? acumulado / total : 0;
      if (antes < 0.8) grupos.A.push(f);
      else if (antes < 0.95) grupos.B.push(f);
      else grupos.C.push(f);
      acumulado += f.valorBase;
    }
    const resumo = (["A", "B", "C"] as const).map((k) => {
      const itens = grupos[k];
      const valor = itens.reduce((a, f) => a + f.valorBase, 0);
      return {
        curva: `Curva ${k}`,
        n: itens.length,
        valor,
        share: total > 0 ? (valor / total) * 100 : 0,
      };
    });
    return { total, resumo, ordenada };
  }, [lista]);

  /* ---- Pulverização (cauda longa) ---- */
  const cauda = useMemo(() => {
    const ordenada = abc.ordenada;
    const total = abc.total;
    const pequenos = ordenada.filter((f) => (total > 0 ? f.valorBase / total : 0) < 0.01);
    const valor = pequenos.reduce((a, f) => a + f.valorBase, 0);
    const ticket = pequenos.length > 0 ? valor / pequenos.length : 0;
    const vals = pequenos.map((f) => f.valorBase).sort((a, b) => a - b);
    const mediana =
      vals.length === 0
        ? 0
        : vals.length % 2
          ? vals[(vals.length - 1) / 2]!
          : (vals[vals.length / 2 - 1]! + vals[vals.length / 2]!) / 2;
    return {
      n: pequenos.length,
      valor,
      share: total > 0 ? (valor / total) * 100 : 0,
      ticket,
      mediana,
    };
  }, [abc]);

  /* ---- Tabela filtrada ---- */
  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return abc.ordenada.filter((f) => {
      const reg = f.regime === "simples" ? "simples" : f.regime === "regular" ? "regular" : "outro";
      if (filtro !== "todos" && reg !== filtro) return false;
      if (!termo) return true;
      return `${f.nome ?? ""} ${f.cnpj ?? ""}`.toLowerCase().includes(termo);
    });
  }, [abc.ordenada, filtro, busca]);

  const totalFiltrado = filtrada.reduce(
    (a, f) => ({
      base: a.base + f.valorBase,
      credito: a.credito + f.valorApurado,
      itens: a.itens + f.itens,
    }),
    { base: 0, credito: 0, itens: 0 },
  );

  if (lista.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Sem notas de compra processadas neste Caso.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* topo: três blocos analíticos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Box titulo="Regime Normal x Simples Nacional">
          <div className="flex items-center gap-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porRegime.partes}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius={44}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {porRegime.partes.map((p) => (
                      <Cell key={p.nome} fill={p.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 space-y-2 text-sm">
              {porRegime.partes.map((p) => (
                <div key={p.nome} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: p.cor }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{p.nome}</p>
                    <p className="tabular-nums font-semibold text-foreground">{brl(p.valor)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {pct(porRegime.total > 0 ? (p.valor / porRegime.total) * 100 : 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Compra de fornecedor do Simples tende a gerar menos crédito de IBS/CBS.
          </p>
        </Box>

        <Box titulo="Curva ABC">
          <div className="space-y-2">
            {abc.resumo.map((r) => (
              <div
                key={r.curva}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2"
              >
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  {r.curva}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.n} forn. ({pct(r.share)})
                </span>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {brl(r.valor)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Curva A concentra ~80% do volume; é onde a renegociação tem maior efeito.
          </p>
        </Box>

        <Box titulo="Pulverização de fornecedores">
          <p className="font-presentation-display text-2xl text-foreground">{brl(cauda.valor)}</p>
          <p className="text-xs text-muted-foreground">
            {pct(cauda.share)} do volume em {cauda.n} fornecedor(es) com menos de 1% cada
          </p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              Ticket médio: <span className="tabular-nums">{brl(cauda.ticket)}</span>
            </p>
            <p>
              Mediana: <span className="tabular-nums">{brl(cauda.mediana)}</span>
            </p>
            <p>
              Maior fornecedor:{" "}
              <span className="tabular-nums">
                {sec4.concentracaoTopPct == null ? "—" : pct(sec4.concentracaoTopPct)}
              </span>
            </p>
          </div>
        </Box>
      </div>

      {/* tabela analítica */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Todos fornecedores</p>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["todos", "Todos"],
                ["simples", "Simples"],
                ["regular", "Normal"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(k)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filtro === k
                    ? "bg-navy text-navy-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou CNPJ"
              className="h-8 w-44 rounded-full border border-border bg-background px-3 text-xs outline-none focus:border-lavender"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Fornecedor</th>
                <th className="px-4 py-2 text-right font-semibold">Total bruto</th>
                <th className="px-4 py-2 text-right font-semibold">Total crédito</th>
                <th className="px-4 py-2 text-right font-semibold">Itens</th>
                <th className="px-4 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((f, i) => {
                const share = abc.total > 0 ? (f.valorBase / abc.total) * 100 : 0;
                return (
                  <tr key={`${f.cnpj ?? f.nome ?? "x"}-${i}`} className="border-t border-border/70">
                    <td className="px-4 py-2">
                      <p className="text-foreground">{f.nome ?? f.cnpj ?? "Sem identificação"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.cnpj ?? "CNPJ não informado"} · {regimeLabel(f.regime)}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(f.valorBase)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {brl(f.valorApurado)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {f.itens}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                          <span
                            className="block h-full rounded-full bg-lavender"
                            style={{ width: `${Math.min(100, share)}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {pct(share)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                <td className="px-4 py-2 text-foreground">{filtrada.length} fornecedor(es)</td>
                <td className="px-4 py-2 text-right tabular-nums">{brl(totalFiltrado.base)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{brl(totalFiltrado.credito)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalFiltrado.itens}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {pct(abc.total > 0 ? (totalFiltrado.base / abc.total) * 100 : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Itens em revisão: {sec4.pendentes}. Crédito considerado apenas para itens já classificados.
      </p>
    </div>
  );
}
