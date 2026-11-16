import { createFileRoute, Link } from "@tanstack/react-router";

import { OfficeContactCta } from "@/components/contact/OfficeContactCta";
import { WhitelabelMark } from "@/components/brand/WhitelabelMark";

import { LEGAL_REFERENCE_DATE } from "@/lib/tax/constants";

const TITLE = "Brander Inteligência Tributária — simuladores de impacto da Reforma (IBS e CBS)";
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

function ModuloRow({ modulo }: { modulo: Modulo }) {
  return (
    <li className="group border-t border-white/10 py-8 first:border-t-0">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-5 sm:max-w-xl sm:gap-7">
          <span className="font-brand shrink-0 text-sm font-bold tracking-[0.25em] text-brand-bronze">
            {modulo.numero}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-brand text-xl font-bold text-white sm:text-2xl">{modulo.titulo}</h3>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {modulo.chamada}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/65">{modulo.resumo}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {modulo.itens.map((item) => (
                <li key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 pl-[52px] sm:items-end sm:pl-0 sm:text-right">
          <div>
            <p className="font-brand text-2xl font-extrabold text-brand-gold">{modulo.metricaValor}</p>
            <p className="mt-1 max-w-[220px] text-xs text-white/55 sm:ml-auto">{modulo.metricaRotulo}</p>
          </div>
          <Link
            to={modulo.to}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white underline decoration-brand-gold/60 decoration-2 underline-offset-4 transition-colors hover:text-brand-gold"
          >
            {modulo.cta}
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function Landing() {
  return (
    <main className="min-h-screen bg-brand-ink font-[Sora,sans-serif] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <WhitelabelMark size="sm" />
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
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              Área restrita
            </Link>
            <Link
              to="/simulador"
              className="hidden rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-ink transition-transform hover:-translate-y-0.5 sm:inline-flex"
            >
              Simular agora
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <svg
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 opacity-[0.14]"
          width="900"
          height="620"
          viewBox="0 0 900 620"
          fill="none"
        >
          {[110, 190, 270, 350, 430].map((r) => (
            <circle key={r} cx="450" cy="40" r={r} stroke="#d9a94e" strokeWidth="1" />
          ))}
        </svg>

        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:py-32">
          <p className="brand-rise text-xs font-semibold uppercase tracking-[0.32em] text-brand-bronze">
            Decisões tributárias com dado, não com achismo
          </p>
          <h1 className="brand-rise font-brand mt-6 text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl">
            Antes de reagir à Reforma Tributária,{" "}
            <span className="relative inline-block whitespace-nowrap">
              meça o impacto dela
              <span aria-hidden className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-brand-gold" />
            </span>
          </h1>
          <p className="brand-rise mt-6 text-base leading-relaxed text-white/70">
            Sete simuladores proprietários traduzem IBS, CBS e a transição 2026–2033 em números que
            a diretoria usa para decidir preço, contrato e investimento — com um time técnico
            conduzindo a auditoria do início ao fim.
          </p>
          <div className="brand-rise mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/simulador"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-7 py-3.5 text-sm font-semibold text-brand-ink transition-transform hover:-translate-y-0.5"
            >
              Medir o impacto agora
              <span aria-hidden>→</span>
            </Link>
            <a
              href="#solucoes"
              className="inline-flex items-center rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              Conhecer os módulos
            </a>
          </div>

          <dl className="brand-rise mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {[
              { v: "7", l: "simuladores proprietários" },
              { v: "2026–2033", l: "curva de transição mapeada" },
              { v: "26,5%", l: "alíquota de referência projetada" },
            ].map((kpi, i) => (
              <div key={kpi.l} className={`text-center ${i > 0 ? "border-l border-white/15 pl-10" : ""}`}>
                <dt className="font-brand text-2xl font-extrabold text-white">{kpi.v}</dt>
                <dd className="mt-1 text-xs text-white/55">{kpi.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-6 px-5 py-10">
          {RESULTADOS.map((r, i) => (
            <div key={r.l} className={`text-center ${i > 0 ? "border-l border-white/10 pl-12" : ""}`}>
              <p className="font-brand text-2xl font-bold text-white">{r.v}</p>
              <p className="mt-1 text-xs text-white/50">{r.l}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-b border-white/10 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2 px-5">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-bronze">O produto</p>
        <h2 className="font-brand mt-4 max-w-2xl text-3xl font-bold text-white sm:text-4xl">
          O painel que chega à mesa da diretoria
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
          Nada de PDF estático: um painel interativo, por ano e por cenário, que o cliente acessa
          pelo link — valores ilustrativos abaixo, a tela real é gerada com os dados de cada caso.
        </p>

        <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 shadow-[0_60px_140px_-60px_#000]">
          <div className="flex items-center border-b border-white/10 bg-brand-ink px-5 py-2.5">
            <span className="rounded-md bg-white/[0.06] px-3 py-1 text-[11px] text-white/45">
              /relatorio/…
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

      <section id="solucoes" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-bronze">Módulos</p>
        <h2 className="font-brand mt-4 max-w-3xl text-3xl font-bold text-white sm:text-4xl">
          Sete módulos, uma leitura só
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
          Cada módulo responde a uma pergunta que chega à mesa da diretoria. Comece pela estimativa
          online e avance para a auditoria documental com nosso time.
        </p>

        <ul className="mt-10">
          {MODULOS.map((modulo) => (
            <ModuloRow key={modulo.numero} modulo={modulo} />
          ))}
        </ul>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-brand text-3xl font-bold text-white">
            O que garante a qualidade de cada número
          </h2>
          <div className="mt-8 flex flex-wrap">
            {PILARES.map((p, i) => (
              <div
                key={p.titulo}
                className={`w-full py-5 sm:w-1/2 sm:py-6 lg:w-1/4 ${
                  i % 2 === 1 ? "sm:border-l sm:border-white/10 sm:pl-6" : ""
                } ${i >= 2 ? "lg:border-l lg:border-white/10 lg:pl-6" : ""}`}
              >
                <span aria-hidden className="block h-[2px] w-8 bg-brand-gold" />
                <h3 className="font-brand mt-4 text-lg font-bold text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="metodo" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
        <h2 className="font-brand text-3xl font-bold text-white">Da estimativa ao plano de ação</h2>
        <div className="relative mt-12 grid gap-10 md:grid-cols-3">
          <span aria-hidden className="absolute left-0 right-0 top-5 hidden h-px bg-white/10 md:block" />
          {JORNADA.map((passo) => (
            <div key={passo.etapa} className="relative">
              <span className="font-brand relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gold/50 bg-brand-ink text-sm font-bold text-brand-gold">
                {passo.etapa}
              </span>
              <h3 className="font-brand mt-5 text-lg font-bold text-white">{passo.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{passo.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contato" className="scroll-mt-20 bg-brand-paper py-16 text-foreground">
        <div className="mx-auto max-w-5xl px-5">
          <OfficeContactCta message="Olá! Gostaria de falar com a Brander sobre o impacto da Reforma no meu negócio." />
        </div>
      </section>

      <section id="reforma" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
        <h2 className="font-brand text-3xl font-bold text-white">
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

        <ol className="relative mt-12 space-y-10 border-l border-white/10 pl-8">
          {TIMELINE.map((item) => (
            <li key={item.year} className="relative">
              <span
                aria-hidden
                className="absolute -left-[33px] top-1 h-3 w-3 rounded-full border-2 border-brand-gold bg-brand-ink"
              />
              <p className="font-brand text-sm font-bold tracking-wide text-brand-gold">{item.year}</p>
              <h3 className="font-brand mt-1 text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-white/10 bg-brand-ink">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <WhitelabelMark />
            <Link
              to="/auth"
              className="text-sm font-semibold text-brand-gold underline-offset-4 hover:underline"
            >
              Área restrita da equipe
            </Link>
          </div>
          <p className="mt-6 max-w-4xl text-xs leading-relaxed text-white/50">
            Conteúdo informativo da Brander Inteligência Tributária. Estimativas baseadas na LC
            214/2025 e no cronograma de transição vigente em {LEGAL_REFERENCE_DATE}. Alíquota de
            referência de 26,5% sujeita a alteração pelo Senado Federal. As simulações online não
            substituem um diagnóstico fiscal completo nem constituem aconselhamento jurídico ou
            tributário.
          </p>
        </div>
      </footer>

      <a
        href="#contato"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-brand-gold/60 bg-brand-ink/80 px-5 py-3 text-sm font-semibold text-brand-gold backdrop-blur-sm transition-colors hover:bg-brand-gold hover:text-brand-ink sm:bottom-7 sm:right-7"
      >
        Agendar diagnóstico
        <span aria-hidden>→</span>
      </a>
    </main>
  );
}
