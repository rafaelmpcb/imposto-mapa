/**
 * Gráficos do relatório executivo (Parecer Padrão).
 * Camada puramente visual: recebe os números já compilados no snapshot e
 * apenas os desenha. Nada aqui recalcula imposto, crédito, DRE ou caixa.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { brl } from "@/lib/tax/calc";
import { CATEGORIAS_IMPOSTO, type CategoriaImposto } from "@/lib/parecer/impostos";
import type { ParecerSnapshot } from "@/lib/parecer/tipos";
import type { ParcelaSaldo } from "@/lib/saldos/calculo";

const compact = (v: number) =>
  v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const pctFmt = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const COR_ATUAL = "var(--color-danger, #b91c1c)";
const COR_PROJ = "var(--color-success, #15803d)";
const COR_NAVY = "var(--color-navy, #12234a)";

/** Paleta para séries por regime (linha da transição) — o regime atual
 * sempre entra primeiro na lista de rótulos e usa a cor navy; as demais
 * alternativas ciclam pelas outras cores já usadas no resto do relatório. */
export const PALETA_REGIMES = [
  COR_NAVY,
  "var(--color-lavender, #7c5cd6)",
  "var(--color-sky, #4f8fd1)",
  "var(--color-amber-tone, #e0a33a)",
  "var(--color-magenta, #d6479b)",
];

/** Cor fixa por categoria de imposto — usada na tabela, nas barras
 * empilhadas e na ponte do Lucro Real, para o leitor associar a mesma cor
 * ao mesmo tributo nas três peças. */
export const CORES_IMPOSTO: Record<CategoriaImposto, string> = {
  PIS: "var(--color-sky, #4f8fd1)",
  COFINS: "var(--color-lavender, #7c5cd6)",
  "ISS/ICMS": "var(--color-amber-tone, #e0a33a)",
  "IBS + CBS": COR_NAVY,
  IRPJ: "var(--color-magenta, #d6479b)",
  CSLL: "var(--color-mint, #2fae8b)",
  CPP: "var(--color-warning, #c08a1e)",
  Outros: "var(--color-muted-foreground, #6b7280)",
};

function TooltipCaixa({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-[190px] rounded-lg border border-border bg-card p-3 text-xs shadow-md">
      {children}
    </div>
  );
}

function TooltipLinha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${destaque ? "mt-1 border-t border-border/60 pt-1" : ""}`}
    >
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium text-foreground">{valor}</span>
    </div>
  );
}

/** Tooltip do gráfico de carga ao longo da transição: além do percentual de
 * cada regime, mostra o valor em R$/mês e a vantagem entre o regime atual e
 * a alternativa comparada — mesma leitura do mockup. */
function CargaTransicaoTooltip({
  active,
  payload,
  label,
  labels,
  atualLabel,
  alternativaLabel,
}: {
  active?: boolean;
  payload?: { payload: Record<string, number | undefined> }[];
  label?: number;
  labels: string[];
  atualLabel: string | null;
  alternativaLabel: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const dados = payload[0]?.payload;
  if (!dados) return null;
  const totalAtual = atualLabel ? dados[`${atualLabel}__total`] : undefined;
  const totalAlternativa = alternativaLabel ? dados[`${alternativaLabel}__total`] : undefined;
  const vantagem = totalAtual != null && totalAlternativa != null ? totalAlternativa - totalAtual : null;
  return (
    <TooltipCaixa>
      <p className="mb-1 text-sm font-semibold text-foreground">Ano {label}</p>
      {labels.map((l) => {
        const rate = dados[l];
        const total = dados[`${l}__total`];
        if (rate == null) return null;
        return (
          <TooltipLinha key={l} rotulo={l} valor={`${pctFmt(rate)} · ${brl(total ?? 0)}`} />
        );
      })}
      {vantagem != null && atualLabel ? (
        <TooltipLinha
          destaque
          rotulo={`Vantagem de ${atualLabel}`}
          valor={`${brl(Math.abs(vantagem))}/mês`}
        />
      ) : null}
    </TooltipCaixa>
  );
}

/** Tooltip do gráfico de variação mensal: custo atual, custo com a reforma
 * e o aumento/redução do ano, igual ao mockup. */
function VariacaoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: { hoje: number; reforma: number; delta: number } }[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const reducao = d.delta < 0;
  return (
    <TooltipCaixa>
      <p className="mb-1 text-sm font-semibold text-foreground">Ano {label}</p>
      <TooltipLinha rotulo="Custo com a reforma" valor={brl(d.reforma)} />
      <TooltipLinha rotulo="Custo atual" valor={brl(d.hoje)} />
      <TooltipLinha
        destaque
        rotulo={reducao ? "Redução" : "Aumento"}
        valor={`${brl(Math.abs(d.delta))}/mês`}
      />
    </TooltipCaixa>
  );
}

function ChartBox({
  titulo,
  descricao,
  children,
  altura = 240,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactElement;
  altura?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {descricao ? <p className="mt-1 text-sm text-muted-foreground">{descricao}</p> : null}
      <div className="mt-4 w-full" style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const eixo = { tickLine: false, axisLine: false, fontSize: 12 } as const;

/** Resultado líquido atual x projetado no ano selecionado. */
export function ResultadoAnoChart({
  atual,
  projetado,
  ano,
}: {
  atual: number;
  projetado: number;
  ano: number | null;
}) {
  const data = [
    { name: "Hoje", valor: Math.round(atual), tone: "atual" },
    { name: `Reforma ${ano ?? ""}`.trim(), valor: Math.round(projetado), tone: "reforma" },
  ];
  return (
    <ChartBox
      titulo="Resultado líquido: hoje x reforma"
      descricao="Comparação direta do resultado do ano selecionado."
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" {...eixo} />
        <YAxis tickFormatter={compact} width={56} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.tone === "atual" ? COR_ATUAL : COR_PROJ} />
          ))}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}

/** Evolução do resultado ao longo da transição, ano a ano. */
export function TransicaoChart({ linhas }: { linhas: ParecerSnapshot["sec6"]["linhas"] }) {
  const anos = Array.from(new Set(linhas.map((l) => l.ano))).sort((a, b) => a - b);
  const data = anos.map((ano) => {
    const doAno = linhas.filter((l) => l.ano === ano);
    const atual = doAno.find((l) => l.cenario === "atual");
    const proj = doAno.find((l) => l.cenario !== "atual");
    return {
      name: String(ano),
      Atual: atual?.resultadoLiquido == null ? null : Math.round(atual.resultadoLiquido),
      Projetado: proj?.resultadoLiquido == null ? null : Math.round(proj.resultadoLiquido),
    };
  });
  return (
    <ChartBox
      titulo="Evolução da transição"
      descricao="Resultado líquido projetado ano a ano até 2033."
    >
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" {...eixo} />
        <YAxis tickFormatter={compact} width={56} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="Atual" stroke={COR_ATUAL} strokeWidth={2} dot connectNulls />
        <Line
          type="monotone"
          dataKey="Projetado"
          stroke={COR_PROJ}
          strokeWidth={2}
          dot
          connectNulls
        />
      </LineChart>
    </ChartBox>
  );
}

/** Carga tributária (% da receita) de cada regime ao longo da transição —
 * o primeiro rótulo em `labels` é tratado como o regime atual (cor navy); os
 * demais ciclam pela paleta. O ano selecionado no filtro da página fica
 * marcado com uma linha de referência e pontos maiores nas séries. */
export function CargaTransicaoChart({
  pontos,
  labels,
  anoSel,
  cargaAtualPct,
  atualLabel,
  alternativaLabel,
}: {
  /** Cada ponto traz, por rótulo de regime: a carga % (chave = rótulo) e o
   * valor em R$/mês (chave = `${rótulo}__total`) — o tooltip usa os dois. */
  pontos: ({ ano: number } & Record<string, number | undefined>)[];
  labels: string[];
  anoSel: number | null;
  cargaAtualPct: number | null;
  atualLabel: string | null;
  alternativaLabel: string | null;
}) {
  if (pontos.length === 0 || labels.length === 0) return null;
  return (
    <ChartBox
      titulo="Carga tributária ao longo da transição"
      descricao="Percentual da receita, por regime, de 2026 a 2033."
      altura={280}
    >
      <LineChart data={pontos} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="ano" {...eixo} />
        <YAxis tickFormatter={pctFmt} width={48} {...eixo} />
        <Tooltip
          content={
            <CargaTransicaoTooltip
              labels={labels}
              atualLabel={atualLabel}
              alternativaLabel={alternativaLabel}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {cargaAtualPct != null ? (
          <ReferenceLine
            y={cargaAtualPct}
            stroke="var(--color-muted-foreground, #6b7280)"
            strokeDasharray="4 3"
            label={{
              value: `carga atual: ${pctFmt(cargaAtualPct)}`,
              position: "insideBottomRight",
              fontSize: 11,
              fill: "var(--color-muted-foreground, #6b7280)",
            }}
          />
        ) : null}
        {anoSel != null ? (
          <ReferenceLine x={anoSel} stroke="var(--color-border, #e5e7eb)" />
        ) : null}
        {labels.map((label, i) => (
          <Line
            key={label}
            type="monotone"
            dataKey={label}
            name={label}
            stroke={PALETA_REGIMES[i % PALETA_REGIMES.length]}
            strokeWidth={2}
            connectNulls
            dot={(props: { cx?: number; cy?: number; payload?: { ano: number } }) => {
              const ano = props.payload?.ano;
              const ativo = ano === anoSel;
              return (
                <circle
                  key={`${label}-${ano}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={ativo ? 5 : 3}
                  fill={PALETA_REGIMES[i % PALETA_REGIMES.length]}
                  stroke="var(--color-card, #fff)"
                  strokeWidth={ativo ? 2 : 1}
                />
              );
            }}
          />
        ))}
      </LineChart>
    </ChartBox>
  );
}

/** Variação mensal do regime atual frente ao custo de hoje, ano a ano — a
 * mesma conta do cartão "hoje x reforma", aberta ao longo da transição. */
export function VariacaoRegimeAtualChart({
  pontos,
  anoSel,
}: {
  pontos: { ano: number; hoje: number; reforma: number; delta: number }[];
  anoSel: number | null;
}) {
  if (pontos.length === 0) return null;
  return (
    <ChartBox
      titulo="Variação mensal frente a hoje"
      descricao="Custo mensal com a reforma menos o custo atual, no regime vigente do Caso."
    >
      <BarChart data={pontos} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="ano" {...eixo} />
        <YAxis tickFormatter={compact} width={56} {...eixo} />
        <Tooltip content={<VariacaoTooltip />} />
        <ReferenceLine y={0} stroke="var(--color-border, #e5e7eb)" />
        <Bar dataKey="delta" radius={[4, 4, 4, 4]}>
          {pontos.map((p) => (
            <Cell
              key={p.ano}
              fill={p.delta > 0 ? COR_ATUAL : COR_PROJ}
              opacity={anoSel == null || p.ano === anoSel ? 1 : 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}

/** Concentração de crédito por fornecedor. */
export function FornecedoresChart({
  fornecedores,
}: {
  fornecedores: ParecerSnapshot["sec4"]["fornecedores"];
}) {
  const data = fornecedores.slice(0, 8).map((f) => ({
    name: (f.nome ?? f.cnpj ?? f.codigo).slice(0, 22),
    valor: Math.round(f.valorApurado),
  }));
  if (data.length === 0) return null;
  return (
    <ChartBox
      titulo="Crédito apurado por fornecedor"
      descricao="Onde o crédito de IBS/CBS está concentrado."
      altura={Math.max(220, data.length * 34)}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
        <XAxis type="number" tickFormatter={compact} {...eixo} />
        <YAxis type="category" dataKey="name" width={150} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Bar dataKey="valor" fill={COR_NAVY} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ChartBox>
  );
}

/** Repasse de preço necessário ano a ano. */
export function PrecoChart({ porAno }: { porAno: ParecerSnapshot["sec5"]["porAno"] }) {
  const data = porAno.map((p) => ({
    name: String(p.ano),
    Variação: Math.round(p.variacaoPct * 10) / 10,
  }));
  if (data.length === 0) return null;
  return (
    <ChartBox
      titulo="Repasse necessário ao preço"
      descricao="Variação percentual de preço para manter a neutralidade tributária."
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" {...eixo} />
        <YAxis tickFormatter={(v: number) => `${v}%`} width={52} {...eixo} />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Bar dataKey="Variação" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.Variação >= 0 ? COR_ATUAL : COR_PROJ} />
          ))}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}

/** Retenção, crédito e efeito líquido do split payment ano a ano. */
export function CaixaChart({ resumo }: { resumo: ParecerSnapshot["sec7"]["resumoAnual"] }) {
  const data = resumo.map((r) => ({
    name: String(r.ano),
    Retido: Math.round(r.retido),
    Crédito: Math.round(r.credito),
    "Efeito líquido": Math.round(r.liquido),
  }));
  if (data.length === 0) return null;
  return (
    <ChartBox
      titulo="Split payment ano a ano"
      descricao="A retenção isolada não é o custo: o crédito reduz o valor efetivo."
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" {...eixo} />
        <YAxis tickFormatter={compact} width={56} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Retido" fill={COR_ATUAL} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Crédito" fill={COR_PROJ} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Efeito líquido" fill={COR_NAVY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartBox>
  );
}

const PALETA = [
  "var(--color-navy, #12234a)",
  "var(--color-mint, #4fd1a5)",
  "var(--color-lavender, #7c5cd6)",
  "var(--color-magenta, #d6479b)",
  "var(--color-sky, #4f8fd1)",
  "var(--color-amber-tone, #e0a33a)",
];

/** Donut genérico de composição — só desenha as partes já calculadas. */
export function ComposicaoDonut({
  titulo,
  descricao,
  partes,
  centroLabel,
  centroValor,
}: {
  titulo: string;
  descricao?: string;
  partes: { name: string; valor: number }[];
  centroLabel?: string;
  centroValor?: string;
}) {
  const data = partes.filter((p) => p.valor > 0).map((p) => ({ ...p, valor: Math.round(p.valor) }));
  if (data.length === 0) return null;
  return (
    <ChartBox titulo={titulo} {...(descricao ? { descricao } : {})} altura={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="name"
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={PALETA[i % PALETA.length]} />
          ))}
        </Pie>
        {centroValor ? (
          <>
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 11 }}
            >
              {centroLabel ?? ""}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              className="fill-foreground"
              style={{ fontSize: 16, fontWeight: 600 }}
            >
              {centroValor}
            </text>
          </>
        ) : null}
        <Tooltip formatter={(v: number) => brl(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ChartBox>
  );
}

function BarrasPorImpostoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; payload: Record<string, number | string> }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const linha = payload[0]!.payload;
  const total = typeof linha["total"] === "number" ? linha["total"] : 0;
  return (
    <TooltipCaixa>
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload
        .filter((p) => typeof p.value === "number" && p.value > 0)
        .map((p) => (
          <TooltipLinha key={p.dataKey} rotulo={String(p.dataKey)} valor={brl(p.value ?? 0)} />
        ))}
      <TooltipLinha rotulo="Total" valor={brl(total)} destaque />
    </TooltipCaixa>
  );
}

/** Barras empilhadas por regime, abrindo o custo mensal por imposto — ao
 * lado da tabela comparativa, mostra de relance qual tributo pesa mais em
 * cada regime. */
export function BarrasPorImpostoChart({
  dados,
}: {
  dados: { regime: string; total: number; porImposto: { categoria: string; valor: number }[] }[];
}) {
  const data = dados.map((d) => {
    const linha: Record<string, number | string> = { regime: d.regime, total: Math.round(d.total) };
    for (const { categoria, valor } of d.porImposto) linha[categoria] = Math.round(valor);
    return linha;
  });
  if (data.length === 0) return null;
  return (
    <ChartBox
      titulo="Composição por imposto"
      descricao="Quanto cada tributo pesa no custo mensal de cada regime, no ano selecionado."
      altura={Math.max(170, data.length * 80)}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
        <XAxis type="number" tickFormatter={compact} {...eixo} />
        <YAxis type="category" dataKey="regime" width={110} {...eixo} />
        <Tooltip content={<BarrasPorImpostoTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {CATEGORIAS_IMPOSTO.map((categoria) => (
          <Bar
            key={categoria}
            dataKey={categoria}
            name={categoria}
            stackId="imposto"
            fill={CORES_IMPOSTO[categoria]}
          />
        ))}
      </BarChart>
    </ChartBox>
  );
}

function PonteLucroRealTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { label: string; tipo: "total" | "aumento" | "reducao"; valor: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  const rotulo =
    p.tipo === "total" ? p.label : p.tipo === "aumento" ? `${p.label} (aumento)` : `${p.label} (redução)`;
  const sinal = p.tipo === "reducao" ? "−" : p.tipo === "aumento" ? "+" : "";
  return (
    <TooltipCaixa>
      <TooltipLinha rotulo={rotulo} valor={`${sinal}${brl(p.valor)}`} destaque={p.tipo === "total"} />
    </TooltipCaixa>
  );
}

/** Ponte "hoje x com a reforma" específica do Lucro Real: parte do custo
 * atual, mostra o que sai (PIS, COFINS, ISS/ICMS), o que entra (IBS+CBS) e
 * o que muda (IRPJ, CSLL, CPP) até chegar no custo com a reforma plena. */
export function PonteLucroRealChart({
  hoje,
  reforma,
  hojeTotal,
  reformaTotal,
}: {
  hoje: { categoria: string; valor: number }[];
  reforma: { categoria: string; valor: number }[];
  hojeTotal: number;
  reformaTotal: number;
}) {
  const passos: { label: string; base: number; valor: number; tipo: "total" | "aumento" | "reducao" }[] = [
    { label: "Hoje", base: 0, valor: hojeTotal, tipo: "total" },
  ];
  let running = hojeTotal;
  for (const categoria of CATEGORIAS_IMPOSTO) {
    const h = hoje.find((l) => l.categoria === categoria)?.valor ?? 0;
    const r = reforma.find((l) => l.categoria === categoria)?.valor ?? 0;
    const delta = r - h;
    if (Math.abs(delta) < 0.5) continue;
    const base = delta >= 0 ? running : running + delta;
    passos.push({ label: categoria, base, valor: Math.abs(delta), tipo: delta >= 0 ? "aumento" : "reducao" });
    running += delta;
  }
  passos.push({ label: "Com a reforma", base: 0, valor: reformaTotal, tipo: "total" });
  if (passos.length <= 2) return null;
  return (
    <ChartBox
      titulo="Ponte: hoje até com a reforma (Lucro Real)"
      descricao="De onde sai e o que entra no custo mensal do Lucro Real até a reforma plena — explica por que a carga sobe até 2033."
      altura={300}
    >
      <BarChart data={passos} margin={{ top: 8, right: 8, left: 8, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={56} {...eixo} />
        <YAxis tickFormatter={compact} width={56} {...eixo} />
        <Tooltip content={<PonteLucroRealTooltip />} />
        <Bar dataKey="base" stackId="ponte" fill="transparent" />
        <Bar dataKey="valor" stackId="ponte" radius={[4, 4, 4, 4]}>
          {passos.map((p) => (
            <Cell
              key={p.label}
              fill={p.tipo === "total" ? COR_NAVY : p.tipo === "aumento" ? COR_ATUAL : COR_PROJ}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}

const mil = (v: number) =>
  v === 0 ? "0" : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;

/** Cor fixa por tributo, usada em toda a aba Saldo credor (cards, gráficos,
 * etiquetas) para o leitor associar a mesma cor ao mesmo tributo sempre. */
export const COR_ICMS = "var(--color-sky, #4f8fd1)";
export const COR_PISCOFINS = "var(--color-amber-tone, #e0a33a)";

/** Gráfico de linha de uma série só, eixo em R$ mil — reaproveitado para a
 * evolução do saldo de cada tributo (ICMS, PIS/COFINS) e para o simulador
 * de consumo do saldo de PIS/COFINS pela CBS devida mês a mês. */
export function SaldoLinhaChart({
  pontos,
  titulo,
  descricao,
  nomeSerie,
  cor,
}: {
  pontos: { periodo: string; valor: number | null }[];
  titulo: string;
  descricao?: string;
  nomeSerie: string;
  cor: string;
}) {
  if (pontos.length === 0) return null;
  const data = pontos.map((p) => ({
    periodo: new Date(`${p.periodo}-01T00:00:00`).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }),
    valor: p.valor,
  }));
  return (
    <ChartBox titulo={titulo} {...(descricao ? { descricao } : {})}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="periodo" {...eixo} />
        <YAxis tickFormatter={mil} width={64} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Line
          type="monotone"
          dataKey="valor"
          name={nomeSerie}
          stroke={cor}
          strokeWidth={2}
          connectNulls
          dot={{ r: 3 }}
        />
      </LineChart>
    </ChartBox>
  );
}

/** Cronograma das 240 parcelas mensais de ICMS (art. 134 do ADCT),
 * agregado por ano para leitura — a régua de cálculo vem de
 * src/lib/saldos/calculo.ts, aqui só se desenha o resultado. */
export function ParcelasIcmsChart({
  parcelas,
  cor = COR_ICMS,
}: {
  parcelas: ParcelaSaldo[];
  cor?: string;
}) {
  if (parcelas.length === 0) return null;
  const porAno = new Map<number, number>();
  for (const p of parcelas) porAno.set(p.ano, (porAno.get(p.ano) ?? 0) + p.valorNominal);
  const data = [...porAno.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ano, valor]) => ({ ano: String(ano), valor }));
  return (
    <ChartBox
      titulo="Cronograma das parcelas de ICMS"
      descricao="Recebimento anual projetado das 240 parcelas mensais, corrigidas pelo IPCA a partir de 2033."
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="ano" interval={1} {...eixo} />
        <YAxis tickFormatter={mil} width={64} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Bar dataKey="valor" fill={cor} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartBox>
  );
}
