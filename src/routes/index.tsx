import { createFileRoute, Link } from "@tanstack/react-router";

import { OfficeContactCta } from "@/components/contact/OfficeContactCta";

import { LEGAL_REFERENCE_DATE } from "@/lib/tax/constants";

const TITLE = "Plataforma da Reforma Tributária — calculadoras IBS e CBS e diagnóstico fiscal";
const DESCRIPTION =
  "Suíte de ferramentas para a transição da Reforma Tributária: simulador de impacto IBS/CBS, repactuação de aluguéis, contratos, saldos credores e planejamento de CAPEX.";

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

type Modulo = {
  numero: string;
  titulo: string;
  resumo: string;
  itens: string[];
  status: "aberto" | "consultoria";
  selo: string;
  tone: string;
  chip: string;
  to?:
    | "/simulador"
    | "/aluguel"
    | "/capex"
    | "/contratos"
    | "/saldos-credores"
    | "/monofasico";
  cta: string;
};

const MODULOS: Modulo[] = [
  {
    numero: "01",
    titulo: "Simulador de Impacto Fiscal (IBS e CBS)",
    resumo:
      "Compare a carga tributária atual com a projetada nos marcos de 2026, 2027 e 2033, por regime e por atividade.",
    itens: [
      "Simples Nacional, Lucro Presumido, Lucro Real, MEI e pessoa física",
      "Comparação entre regimes e reduções de alíquota por atividade",
      "Relatório com gráficos, memória de cálculo e exportação em PDF",
    ],
    status: "aberto",
    selo: "Disponível online",
    tone: "border-sky/40 bg-sky-soft",
    chip: "bg-sky text-white",
    to: "/simulador",
    cta: "Abrir simulador",
  },
  {
    numero: "02",
    titulo: "Locação e Contratos Imobiliários",
    resumo:
      "Aluguel de equilíbrio sob o novo modelo, com o redutor imobiliário e a visão do locador e do locatário lado a lado.",
    itens: [
      "Cenários atual, sem repactuação e repactuado",
      "Crédito aproveitável pelo locatário e resultado líquido do locador",
      "Evolução ano a ano de 2026 a 2033 e cláusula sugerida",
    ],
    status: "aberto",
    selo: "Disponível online",
    tone: "border-mint/40 bg-mint-soft",
    chip: "bg-mint text-navy",
    to: "/aluguel",
    cta: "Abrir calculadora de aluguéis",
  },
  {
    numero: "03",
    titulo: "Gestão de Contratos e Reequilíbrio Econômico",
    resumo:
      "Revisão da carteira de contratos B2B com matriz de repasse, risco de renegociação e minutas de aditivo.",
    itens: [
      "Mapa de contratos por prazo, indexador e cláusula tributária",
      "Simulação de repasse, absorção e reequilíbrio da margem",
      "Minutas de aditivo e roteiro de negociação por contraparte",
    ],
    status: "aberto",
    selo: "Disponível online",
    tone: "border-lavender/40 bg-lavender-soft",
    chip: "bg-lavender text-navy",
    to: "/contratos",
    cta: "Abrir calculadora de contratos",
  },
  {
    numero: "04",
    titulo: "Saldos Credores Acumulados (ICMS e PIS/COFINS)",
    resumo:
      "Quanto vale o seu crédito acumulado se ele for devolvido em 240 parcelas — e quanto vale monetizá-lo agora.",
    itens: [
      "Valor presente do ressarcimento em 20 anos corrigido pelo IPCA",
      "Comparativo entre esperar, compensar e ceder o crédito com deságio",
      "Plano de ação em três fases: auditoria, homologação e monetização",
    ],
    status: "aberto",
    selo: "Disponível online",
    tone: "border-amber-tone/40 bg-amber-tone-soft",
    chip: "bg-amber-tone text-navy",
    to: "/saldos-credores",
    cta: "Abrir calculadora de saldos credores",
  },

  {
    numero: "05",
    titulo: "Planejamento de CAPEX e Ativo Imobilizado",
    resumo:
      "Quando investir: crédito imediato no novo modelo comparado ao aproveitamento parcelado em 48 meses do regime atual.",
    itens: [
      "Comparativo de aquisição antes e depois da transição",
      "Efeito em caixa, margem e retorno do investimento",
      "Recomendação de janela de compra por tipo de ativo",
    ],
    status: "aberto",
    selo: "Disponível online",
    tone: "border-magenta/40 bg-magenta-soft",
    chip: "bg-magenta text-white",
    to: "/capex",
    cta: "Abrir calculadora de CAPEX",
  },

  {
    numero: "06",
    titulo: "Recuperação de PIS/COFINS Monofásico",
    resumo:
      "Quem revende produtos com tributo já pago pela indústria pode ter recolhido PIS/COFINS a maior nos últimos cinco anos.",
    itens: [
      "Estimativa do valor pago a maior por segmento e regime tributário",
      "Correção pela Selic e projeção da economia recorrente",
      "Plano em três fases: levantamento, habilitação e compensação",
    ],
    status: "aberto",
    selo: "Disponível online",
    tone: "border-sky/40 bg-sky-soft",
    chip: "bg-sky text-white",
    to: "/monofasico",
    cta: "Abrir calculadora monofásica",
  },
];

const JORNADA = [
  {
    etapa: "Etapa 1",
    titulo: "Estimativa preliminar",
    texto:
      "Use as calculadoras abertas para ter uma primeira leitura do impacto na sua empresa ou nos seus contratos.",
  },
  {
    etapa: "Etapa 2",
    titulo: "Auditoria dos dados reais",
    texto:
      "O escritório analisa notas fiscais, apurações, despesas e contratos para substituir estimativas por números reais.",
  },
  {
    etapa: "Etapa 3",
    titulo: "Parecer e plano de ação",
    texto:
      "Entrega de parecer executivo com dashboard interativo, argumentos de negociação e próximos passos jurídicos.",
  },
];

const TIMELINE = [
  {
    year: "2026",
    title: "Ano de teste",
    text: "CBS de 0,9% (compensável com PIS/COFINS) e IBS de 0,1%. O impacto financeiro é pequeno, mas já existem novas obrigações acessórias e ajustes de sistema.",
  },
  {
    year: "2027",
    title: "Primeira mudança relevante",
    text: "PIS e COFINS são extintos e substituídos pela CBS. ICMS e ISS continuam vigentes durante a transição estadual e municipal.",
  },
  {
    year: "2029 a 2032",
    title: "Transição gradual",
    text: "ICMS e ISS são reduzidos ano a ano enquanto o IBS cresce na mesma proporção.",
  },
  {
    year: "2033",
    title: "Regime pleno",
    text: "IBS e CBS substituem integralmente PIS, COFINS, ICMS e ISS, com alíquota de referência estimada em 26,5%.",
  },
];

const AUDIENCE = [
  {
    title: "Prestadores de serviço",
    text: "Quem tem folha alta e poucos insumos tende a sentir mais o novo modelo, já que o crédito amplo beneficia quem compra muito.",
  },
  {
    title: "Comércio e indústria",
    text: "O crédito financeiro amplo pode reduzir a carga, mas muda preço, margem e a forma de negociar com fornecedores.",
  },
  {
    title: "Profissões regulamentadas",
    text: "Advocacia, contabilidade, engenharia e arquitetura podem ter redução de 30%, desde que cumpram o requisito societário do Art. 127 da LC 214/2025.",
  },
  {
    title: "Saúde, educação e cultura",
    text: "Redução de 60% prevista no Art. 125 da LC 214/2025, aplicada sem exigência de composição societária específica.",
  },
];

function ModuloCard({ modulo }: { modulo: Modulo }) {
  return (
    <article className={`flex flex-col rounded-2xl border p-6 shadow-sm ${modulo.tone}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.2em] text-navy/60">{modulo.numero}</span>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${modulo.chip}`}
        >
          {modulo.selo}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold leading-snug text-navy">{modulo.titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy/75">{modulo.resumo}</p>

      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-navy/70">
        {modulo.itens.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-navy/40" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-2">
        {modulo.status === "aberto" && modulo.to ? (
          <Link
            to={modulo.to}
            className="inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-navy-foreground transition-opacity hover:opacity-90"
          >
            {modulo.cta}
          </Link>
        ) : (
          <a
            href="#contato"
            className="inline-flex items-center justify-center rounded-md border border-navy/25 bg-card px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-background"
          >
            {modulo.cta}
          </a>
        )}
      </div>
    </article>
  );
}

export default function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-navy">Plataforma da Reforma Tributária</p>
            <p className="text-xs text-muted-foreground">EC 132/2023 e LC 214/2025</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#contato"
              className="text-sm font-semibold text-navy underline-offset-4 hover:underline"
            >
              Falar com o escritório
            </a>
            <Link
              to="/auth"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Área do advogado
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <div className="flex flex-wrap gap-2">
            {["IBS", "CBS", "Split Payment", "Crédito amplo", "Transição 2026–2033"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-navy-foreground/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy-foreground/80"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="mt-6 max-w-3xl text-3xl leading-tight sm:text-5xl">
            Uma suíte de ferramentas para atravessar a Reforma Tributária com números na mão
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-navy-foreground/80 sm:text-base">
            Uma plataforma completa com 6 ferramentas de cálculo para antecipar cenários de
            IBS/CBS, contratos, CAPEX e créditos tributários. Tenha uma primeira estimativa online e
            conte com o escritório para auditoria documental e parecer sob medida. As simulações
            online são estimativas e não substituem um diagnóstico fiscal completo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#solucoes"
              className="inline-flex items-center justify-center rounded-md bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ver as soluções
            </a>
            <Link
              to="/simulador"
              className="inline-flex items-center justify-center rounded-md border border-navy-foreground/35 px-6 py-3 text-sm font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10"
            >
              Simular meu impacto agora
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-5 py-14 sm:py-16">
        <section id="solucoes" className="scroll-mt-16">
          <h2 className="text-2xl">Soluções da plataforma</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Cada módulo trata de um problema distinto da transição. Dois estão abertos para uso
            imediato; os demais são conduzidos pela equipe a partir dos seus documentos.
          </p>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {MODULOS.map((modulo) => (
              <ModuloCard key={modulo.numero} modulo={modulo} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl">Como o trabalho acontece</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {JORNADA.map((passo) => (
              <div key={passo.etapa} className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy">
                  {passo.etapa}
                </p>
                <h3 className="mt-1 text-base font-semibold">{passo.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contato" className="scroll-mt-16">
          <OfficeContactCta message="Olá! Gostaria de falar sobre o impacto da Reforma Tributária no meu negócio." />
        </section>

        <section>
          <h2 className="text-2xl">O que muda com a Reforma Tributária</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A Reforma Tributária do consumo (Emenda Constitucional 132/2023, regulamentada pela LC
            214/2025) substitui cinco tributos por dois. PIS e COFINS dão lugar à CBS, de
            competência federal; ICMS e IPI e o ISS municipal dão lugar ao IBS, de competência
            compartilhada entre estados e municípios. O modelo passa a ser não cumulativo pleno: o
            que a empresa paga na compra vira crédito na venda.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Na prática, o tributo deixa de ser cobrado na origem e passa a ser cobrado no destino, o
            que muda preço, margem, precificação de contratos e planejamento de caixa — mesmo para
            quem terminar pagando um valor parecido.
          </p>
        </section>

        <section>
          <h2 className="text-2xl">Cronograma de 2026 a 2033</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-2">
            {TIMELINE.map((item) => (
              <li key={item.year} className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy">
                  {item.year}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-2xl">Quem é mais afetado</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {AUDIENCE.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          Conteúdo informativo. Estimativas baseadas na LC 214/2025 e no cronograma de transição
          vigente em {LEGAL_REFERENCE_DATE}. Alíquota de referência de 26,5% sujeita a alteração
          pelo Senado Federal. Não constitui aconselhamento jurídico ou tributário.
          <span className="mt-3 block">
            <Link to="/auth" className="font-semibold underline">
              Área restrita do escritório
            </Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
