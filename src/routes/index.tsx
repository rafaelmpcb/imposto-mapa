import { createFileRoute, Link } from "@tanstack/react-router";

import { LEGAL_REFERENCE_DATE } from "@/lib/tax/constants";

const TITLE = "Calculadora da Reforma Tributária 2026 — simulador IBS e CBS";
const DESCRIPTION =
  "Entenda a Reforma Tributária e simule gratuitamente o impacto do IBS e da CBS na sua empresa ou no seu salário em 2026, 2027 e 2033.";

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

export default function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
             
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-5xl">
            Calculadora da Reforma Tributária: quanto o IBS e a CBS mudam na sua conta
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-navy-foreground/80 sm:text-base">
            Em cinco etapas rápidas, compare a carga tributária que você paga hoje com a projeção
            sob o novo sistema, nos cenários de 2026, 2027 e 2033. É uma estimativa — não substitui
            um diagnóstico fiscal completo.
          </p>
          <Link
            to="/simulador"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
             Começar a simulação
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-12 px-5 py-12 sm:py-16">
        <section>
          <h2 className="text-2xl">O que muda com a Reforma Tributária</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A Reforma Tributária do consumo (Emenda Constitucional 132/2023, regulamentada pela LC
            214/2025) substitui cinco tributos por dois. PIS e COFINS dão lugar à CBS, de
            competência federal; ICMS e IPI e o ISS municipal dão lugar ao IBS, de competência
            compartilhada entre estados e municípios. O modelo passa a ser não cumulativo pleno: o
            que a empresa paga na compra vira crédito na venda.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Na prática, o tributo deixa de ser cobrado na origem e passa a ser cobrado no destino, o
            que muda preço, margem, precificação de contratos e planejamento de caixa — mesmo para
            quem terminar pagando um valor parecido.
          </p>
        </section>

        <section>
          <h2 className="text-2xl">Cronograma de 2026 a 2033</h2>
          <ol className="mt-5 space-y-4">
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

        <section>
          <h2 className="text-2xl">O que o simulador entrega</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>Comparação entre a carga atual e a projetada, tributo a tributo.</li>
            <li>Diferença em reais por mês e em pontos percentuais da carga.</li>
            <li>Gráficos de impacto imediato e de evolução ao longo da transição.</li>
            <li>Comparação entre Simples Nacional, Lucro Presumido e Lucro Real após a reforma.</li>
            <li>Resumo executivo com os benefícios de alíquota aplicáveis à sua atividade.</li>
          </ul>
          <Link
            to="/simulador"
            className="mt-7 inline-flex items-center justify-center rounded-md bg-navy px-6 py-3 text-sm font-semibold text-navy-foreground transition-colors hover:bg-primary"
          >
            Simular o impacto no meu caso
          </Link>
        </section>

        <footer className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          Conteúdo informativo. Estimativas baseadas na LC 214/2025 e no cronograma de transição
          vigente em {LEGAL_REFERENCE_DATE}. Alíquota de referência de 26,5% sujeita a alteração
          pelo Senado Federal. Não constitui aconselhamento jurídico ou tributário.
          <span className="mt-3 block">
            <Link to="/meus-calculos" className="font-semibold underline">
              Meus Cálculos (acesso do escritório)
            </Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
