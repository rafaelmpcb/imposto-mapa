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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { brl } from "@/lib/tax/calc";
import type { ParecerSnapshot } from "@/lib/parecer/tipos";

const compact = (v: number) =>
  v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

const COR_ATUAL = "var(--color-danger, #b91c1c)";
const COR_PROJ = "var(--color-success, #15803d)";
const COR_NAVY = "var(--color-navy, #12234a)";

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

/** Carga total por regime tributário simulado. */
export function RegimesChart({
  cenarios,
  melhorLabel,
}: {
  cenarios: ParecerSnapshot["sec8"]["cenarios"];
  melhorLabel: string | null;
}) {
  const data = cenarios
    .filter((c) => c.total != null)
    .map((c) => ({ name: c.label, valor: Math.round(c.total ?? 0), melhor: c.label === melhorLabel }));
  if (data.length === 0) return null;
  return (
    <ChartBox
      titulo="Carga por regime tributário"
      descricao="Quanto cada regime custaria com os mesmos números do Caso."
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" {...eixo} interval={0} />
        <YAxis tickFormatter={compact} width={56} {...eixo} />
        <Tooltip formatter={(v: number) => brl(v)} />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.melhor ? COR_PROJ : COR_NAVY} />
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
