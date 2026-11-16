/**
 * Aba "Preço e margem" do relatório executivo — leitura visual do simulador de
 * markup. Camada puramente de apresentação: usa apenas números já compilados no
 * snapshot do parecer, sem recalcular imposto, crédito ou margem.
 */
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { PrecoChart } from "@/components/cases/ParecerCharts";
import type { ParecerSnapshot } from "@/lib/parecer/tipos";
import { brl } from "@/lib/tax/calc";

const pct = (v: number, sinal = false) =>
  `${sinal && v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function Pill({
  titulo,
  antes,
  depois,
  tone,
}: {
  titulo: string;
  antes: string;
  depois: string;
  tone: "mint" | "magenta" | "sky";
}) {
  const bg =
    tone === "mint" ? "bg-mint-soft" : tone === "magenta" ? "bg-magenta-soft" : "bg-sky-soft";
  return (
    <div className={`rounded-2xl ${bg} px-5 py-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <p className="mt-2 break-words font-presentation-display text-xl leading-tight">
        {antes} <span className="text-muted-foreground">→</span> {depois}
      </p>
      <p className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Antes</span>
        <span>Depois</span>
      </p>
    </div>
  );
}

function BarraEmpilhada({
  rotulo,
  partes,
  total,
}: {
  rotulo: string;
  partes: { label: string; valor: number; cor: string }[];
  total: number;
}) {
  const soma = total > 0 ? total : partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <div className="mt-2 flex h-9 w-full overflow-hidden rounded-lg">
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <div
              key={p.label}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap px-2 text-[11px] font-semibold text-navy"
              style={{ width: `${soma > 0 ? (p.valor / soma) * 100 : 0}%`, background: p.cor }}
              title={`${p.label}: ${brl(p.valor)}`}
            >
              {soma > 0 && p.valor / soma > 0.12 ? p.label : ""}
            </div>
          ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <li key={p.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.cor }}
                aria-hidden
              />
              {p.label} {brl(p.valor)}
            </li>
          ))}
      </ul>
    </div>
  );
}

function Donut({
  titulo,
  total,
  partes,
}: {
  titulo: string;
  total: number;
  partes: { name: string; valor: number; cor: string }[];
}) {
  const data = partes.filter((p) => p.valor > 0);
  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <div className="mt-2 h-36 w-full">
        {data.length === 0 ? (
          <p className="pt-10 text-center text-xs text-muted-foreground">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valor"
                nameKey="name"
                innerRadius="62%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.cor} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => brl(v)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="break-words text-center font-presentation-display text-xs">{brl(total)}</p>
      <ul className="mt-2 space-y-1 text-[11px]">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: d.cor }}
                aria-hidden
              />
              {d.name}
            </span>
            <span className="tabular-nums text-foreground">{brl(d.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COR = {
  navy: "var(--color-navy, #12234a)",
  mint: "var(--color-mint, #4fd1a5)",
  lavender: "var(--color-lavender, #7c5cd6)",
  magenta: "var(--color-magenta, #d6479b)",
  sky: "var(--color-sky, #4f8fd1)",
  amber: "var(--color-amber-tone, #e0a33a)",
};

export function ParecerPrecoVenda({
  sec5,
  sec4,
  ano,
  onAno,
}: {
  sec5: ParecerSnapshot["sec5"];
  sec4: ParecerSnapshot["sec4"];
  ano: number | null;
  onAno: (ano: number) => void;
}) {
  const anos = useMemo(() => sec5.porAno.slice().sort((a, b) => a.ano - b.ano), [sec5.porAno]);
  const anoSel = anos.find((a) => a.ano === ano) ?? anos[anos.length - 1] ?? null;

  const valorAtual = sec5.valorAtual;
  // Somados direto dos itens no snapshot (sec5.desonerado/tributosAtuais), não
  // reconstruídos a partir de 2 pontos da rampa anual — essa reconstrução
  // falhava sempre que esses 2 anos tinham a mesma fração (ex.: 2027 e 2028,
  // antes de a rampa do IBS começar em 2029).
  const desonerado = valorAtual > 0 ? sec5.desonerado : null;
  const tributosAtuais = valorAtual > 0 ? sec5.tributosAtuais : null;

  const precoAno = anoSel?.precoNecessario ?? sec5.precoNecessario;
  const variacaoAno = anoSel?.variacaoPct ?? sec5.variacaoMediaPct;
  const tributosDepois = desonerado == null ? null : Math.max(precoAno - desonerado, 0);
  /** Cenário sem repasse: mantém o preço de hoje e absorve o novo tributo. */
  const liquidoSemRepasse =
    tributosDepois == null ? null : Math.max(valorAtual - tributosDepois, 0);

  const custoAntes = sec4.baseTotal;
  const custoDepois = Math.max(sec4.baseTotal - sec4.creditoTotal, 0);
  const markupAntes = custoAntes > 0 ? valorAtual / custoAntes : null;
  const markupDepois = custoDepois > 0 ? precoAno / custoDepois : null;

  if (valorAtual === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Sem vendas analisadas para calcular o preço necessário.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Linha do tempo da transição */}
      {anos.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Evolução por ano
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecione um ano para ver o detalhe abaixo.
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {anos.map((a) => {
              const ativo = anoSel?.ano === a.ano;
              return (
                <button
                  key={a.ano}
                  type="button"
                  onClick={() => onAno(a.ano)}
                  className={`flex min-w-[132px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                    ativo
                      ? "border-transparent bg-navy text-navy-foreground"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <span className="font-presentation-display text-xl">
                    {String(a.ano).slice(2)}
                  </span>
                  <span className="text-[11px] leading-tight">
                    <span className="block opacity-70">Preço</span>
                    <span className="block font-semibold tabular-nums">{brl(a.precoNecessario)}</span>
                    <span
                      className={`block tabular-nums ${
                        ativo
                          ? "opacity-80"
                          : a.variacaoPct >= 0
                            ? "text-magenta"
                            : "text-mint"
                      }`}
                    >
                      {a.variacaoPct >= 0 ? "↗" : "↘"} {pct(a.variacaoPct, true)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Resultado no ano selecionado */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Resultado em {anoSel?.ano ?? "regime pleno"}
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Novo preço sugerido</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="break-words font-presentation-display text-3xl leading-tight">
                {brl(precoAno)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  variacaoAno >= 0 ? "bg-magenta-soft text-magenta" : "bg-mint-soft text-mint"
                }`}
              >
                {pct(variacaoAno, true)}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Piso técnico que mantém a margem de hoje.
            </p>
          </div>
          <Pill
            titulo="Custo de aquisição"
            antes={brl(custoAntes)}
            depois={brl(custoDepois)}
            tone="mint"
          />
          <Pill
            titulo="Tributos"
            antes={tributosAtuais == null ? "—" : brl(tributosAtuais)}
            depois={tributosDepois == null ? "—" : brl(tributosDepois)}
            tone="magenta"
          />
        </div>
      </div>

      {/* Venda: antes x depois x sem repasse */}
      <div className="rounded-2xl border border-transparent bg-lavender-soft p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Venda (valor sugerido)
        </p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-2">
            <div className="rounded-xl bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Antes</p>
              <p className="mt-1 break-words font-presentation-display text-lg">{brl(valorAtual)}</p>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">
                Líquido {desonerado == null ? "—" : brl(desonerado)}
              </p>
            </div>
            <div className="rounded-xl bg-mint-soft p-3">
              <p className="text-[11px] text-muted-foreground">Depois</p>
              <p className="mt-1 break-words font-presentation-display text-lg">{brl(precoAno)}</p>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">
                Líquido {desonerado == null ? "—" : brl(desonerado)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-tone-soft p-3">
              <p className="text-[11px] text-muted-foreground">Sem repasse</p>
              <p className="mt-1 break-words font-presentation-display text-lg">{brl(valorAtual)}</p>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">
                Líquido {liquidoSemRepasse == null ? "—" : brl(liquidoSemRepasse)}
              </p>
            </div>
          </div>
          <div className="space-y-4 rounded-xl bg-card p-4">
            <BarraEmpilhada
              rotulo="Antes"
              total={valorAtual}
              partes={[
                { label: "Valor líquido", valor: desonerado ?? valorAtual, cor: COR.sky },
                { label: "Tributos atuais", valor: tributosAtuais ?? 0, cor: COR.amber },
              ]}
            />
            <BarraEmpilhada
              rotulo="Depois"
              total={precoAno}
              partes={[
                { label: "Valor líquido", valor: desonerado ?? precoAno, cor: COR.mint },
                { label: "IBS/CBS", valor: tributosDepois ?? 0, cor: COR.magenta },
              ]}
            />
            {liquidoSemRepasse != null ? (
              <BarraEmpilhada
                rotulo="Sem repasse (preço mantido)"
                total={valorAtual}
                partes={[
                  { label: "Valor líquido", valor: liquidoSemRepasse, cor: COR.lavender },
                  { label: "IBS/CBS", valor: tributosDepois ?? 0, cor: COR.magenta },
                ]}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Três módulos temáticos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-transparent bg-mint-soft p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Aquisição
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Antes</p>
              <p className="mt-1 break-words font-presentation-display text-base">{brl(custoAntes)}</p>
            </div>
            <div className="rounded-xl bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Depois</p>
              <p className="mt-1 break-words font-presentation-display text-base">{brl(custoDepois)}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-card p-3">
            <BarraEmpilhada
              rotulo="Composição da compra"
              total={custoAntes}
              partes={[
                { label: "Custo efetivo", valor: custoDepois, cor: COR.sky },
                { label: "Crédito IBS/CBS", valor: sec4.creditoTotal, cor: COR.mint },
              ]}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-transparent bg-sky-soft p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Índices e markup
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1 font-semibold">Índice</th>
                <th className="w-24 py-1 pl-3 text-right font-semibold">Antes</th>
                <th className="w-24 py-1 pl-3 text-right font-semibold">Depois</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-t border-border/60">
                <td className="py-1.5 text-muted-foreground">Markup</td>
                <td className="py-1.5 pl-3 text-right">
                  {markupAntes == null ? "—" : markupAntes.toFixed(3)}
                </td>
                <td className="py-1.5 pl-3 text-right">
                  {markupDepois == null ? "—" : markupDepois.toFixed(3)}
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 text-muted-foreground">Markup %</td>
                <td className="py-1.5 pl-3 text-right">
                  {markupAntes == null ? "—" : pct((markupAntes - 1) * 100)}
                </td>
                <td className="py-1.5 pl-3 text-right">
                  {markupDepois == null ? "—" : pct((markupDepois - 1) * 100)}
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 text-muted-foreground">Carga na venda</td>
                <td className="py-1.5 pl-3 text-right">
                  {tributosAtuais == null || valorAtual === 0
                    ? "—"
                    : pct((tributosAtuais / valorAtual) * 100)}
                </td>
                <td className="py-1.5 pl-3 text-right">
                  {tributosDepois == null || precoAno === 0
                    ? "—"
                    : pct((tributosDepois / precoAno) * 100)}
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 text-muted-foreground">Crédito na compra</td>
                <td className="py-1.5 pl-3 text-right">—</td>
                <td className="py-1.5 pl-3 text-right">
                  {custoAntes === 0 ? "—" : pct((sec4.creditoTotal / custoAntes) * 100)}
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1.5 text-muted-foreground">Alíquota plena aplicada</td>
                <td className="py-1.5 pl-3 text-right">—</td>
                <td className="py-1.5 pl-3 text-right">
                  {valorAtual === 0 ? "—" : pct(sec5.aliquotaPlenaMedia * 100)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-transparent bg-magenta-soft p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tributos a recolher
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Donut
              titulo="Antes"
              total={tributosAtuais ?? 0}
              partes={[
                { name: "Tributos atuais", valor: tributosAtuais ?? 0, cor: COR.amber },
                { name: "Crédito atual", valor: 0, cor: COR.sky },
              ]}
            />
            <Donut
              titulo="Depois"
              total={Math.max((tributosDepois ?? 0) - sec4.creditoTotal, 0)}
              partes={[
                {
                  name: "IBS/CBS devido",
                  valor: Math.max((tributosDepois ?? 0) - sec4.creditoTotal, 0),
                  cor: COR.magenta,
                },
                { name: "Crédito de compras", valor: sec4.creditoTotal, cor: COR.mint },
              ]}
            />
          </div>
        </div>
      </div>

      <PrecoChart porAno={sec5.porAno} />

      {sec5.porPerfil.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Perfil de cliente</th>
                <th className="px-4 py-2 text-right font-semibold">Itens</th>
                <th className="px-4 py-2 text-right font-semibold">Preço hoje</th>
                <th className="px-4 py-2 text-right font-semibold">Preço necessário</th>
              </tr>
            </thead>
            <tbody>
              {sec5.porPerfil.map((p) => (
                <tr key={p.perfil} className="border-t border-border/70">
                  <td className="px-4 py-2 text-foreground">{p.perfil}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {p.itens}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {brl(p.valorAtual)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-foreground">
                    {brl(p.precoNecessario)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Piso técnico de neutralidade tributária, não recomendação comercial de preço.
      </p>
    </div>
  );
}
