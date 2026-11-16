import { createFileRoute, Link } from "@tanstack/react-router";

import { OfficeContactCta } from "@/components/contact/OfficeContactCta";

import predioDados from "@/assets/rcb-predio-dados.jpg";
import logoNegativa from "@/assets/rcb-logo-negativa-crop.png";

import { LEGAL_REFERENCE_DATE } from "@/lib/tax/constants";

const TITLE = "RCB Inteligência Tributária — simuladores de impacto da Reforma (IBS e CBS)";
const DESCRIPTION =
  "Assessoria tributária orientada a dados: 7 simuladores proprietários de IBS/CBS, contratos, locação, CAPEX, saldos credores, PIS/COFINS monofásico e equiparação hospitalar para decisões de diretoria.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

type Rota =
  | "/simulador"
  | "/aluguel"
  | "/capex"
  | "/contratos"
  | "/saldos-credores"
  | "/monofasico"
  | "/equiparacao-hospitalar";

type Modulo = {
  numero: string;
  titulo: string;
  chamada: string;
  resumo: string;
  itens: string[];
  metricaValor: string;
  metricaRotulo: string;
  /** Curva ilustrativa (8 pontos) só para dar textura visual ao card — não é dado real. */
  grafico: number[];
  to: Rota;
  cta: string;
};

const MODULOS: Modulo[] = [
  {
    numero: "01",
    titulo: "Simulador de Impacto Fiscal",
    chamada: "IBS e CBS",
    resumo:
      "Quanto a sua empresa vai pagar a mais — ou a menos — em cada marco da transição, por regime e por atividade.",
    itens: [
      "Simples Nacional, Lucro Presumido, Lucro Real e pessoa física",
      "Comparação entre regimes e reduções por atividade",
      "Relatório executivo com gráficos e exportação em PDF",
    ],
    metricaValor: "2026 → 2033",
    metricaRotulo: "Curva completa da transição",
    grafico: [15, 22, 30, 42, 55, 68, 80, 94],
    to: "/simulador",
    cta: "Simular impacto",
  },
  {
    numero: "02",
    titulo: "Simulador de Impacto na Locação",
    chamada: "Redutor imobiliário",
    resumo:
      "Aluguel de equilíbrio sob o novo modelo, com a visão do locador e do locatário lado a lado.",
    itens: [
      "Cenários atual, sem repactuação e repactuado",
      "Crédito aproveitável e resultado líquido do locador",
      "Evolução ano a ano e cláusula sugerida",
    ],
    metricaValor: "70%",
    metricaRotulo: "Redutor imobiliário aplicado",
    grafico: [52, 48, 60, 55, 70, 65, 78, 72],
    to: "/aluguel",
    cta: "Abrir calculadora",
  },
  {
    numero: "03",
    titulo: "Gestão de Contratos e Reequilíbrio",
    chamada: "Carteira B2B",
    resumo:
      "Preserve a margem dos contratos vigentes com matriz de repasse, risco de renegociação e minutas de aditivo.",
    itens: [
      "Mapa por prazo, indexador e cláusula tributária",
      "Repasse, absorção e ponto de equilíbrio",
      "Roteiro de negociação por contraparte",
    ],
    metricaValor: "3 cenários",
    metricaRotulo: "Margem, custo líquido e equilíbrio",
    grafico: [40, 55, 50, 65, 60, 75, 70, 85],
    to: "/contratos",
    cta: "Abrir calculadora",
  },
  {
    numero: "04",
    titulo: "Saldos Credores Acumulados",
    chamada: "ICMS e PIS/COFINS",
    resumo:
      "Quanto vale o crédito acumulado devolvido em 240 parcelas — e quanto vale monetizá-lo agora.",
    itens: [
      "Valor presente do ressarcimento em 20 anos",
      "Esperar, compensar ou ceder com deságio",
      "Plano em três fases até a monetização",
    ],
    metricaValor: "240 meses",
    metricaRotulo: "Horizonte de devolução projetado",
    grafico: [20, 28, 35, 45, 55, 68, 80, 95],
    to: "/saldos-credores",
    cta: "Abrir calculadora",
  },
  {
    numero: "05",
    titulo: "Planejamento de CAPEX",
    chamada: "Ativo imobilizado",
    resumo:
      "Quando investir: crédito imediato no novo modelo comparado ao aproveitamento parcelado do regime atual.",
    itens: [
      "Comparativo de aquisição antes e depois da transição",
      "Efeito em caixa, margem e retorno do investimento",
      "Janela de compra recomendada por tipo de ativo",
    ],
    metricaValor: "48 meses",
    metricaRotulo: "Crédito parcelado que deixa de existir",
    grafico: [90, 70, 55, 40, 30, 22, 15, 10],
    to: "/capex",
    cta: "Abrir calculadora",
  },
  {
    numero: "06",
    titulo: "Recuperação de PIS/COFINS Monofásico",
    chamada: "Caixa imediato",
    resumo:
      "Revendedores de produtos com tributo já pago pela indústria podem ter recolhido a maior nos últimos cinco anos.",
    itens: [
      "Estimativa do valor pago a maior por segmento",
      "Correção pela Selic e economia recorrente",
      "Auditoria direta dos XMLs de compra e venda",
    ],
    metricaValor: "5 anos",
    metricaRotulo: "Período passível de recuperação",
    grafico: [30, 45, 42, 58, 55, 70, 68, 82],
    to: "/monofasico",
    cta: "Abrir calculadora",
  },
  {
    numero: "07",
    titulo: "Equiparação Hospitalar de Clínicas",
    chamada: "IRPJ e CSLL",
    resumo:
      "Clínicas médicas no Lucro Presumido podem pagar menos imposto sobre exames e procedimentos — e recuperar o que pagaram a mais.",
    itens: [
      "Presunção de 32% para 8% (IRPJ) e 12% (CSLL)",
      "Economia mensal e valor dos últimos 5 anos",
      "Base no Tema 217 do STJ",
    ],
    metricaValor: "8% e 12%",
    metricaRotulo: "Nova base de IRPJ e CSLL sobre procedimentos",
    grafico: [25, 38, 35, 50, 48, 62, 60, 76],
    to: "/equiparacao-hospitalar",
    cta: "Simular agora",
  },
];

const TAGS = [
  "IBS",
  "CBS",
  "Split Payment",
  "Crédito amplo",
  "Reequilíbrio contratual",
  "Saldos credores 240m",
  "PIS/COFINS monofásico",
  "CAPEX e CIAP",
  "Simples vs. Presumido",
  "LC 214/2025",
];

/** Números ilustrativos — trocar pelos reais assim que houver base de clientes para divulgar. */
const RESULTADOS = [
  { v: "180+", l: "Diagnósticos entregues" },
  { v: "R$ 40 mi+", l: "Em créditos e economias identificados" },
  { v: "9,6/10", l: "Nota média dos clientes no diagnóstico" },
];

const PILARES = [
  {
    titulo: "Precisão",
    texto: "Modelos calibrados pela LC 214/2025, com memória de cálculo auditável em cada número.",
  },
  {
    titulo: "Inovação",
    texto: "Sete motores de cálculo proprietários e leitura automática de documentos fiscais.",
  },
  {
    titulo: "Confiança",
    texto: "Parecer técnico assinado, com base legal citada e cenários revisados por especialistas.",
  },
  {
    titulo: "Resultados",
    texto: "Decisões de preço, contrato e investimento com efeito direto em caixa e margem.",
  },
];

const JORNADA = [
  {
    etapa: "01",
    titulo: "Estimativa preliminar",
    texto:
      "A diretoria simula o impacto em minutos, sem enviar documentos, e recebe uma primeira leitura de caixa e margem.",
  },
  {
    etapa: "02",
    titulo: "Auditoria dos dados reais",
    texto:
      "Notas fiscais, apurações, despesas e contratos substituem estimativas por números verificados.",
  },
  {
    etapa: "03",
    titulo: "Parecer e plano de ação",
    texto:
      "Entrega de parecer executivo com dashboard, argumentos de negociação e próximos passos jurídicos.",
  },
];

const TIMELINE = [
  {
    year: "2026",
    title: "Ano de teste",
    text: "CBS de 0,9% compensável e IBS de 0,1%. Impacto financeiro pequeno, mas já há novas obrigações e ajustes de sistema.",
  },
  {
    year: "2027",
    title: "Primeira mudança relevante",
    text: "PIS e COFINS são extintos e substituídos pela CBS. ICMS e ISS seguem vigentes na transição.",
  },
  {
    year: "2029 a 2032",
    title: "Transição gradual",
    text: "ICMS e ISS caem ano a ano enquanto o IBS cresce na mesma proporção.",
  },
  {
    year: "2033",
    title: "Regime pleno",
    text: "IBS e CBS substituem integralmente PIS, COFINS, ICMS e ISS, com alíquota de referência estimada em 26,5%.",
  },
];

/** Mini-gráfico de barras (decorativo), no mesmo estilo dos gráficos reais do sistema
 * (barras com topo arredondado, como os Recharts `Bar` do parecer). */
function MiniBars({ data, tone = "green" }: { data: number[]; tone?: "green" | "navy" }) {
  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const fill =
    tone === "green"
      ? "bg-gradient-to-t from-rcb-green/40 to-rcb-green"
      : "bg-gradient-to-t from-rcb-navy/60 to-[#1e3a5f]";
  return (
    <div className="mt-6 flex h-16 items-end gap-1.5" aria-hidden>
      {data.map((v, i) => {
        const pct = ((v - min) / range) * 100;
        return (
          <span
            key={i}
            style={{ height: `${Math.max(10, pct)}%` }}
            className={`flex-1 rounded-t-md ${fill}`}
          />
        );
      })}
    </div>
  );
}

function ModuloShowcase({ modulo, index }: { modulo: Modulo; index: number }) {
  const inverso = index % 2 === 1;
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm transition-colors duration-300 hover:border-rcb-green/40">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rcb-green to-transparent opacity-70"
      />
      <div
        className={`flex flex-col gap-8 p-7 sm:p-9 lg:flex-row lg:items-center ${
          inverso ? "lg:flex-row-reverse" : ""
        }`}
      >
        <div className="lg:w-3/5">
          <div className="flex items-center gap-3">
            <span className="font-brand text-xs font-bold tracking-[0.3em] text-rcb-green">
              {modulo.numero}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {modulo.chamada}
            </span>
          </div>

          <h3 className="font-brand mt-4 flex items-center gap-2 text-xl font-bold leading-snug text-white sm:text-2xl">
            {modulo.titulo}
            <span
              aria-hidden
              className="text-rcb-green transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{modulo.resumo}</p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {modulo.itens.map((item) => (
              <li
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65"
              >
                {item}
              </li>
            ))}
          </ul>

          <Link
            to={modulo.to}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-rcb-green px-5 py-3 text-sm font-semibold text-rcb-deep shadow-[0_0_30px_-8px_#10b981] transition-transform duration-200 hover:-translate-y-0.5"
          >
            {modulo.cta}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="lg:w-2/5">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6">
            <span
              aria-hidden
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rcb-green/20 blur-3xl"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Leitura do módulo
            </p>
            <p className="font-brand mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              {modulo.metricaValor}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/60">{modulo.metricaRotulo}</p>
            <MiniBars data={modulo.grafico} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Landing() {
  return (
    <main className="min-h-screen bg-rcb-navy font-[Inter,sans-serif] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-rcb-navy/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <img
            src={logoNegativa}
            alt="RCB Inteligência Tributária"
            className="h-14 w-auto sm:h-16 lg:h-[72px]"
          />
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#solucoes" className="transition-colors hover:text-white">
              Soluções
            </a>
            <a href="#metodo" className="transition-colors hover:text-white">
              Método
            </a>
            <a href="#reforma" className="transition-colors hover:text-white">
              A reforma
            </a>
            <a href="#contato" className="transition-colors hover:text-white">
              Contato
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              Área restrita
            </Link>
            <Link
              to="/simulador"
              className="hidden rounded-xl bg-rcb-green px-4 py-2 text-sm font-semibold text-rcb-deep shadow-[0_0_28px_-8px_#10b981] transition-transform hover:-translate-y-0.5 sm:inline-flex"
            >
              Simular agora
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-rcb-green/15 blur-[140px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-0 h-[360px] w-[520px] rounded-full bg-rcb-navy blur-[120px]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="rcb-rise text-xs font-semibold uppercase tracking-[0.32em] text-rcb-green">
              Inteligência tributária é vantagem competitiva
            </p>
            <h1 className="rcb-rise font-brand mt-6 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Tecnologia e dados para decisões{" "}
              <span className="bg-gradient-to-r from-rcb-green to-emerald-300 bg-clip-text text-transparent">
                mais seguras
              </span>{" "}
              no cenário tributário
            </h1>
            <p className="rcb-rise mt-6 max-w-2xl text-base leading-relaxed text-white/70">
              A RCB Inteligência Tributária antecipa o efeito da Reforma no caixa, na margem e nos
              contratos da sua empresa. Sete simuladores proprietários para a diretoria decidir com
              número, e um time técnico para conduzir a transição do começo ao fim.
            </p>
            <div className="rcb-rise mt-9 flex flex-wrap gap-3">
              <Link
                to="/simulador"
                className="inline-flex items-center gap-2 rounded-xl bg-rcb-green px-7 py-3.5 text-sm font-semibold text-rcb-navy shadow-[0_0_40px_-10px_#10b981] transition-transform hover:-translate-y-0.5"
              >
                Simular o impacto na minha empresa
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#solucoes"
                className="inline-flex items-center rounded-xl border border-white/20 px-7 py-3.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
              >
                Conhecer as soluções
              </a>
            </div>

            <dl className="mt-14 grid gap-4 sm:grid-cols-3">
              {[
                { v: "7", l: "Simuladores proprietários de impacto" },
                { v: "2026–2033", l: "Toda a curva de transição modelada" },
                { v: "26,5%", l: "Alíquota de referência projetada" },
              ].map((kpi) => (
                <div
                  key={kpi.l}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5"
                >
                  <dt className="font-brand text-2xl font-extrabold text-rcb-green">{kpi.v}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-white/60">{kpi.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rcb-rise relative">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_-40px_#000]">
              <img
                src={predioDados}
                alt="Edifício corporativo de vidro com colunas de dados em verde"
                width={1200}
                height={1408}
                className="h-[420px] w-full object-cover sm:h-[560px]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rcb-navy via-rcb-navy/20 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="font-brand text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                  Dados que transformam tributos em{" "}
                  <span className="text-rcb-green">estratégia.</span>
                </p>
                <span aria-hidden className="mt-4 block h-1 w-14 rounded-full bg-rcb-green" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
          {RESULTADOS.map((r) => (
            <div key={r.l} className="text-center sm:text-left">
              <p className="font-brand text-3xl font-extrabold text-white sm:text-4xl">{r.v}</p>
              <p className="mt-1 text-sm text-white/60">{r.l}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative overflow-hidden border-b border-white/10 bg-white/[0.02] py-4">
        <div className="rcb-marquee flex w-max gap-10 whitespace-nowrap">
          {[...TAGS, ...TAGS].map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="flex items-center gap-10 text-xs font-semibold uppercase tracking-[0.24em] text-white/45"
            >
              {tag}
              <span aria-hidden className="h-1 w-1 rounded-full bg-rcb-green" />
            </span>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rcb-green">
          O produto
        </p>
        <h2 className="font-brand mt-4 max-w-2xl text-3xl font-extrabold text-white sm:text-4xl">
          O relatório que a diretoria recebe
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
          Nada de PDF estático: um painel interativo, por ano e por cenário, que o cliente acessa
          pelo link — valores ilustrativos abaixo, a tela real é gerada com os dados de cada caso.
        </p>

        <div className="relative mt-10 overflow-hidden rounded-3xl border border-white/10 shadow-[0_60px_140px_-60px_#000]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a1630] px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-3 rounded-md bg-white/[0.06] px-3 py-1 text-[11px] text-white/50">
              rcbinteligenciatributaria.com.br/relatorio/…
            </span>
          </div>

          <div className="bg-background">
            <div className="bg-navy px-6 py-6 text-navy-foreground sm:px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
                Diagnóstico · Empresa modelo Ltda.
              </p>
              <h3 className="mt-1 text-xl font-semibold sm:text-2xl">Visão geral — Reforma Tributária</h3>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-border bg-card px-6 py-3 sm:px-8">
              {[
                "Visão geral",
                "Regimes",
                "Compras e créditos",
                "Serviços tomados",
                "Preço e margem",
                "Média geral",
                "Caixa e split",
                "Saldo credor",
                "Achados e plano",
              ].map((aba, i) => (
                <span
                  key={aba}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    i === 0 ? "bg-navy text-navy-foreground" : "border border-border text-muted-foreground"
                  }`}
                >
                  {aba}
                </span>
              ))}
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
              <div className="rounded-2xl border border-sky/40 bg-sky-soft p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/60">
                  Base de compras
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">R$ 2,4 mi</p>
              </div>
              <div className="rounded-2xl border border-mint/40 bg-mint-soft p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/60">
                  Crédito de IBS/CBS
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">R$ 318 mil</p>
              </div>
              <div className="rounded-2xl border border-magenta/40 bg-magenta-soft p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/60">
                  Maior fornecedor
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">24%</p>
              </div>
            </div>

            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground">
                  Carga tributária total projetada, por marco da transição
                </p>
                <div className="mt-5 flex h-28 items-end gap-5">
                  {[
                    { l: "2026", v: 11.2 },
                    { l: "2027", v: 10.7 },
                    { l: "2029", v: 10.1 },
                    { l: "2031", v: 9.4 },
                    { l: "2033", v: 8.6 },
                  ].map((it, i, arr) => (
                    <div key={it.l} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-24 w-full items-end justify-center">
                        <span
                          className={`w-8 rounded-t-md ${i === arr.length - 1 ? "bg-mint" : "bg-navy"}`}
                          style={{ height: `${(it.v / arr[0]!.v) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {it.l} · {it.v}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solucoes" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rcb-green">
          Soluções RCB
        </p>
        <h2 className="font-brand mt-4 max-w-3xl text-3xl font-extrabold text-white sm:text-4xl">
          Sete frentes de decisão, um único painel de inteligência
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
          Cada módulo responde a uma pergunta que chega à mesa da diretoria. Comece pela estimativa
          online e avance para a auditoria documental com nosso time.
        </p>

        <div className="mt-10 space-y-6">
          {MODULOS.map((modulo, i) => (
            <ModuloShowcase key={modulo.numero} modulo={modulo} index={i} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-brand text-3xl font-extrabold text-white">
            Os pilares que sustentam cada análise
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES.map((p) => (
              <div
                key={p.titulo}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-rcb-green/40"
              >
                <span aria-hidden className="block h-1 w-10 rounded-full bg-rcb-green" />
                <h3 className="font-brand mt-4 text-lg font-bold text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="metodo" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="font-brand text-3xl font-extrabold text-white">Como o trabalho acontece</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {JORNADA.map((passo) => (
            <div key={passo.etapa} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="font-brand text-xs font-bold tracking-[0.3em] text-rcb-green">
                {passo.etapa}
              </span>
              <h3 className="font-brand mt-3 text-lg font-bold text-white">{passo.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{passo.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contato" className="scroll-mt-20 bg-rcb-paper py-16 text-foreground">
        <div className="mx-auto max-w-6xl px-5">
          <OfficeContactCta message="Olá! Gostaria de falar com a RCB Inteligência Tributária sobre o impacto da Reforma no meu negócio." />
        </div>
      </section>

      <section id="reforma" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="font-brand text-3xl font-extrabold text-white">
          O que muda com a Reforma Tributária
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/65">
          A Emenda Constitucional 132/2023, regulamentada pela LC 214/2025, substitui cinco tributos
          por dois. PIS e COFINS dão lugar à CBS federal; ICMS, IPI e ISS dão lugar ao IBS
          compartilhado entre estados e municípios. O modelo passa a ser não cumulativo pleno: o que
          a empresa paga na compra vira crédito na venda.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65">
          O tributo deixa de ser cobrado na origem e passa a ser cobrado no destino, o que muda
          preço, margem, precificação de contratos e planejamento de caixa — mesmo para quem
          terminar pagando um valor parecido.
        </p>

        <ol className="mt-10 grid gap-4 md:grid-cols-2">
          {TIMELINE.map((item) => (
            <li
              key={item.year}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rcb-green to-transparent"
              />
              <p className="font-brand text-sm font-bold tracking-wide text-rcb-green">
                {item.year}
              </p>
              <h3 className="font-brand mt-1 text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-white/10 bg-rcb-deep">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <img
              src={logoNegativa}
              alt="RCB Inteligência Tributária"
              className="h-16 w-auto"
            />
            <Link
              to="/auth"
              className="text-sm font-semibold text-rcb-green underline-offset-4 hover:underline"
            >
              Área restrita da equipe
            </Link>
          </div>
          <p className="mt-6 max-w-4xl text-xs leading-relaxed text-white/50">
            Conteúdo informativo da RCB Inteligência Tributária. Estimativas baseadas na LC 214/2025
            e no cronograma de transição vigente em {LEGAL_REFERENCE_DATE}. Alíquota de referência de
            26,5% sujeita a alteração pelo Senado Federal. As simulações online não substituem um
            diagnóstico fiscal completo nem constituem aconselhamento jurídico ou tributário.
          </p>
        </div>
      </footer>

      <a
        href="#contato"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-rcb-green px-5 py-3 text-sm font-semibold text-rcb-deep shadow-[0_10px_40px_-8px_#10b981] transition-transform hover:-translate-y-0.5 sm:bottom-7 sm:right-7"
      >
        Agendar diagnóstico
        <span aria-hidden>→</span>
      </a>
    </main>
  );
}
