/**
 * Aba "Serviços tomados" do relatório executivo.
 * Junta o que foi apurado nota a nota (NFS-e) com o que foi informado na
 * planilha de contas a pagar (sec4b, já compilado) — camada puramente
 * visual, não recalcula débito/crédito apurado. O crédito de IBS/CBS
 * (potencial, aproveitado, deixado na mesa) é calculado aqui, ano a ano,
 * pela mesma alíquota do motor de regimes (cbsIbsCreditoPctPorAno):
 * Simples Nacional não gera crédito (convenção já adotada no resto do
 * sistema); os demais regimes, alíquota cheia do ano selecionado.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Notice } from "@/components/simulator/ui";
import type { ParecerSnapshot, ServicoTomadoSnap } from "@/lib/parecer/tipos";
import { brl, cbsIbsCreditoPctPorAno } from "@/lib/tax/calc";

const ANOS_TRANSICAO = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

const COR_APROVEITADO = "#2a78d6";
const COR_PERDIDO = "#e34948";
const COR_PERDIDO_CLARO = "#e3494880";
const COR_SIMPLES = "#1baf7a";
const COR_REGULAR = "#2a78d6";
const COR_NAO_CLASSIFICADO = "#a3a3a3";

const round2 = (v: number) => Math.round(v * 100) / 100;
const pct = (v: number, d = 1) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

function chave(f: Pick<ServicoTomadoSnap, "cnpj" | "nome">): string {
  return f.cnpj ?? f.nome ?? "sem identificação";
}

function regimeInfo(r: string | null | undefined): { label: string; cls: string } {
  if (r === "simples") {
    return {
      label: "Simples Nacional",
      cls: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800",
    };
  }
  if (r === "regular") {
    return {
      label: "Regime Regular",
      cls: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800",
    };
  }
  return {
    label: "Não classificado",
    cls: "bg-secondary text-muted-foreground ring-1 ring-inset ring-border",
  };
}

/** Crédito potencial, aproveitado e deixado na mesa deste fornecedor no ano. */
function calcCredito(f: ServicoTomadoSnap, ano: number) {
  const { cbsPct, ibsPct } = cbsIbsCreditoPctPorAno(ano);
  const potencial = round2((f.valorBase * (cbsPct + ibsPct)) / 100);
  const aproveitado = f.regime === "simples" ? 0 : potencial;
  return { potencial, aproveitado, perdido: round2(potencial - aproveitado), cbsPct, ibsPct };
}

function Kpi({
  titulo,
  valor,
  sub,
  destaque,
}: {
  titulo: string;
  valor: string;
  sub?: string | undefined;
  destaque?: boolean | undefined;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-5 ${
        destaque ? "border-danger/40 bg-danger-soft" : "border-border bg-card"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p
        className={`mt-2 break-words font-presentation-display text-2xl leading-tight tabular-nums tracking-tight xl:text-3xl ${
          destaque ? "text-danger" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Card({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-sm font-bold text-foreground">{titulo}</h4>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/* ---------------- Lista de prestadores ---------------- */

type ColunaOrdenavel = "nome" | "regime" | "share" | "valorBase" | "potencial" | "aproveitado" | "perdido";

function ListaPrestadores({
  fornecedores,
  baseTotal,
  ano,
  onAbrir,
}: {
  fornecedores: ServicoTomadoSnap[];
  baseTotal: number;
  ano: number;
  onAbrir: (f: ServicoTomadoSnap) => void;
}) {
  const [sortK, setSortK] = useState<ColunaOrdenavel>("perdido");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const linhas = useMemo(
    () =>
      fornecedores.map((f) => ({
        f,
        ...calcCredito(f, ano),
        share: baseTotal > 0 ? (f.valorBase / baseTotal) * 100 : 0,
      })),
    [fornecedores, ano, baseTotal],
  );

  const creditoAproveitado = linhas.reduce((a, l) => a + l.aproveitado, 0);
  const creditoPerdido = linhas.reduce((a, l) => a + l.perdido, 0);
  const maior = fornecedores[0];
  const concentracaoPct = maior && baseTotal > 0 ? (maior.valorBase / baseTotal) * 100 : null;

  const porRegime = { simples: 0, regular: 0, outro: 0 };
  for (const f of fornecedores) {
    if (f.regime === "simples") porRegime.simples += f.valorBase;
    else if (f.regime === "regular") porRegime.regular += f.valorBase;
    else porRegime.outro += f.valorBase;
  }
  const segmentos = [
    { k: "regular", label: "Regime Regular", valor: porRegime.regular, cor: COR_REGULAR },
    { k: "simples", label: "Simples Nacional", valor: porRegime.simples, cor: COR_SIMPLES },
    { k: "outro", label: "Não classificado", valor: porRegime.outro, cor: COR_NAO_CLASSIFICADO },
  ].filter((s) => s.valor > 0);

  const ranking = linhas
    .filter((l) => l.perdido > 0)
    .sort((a, b) => b.perdido - a.perdido)
    .slice(0, 5);
  const rankingMax = ranking[0]?.perdido ?? 1;

  const ordenadas = useMemo(() => {
    const copy = linhas.slice();
    copy.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortK === "nome") {
        va = a.f.nome ?? a.f.cnpj ?? "";
        vb = b.f.nome ?? b.f.cnpj ?? "";
      } else if (sortK === "regime") {
        va = regimeInfo(a.f.regime).label;
        vb = regimeInfo(b.f.regime).label;
      } else if (sortK === "valorBase") {
        va = a.f.valorBase;
        vb = b.f.valorBase;
      } else {
        va = a[sortK];
        vb = b[sortK];
      }
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return cmp * sortDir;
    });
    return copy;
  }, [linhas, sortK, sortDir]);

  const onSort = (k: ColunaOrdenavel) => {
    if (k === sortK) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortK(k);
      setSortDir(k === "nome" || k === "regime" ? 1 : -1);
    }
  };

  const colunas: { k: ColunaOrdenavel; label: string; align?: "right" }[] = [
    { k: "nome", label: "Prestador" },
    { k: "regime", label: "Regime" },
    { k: "share", label: "% do custo", align: "right" },
    { k: "valorBase", label: "Valor", align: "right" },
    { k: "potencial", label: "Potencial", align: "right" },
    { k: "aproveitado", label: "Aproveitado", align: "right" },
    { k: "perdido", label: "Deixado na mesa", align: "right" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          titulo="Base de serviços tomados"
          valor={brl(baseTotal)}
          sub={`${fornecedores.length} prestador${fornecedores.length === 1 ? "" : "es"} no período`}
        />
        <Kpi
          titulo="Crédito de IBS/CBS aproveitado"
          valor={brl(creditoAproveitado)}
          sub={baseTotal > 0 ? `${pct((creditoAproveitado / baseTotal) * 100)} do valor pago` : undefined}
        />
        <Kpi
          titulo="Crédito deixado na mesa"
          valor={brl(creditoPerdido)}
          sub={
            creditoPerdido > 0
              ? "Prestadores do Simples Nacional não transferem crédito"
              : "Todos os prestadores transferem crédito"
          }
          destaque
        />
        <Kpi
          titulo="Concentração no maior prestador"
          valor={concentracaoPct == null ? "-" : pct(concentracaoPct, 0)}
          sub={
            maior
              ? fornecedores.length === 1
                ? "Toda a base depende de um único prestador"
                : `Maior prestador: ${maior.nome ?? maior.cnpj ?? "—"}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Custo por regime do prestador"
          sub="Quanto do valor pago vai para cada regime. Só prestadores regulares geram crédito de IBS/CBS."
        >
          <div className="flex h-8 gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Composição do custo por regime">
            {segmentos.map((s) => (
              <div key={s.k} style={{ flex: s.valor, backgroundColor: s.cor }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {segmentos.map((s) => (
              <span key={s.k} className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
                {s.label} <b className="text-foreground">{pct((s.valor / baseTotal) * 100, 0)}</b> ·{" "}
                {brl(s.valor)}
              </span>
            ))}
          </div>
        </Card>

        <Card titulo="Crédito deixado na mesa, por prestador" sub="Maiores valores no ano selecionado (até 5).">
          {ranking.length === 0 ? (
            <Notice>Nenhum crédito deixado na mesa.</Notice>
          ) : (
            <div className="space-y-2">
              {ranking.map((l) => (
                <div key={chave(l.f)} className="grid grid-cols-[minmax(0,120px)_1fr] items-center gap-2 sm:grid-cols-[150px_1fr]">
                  <p className="truncate text-xs text-muted-foreground" title={l.f.nome ?? undefined}>
                    {l.f.nome ?? l.f.cnpj}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 min-w-[2px] rounded-r bg-danger"
                      style={{ width: `${Math.max(2, (l.perdido / rankingMax) * 100)}%` }}
                    />
                    <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
                      {brl(l.perdido)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {colunas.map((c) => (
                <th key={c.k} className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onSort(c.k)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    {sortK === c.k ? <span aria-hidden>{sortDir === 1 ? "▲" : "▼"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => {
              const reg = regimeInfo(l.f.regime);
              return (
                <tr
                  key={chave(l.f)}
                  onClick={() => onAbrir(l.f)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAbrir(l.f);
                  }}
                  className="cursor-pointer border-t border-border hover:bg-secondary/60"
                >
                  <td className="px-3 py-2 text-foreground">
                    {l.f.nome ?? l.f.cnpj ?? "Sem identificação"}
                    <span className="block text-xs text-muted-foreground">
                      {l.f.fonte === "xml" ? "Apurado por XML" : "Estimado pela planilha"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${reg.cls}`}>
                      {reg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span
                      className="mr-2 inline-block h-2 rounded-r bg-muted-foreground/40 align-middle"
                      style={{ width: `${Math.max(2, l.share * 0.6)}px` }}
                    />
                    {pct(l.share, 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(l.f.valorBase)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(l.potencial)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(l.aproveitado)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${l.perdido > 0 ? "font-semibold text-danger" : ""}`}>
                    {brl(l.perdido)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Detalhe do prestador ---------------- */

function TransicaoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const cbs = payload.find((p) => p.dataKey === "cbs")?.value ?? 0;
  const ibs = payload.find((p) => p.dataKey === "ibs")?.value ?? 0;
  return (
    <div className="min-w-[150px] rounded-lg border border-border bg-card p-2.5 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label}</p>
      <div className="mt-1 flex justify-between gap-3 text-muted-foreground">
        <span>CBS</span>
        <span className="font-medium text-foreground">{brl(cbs)}</span>
      </div>
      <div className="flex justify-between gap-3 text-muted-foreground">
        <span>IBS</span>
        <span className="font-medium text-foreground">{brl(ibs)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-3 border-t border-border pt-1 text-muted-foreground">
        <span>Total</span>
        <span className="font-semibold text-foreground">{brl(cbs + ibs)}</span>
      </div>
    </div>
  );
}

function DetalhePrestador({
  f,
  baseTotal,
  ano,
  onAno,
  onVoltar,
}: {
  f: ServicoTomadoSnap;
  baseTotal: number;
  ano: number;
  onAno: (ano: number) => void;
  onVoltar: () => void;
}) {
  const simples = f.regime === "simples";
  const c = calcCredito(f, ano);
  const reg = regimeInfo(f.regime);

  const dadosTransicao = useMemo(
    () =>
      ANOS_TRANSICAO.map((a) => {
        const { cbsPct, ibsPct } = cbsIbsCreditoPctPorAno(a);
        return {
          ano: a,
          cbs: round2((f.valorBase * cbsPct) / 100),
          ibs: round2((f.valorBase * ibsPct) / 100),
        };
      }),
    [f.valorBase],
  );

  const acumulado2027a2033 = ANOS_TRANSICAO.filter((a) => a >= 2027).reduce(
    (t, a) => t + calcCredito(f, a).potencial,
    0,
  );
  const mais2026 = calcCredito(f, 2026).potencial;
  const r = (c.cbsPct + c.ibsPct) / 100;
  const aumentoQueCompensa = r > 0 && r < 1 ? (r / (1 - r)) * 100 : 0;
  const potencial2033 = calcCredito(f, 2033).potencial;

  const wA = c.potencial > 0 ? (c.aproveitado / c.potencial) * 100 : 0;
  const wP = 100 - wA;

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={onVoltar}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Todos os prestadores
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="truncate font-presentation-display text-xl text-foreground">
            {f.nome ?? f.cnpj ?? "Sem identificação"}
          </h3>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${reg.cls}`}>
            {reg.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {f.cnpj ?? "CNPJ não informado"} · {f.fonte === "xml" ? "Apurado por XML" : "Estimado pela planilha"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          titulo={`Crédito deixado na mesa · ${ano}`}
          valor={brl(c.perdido)}
          sub={simples ? "Se este prestador fosse regular" : "Este prestador já transfere crédito"}
          destaque={simples}
        />
        <Kpi titulo="Valor no período" valor={brl(f.valorBase)} sub="Base do cálculo" />
        <Kpi
          titulo="Crédito aproveitado"
          valor={brl(c.aproveitado)}
          sub={f.valorBase > 0 ? `${pct((c.aproveitado / f.valorBase) * 100)} sobre o valor pago` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          titulo={`Crédito potencial x aproveitado em ${ano}`}
          sub={`Alíquota de IBS/CBS de ${ano}: ${pct(c.cbsPct + c.ibsPct, 2)} sobre ${brl(f.valorBase)}.`}
        >
          <p className="text-xs text-muted-foreground">
            Crédito potencial: <b className="text-foreground">{brl(c.potencial)}</b>
          </p>
          <div className="mt-2 flex h-8 gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Crédito potencial dividido entre aproveitado e deixado na mesa">
            {wA > 0 ? <div style={{ flex: wA, backgroundColor: COR_APROVEITADO }} /> : null}
            {wP > 0 ? <div style={{ flex: wP, backgroundColor: COR_PERDIDO }} /> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_APROVEITADO }} />
              Aproveitado <b className="text-foreground">{brl(c.aproveitado)}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_PERDIDO }} />
              Deixado na mesa <b className="text-foreground">{brl(c.perdido)}</b>
            </span>
          </div>
          {simples ? (
            <div className="mt-3 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              <b className="text-foreground">Prestador no Simples Nacional não transfere crédito de IBS/CBS.</b> Com
              um prestador regular do mesmo serviço, o crédito seria de {brl(c.potencial)} em {ano}.
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <b>Este prestador transfere o crédito integral</b>, então não há crédito deixado na mesa.
            </div>
          )}
        </Card>

        <Card
          titulo="Crédito deixado na mesa ao longo da transição"
          sub="O salto de 2027 é a CBS cheia (8,8%) substituindo o PIS/COFINS; o IBS entra aos poucos até 2033."
        >
          {!simples ? (
            <Notice>Sem crédito perdido em nenhum ano: este prestador já gera crédito.</Notice>
          ) : (
            <>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosTransicao} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="ano"
                      tick={({ x, y, payload }) => (
                        <text
                          x={x}
                          y={y + 12}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={payload.value === ano ? 700 : 400}
                          fill={payload.value === ano ? "var(--foreground)" : "var(--muted-foreground)"}
                        >
                          {payload.value}
                        </text>
                      )}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tickFormatter={(v: number) => brl(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={64} />
                    <Tooltip content={<TransicaoTooltip />} cursor={{ fill: "rgba(128,128,128,.08)" }} />
                    <Bar
                      dataKey="cbs"
                      stackId="t"
                      cursor="pointer"
                      onClick={(d: { ano: number }) => onAno(d.ano)}
                    >
                      {dadosTransicao.map((d) => (
                        <Cell
                          key={d.ano}
                          fill={COR_PERDIDO}
                          fillOpacity={d.ano === 2026 ? 0.45 : 1}
                          stroke={d.ano === 2026 ? COR_PERDIDO : "transparent"}
                          strokeDasharray={d.ano === 2026 ? "3 2" : undefined}
                          strokeWidth={d.ano === ano ? 2 : d.ano === 2026 ? 1 : 0}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="ibs"
                      stackId="t"
                      radius={[3, 3, 0, 0]}
                      cursor="pointer"
                      onClick={(d: { ano: number }) => onAno(d.ano)}
                    >
                      {dadosTransicao.map((d) => (
                        <Cell
                          key={d.ano}
                          fill={COR_PERDIDO_CLARO}
                          fillOpacity={d.ano === 2026 ? 0.45 : 1}
                          stroke={d.ano === ano ? COR_PERDIDO : "transparent"}
                          strokeWidth={d.ano === ano ? 2 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_PERDIDO }} />
                  CBS
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_PERDIDO_CLARO }} />
                  IBS
                </span>
                <span>2026: alíquota de teste, compensável com PIS/COFINS</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {simples ? (
        <div className="space-y-3">
          <div>
            <h3 className="font-presentation-display text-lg text-foreground">Como recuperar esse crédito</h3>
            <p className="text-xs text-muted-foreground">
              Comparação das três alternativas, com a mesma metodologia da tela (crédito = alíquota × valor da
              nota).
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col rounded-xl border border-border border-t-4 border-t-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Alternativa 1
              </p>
              <h5 className="mt-1 text-sm font-bold text-foreground">Manter o prestador no Simples</h5>
              <p className="mt-1 text-xs text-muted-foreground">
                Nada muda na relação. Pela convenção do sistema, o crédito é zero.
              </p>
              <div className="mt-2 flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Crédito em {ano}</span>
                <b className="tabular-nums text-foreground">R$ 0</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Acumulado 2027–2033</span>
                <b className="tabular-nums text-foreground">R$ 0</b>
              </div>
              <p className="mt-auto pt-2 text-xs text-muted-foreground">
                <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  Atenção
                </span>
                O crédito perdido cresce a cada ano e chega a {brl(potencial2033)} em 2033.
              </p>
            </div>

            <div className="flex flex-col rounded-xl border border-sky-300 bg-card p-4 shadow-[0_0_0_1px] shadow-sky-300 dark:border-sky-700 dark:shadow-sky-800">
              <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Alternativa 2</span>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                  Hipótese incluída
                </span>
              </p>
              <h5 className="mt-1 text-sm font-bold text-foreground">
                Pedir que o prestador opte pelo Simples híbrido
              </h5>
              <p className="mt-1 text-xs text-muted-foreground">
                O prestador recolhe o IBS/CBS por fora do DAS, e o imposto destacado na nota vira crédito para o
                cliente.
              </p>
              <div className="mt-2 flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Crédito em {ano}</span>
                <b className="tabular-nums text-foreground">{brl(c.potencial)}</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Acumulado 2027–2033</span>
                <b className="tabular-nums text-foreground">{brl(acumulado2027a2033)}</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Mais 2026 (ano de teste)</span>
                <b className="tabular-nums text-foreground">{brl(mais2026)}</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Aumento de preço que ainda compensa</span>
                <b className="tabular-nums text-foreground">até {pct(aumentoQueCompensa)}</b>
              </div>
              <p className="mt-auto pt-2 text-xs text-muted-foreground">
                <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  Atenção
                </span>
                Depende da opção do prestador e pode mudar o preço da nota. Base legal e condições:{" "}
                <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5 italic text-muted-foreground">
                  a confirmar pelo analista
                </span>
              </p>
            </div>

            <div className="flex flex-col rounded-xl border border-border border-t-4 border-t-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Alternativa 3
              </p>
              <h5 className="mt-1 text-sm font-bold text-foreground">Trocar por um prestador regular</h5>
              <p className="mt-1 text-xs text-muted-foreground">
                Contratar o mesmo tipo de serviço de um prestador no regime regular de IBS/CBS.
              </p>
              <div className="mt-2 flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Crédito em {ano}</span>
                <b className="tabular-nums text-foreground">{brl(c.potencial)}</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Acumulado 2027–2033</span>
                <b className="tabular-nums text-foreground">{brl(acumulado2027a2033)}</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Mais 2026 (ano de teste)</span>
                <b className="tabular-nums text-foreground">{brl(mais2026)}</b>
              </div>
              <div className="flex justify-between border-t border-border py-1.5 text-xs text-muted-foreground">
                <span>Aumento de preço que ainda compensa</span>
                <b className="tabular-nums text-foreground">até {pct(aumentoQueCompensa)}</b>
              </div>
              <p className="mt-auto pt-2 text-xs text-muted-foreground">
                <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  Atenção
                </span>
                Custo de troca, qualidade do serviço e preço do novo prestador.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Componente principal ---------------- */

export function ParecerServicosTomados({
  sec4b,
  ano,
  onAno,
  syncUrl,
}: {
  sec4b: ParecerSnapshot["sec4b"];
  ano: number;
  onAno: (ano: number) => void;
  syncUrl?: boolean | undefined;
}) {
  const [selecionado, setSelecionado] = useState<string | null>(() => {
    if (!syncUrl || typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("prestador");
  });

  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (selecionado) params.set("prestador", selecionado);
    else params.delete("prestador");
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [selecionado, syncUrl]);

  if (sec4b.fornecedores.length === 0) {
    return (
      <Notice>
        Nenhum serviço tomado apurado ainda. Envie o XML das notas de serviço (NFS-e) tomadas ou,
        na falta delas, a planilha de contas a pagar de serviços tomados em "Documentos".
      </Notice>
    );
  }

  const aberto = selecionado
    ? sec4b.fornecedores.find((f) => chave(f) === selecionado)
    : undefined;

  return (
    <div className="space-y-4">
      {aberto ? (
        <DetalhePrestador
          f={aberto}
          baseTotal={sec4b.baseTotal}
          ano={ano}
          onAno={onAno}
          onVoltar={() => setSelecionado(null)}
        />
      ) : (
        <ListaPrestadores
          fornecedores={sec4b.fornecedores}
          baseTotal={sec4b.baseTotal}
          ano={ano}
          onAbrir={(f) => setSelecionado(chave(f))}
        />
      )}

      <div className="space-y-1.5 pt-2 text-xs text-muted-foreground">
        <p>
          A alíquota plena de IBS/CBS e o cronograma de transição são estimativas: dependem de
          regulamentação e de lei complementar ainda em ajuste.
        </p>
        <p>
          Crédito gerado por fornecedor optante pelo Simples Nacional não é modelado; pela
          convenção adotada, entra como não gerador de crédito. A hipótese do Simples híbrido é
          estimada com a mesma alíquota geral de um prestador regular, sem redução por atividade,
          e não considera efeitos no preço.
        </p>
        <p>
          Os valores deste relatório refletem os documentos e parâmetros disponíveis no momento da
          geração desta versão. Não substitui aconselhamento jurídico ou tributário individualizado.
        </p>
      </div>
    </div>
  );
}
