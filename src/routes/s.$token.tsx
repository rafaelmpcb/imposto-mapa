import { createFileRoute, Link } from "@tanstack/react-router";

import { OfficeContactCta } from "@/components/contact/OfficeContactCta";
import { ResultView } from "@/components/simulator/ResultView";
import { Notice } from "@/components/simulator/ui";
import { getSharedSimulation } from "@/lib/simulations.functions";
import { defaultInput, type SimulationInput } from "@/lib/tax/calc";
import { LEGAL_REFERENCE_DATE, type YearId } from "@/lib/tax/constants";

const TITLE = "Simulação compartilhada — impacto da Reforma Tributária";
const DESCRIPTION =
  "Resultado estimado do impacto da Reforma Tributária (IBS/CBS), compartilhado em modo somente leitura.";

export const Route = createFileRoute("/s/$token")({
  loader: ({ params }) => getSharedSimulation({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Fallback message="Não foi possível abrir esta simulação compartilhada." />
  ),
  notFoundComponent: () => <Fallback message="Simulação não encontrada." />,
  component: SharedSimulation,
});

function Fallback({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{message}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O link pode ter sido desativado pelo escritório.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-navy underline">
          Ir para o simulador
        </Link>
      </div>
    </main>
  );
}

function SharedSimulation() {
  const data = Route.useLoaderData();

  if (!data.found || !data.item) {
    return <Fallback message="Este link de compartilhamento não está mais ativo." />;
  }

  const item = data.item;
  const input = {
    ...defaultInput(),
    ...(item.input as unknown as Partial<SimulationInput>),
  } as SimulationInput;
  const year = item.year_id as YearId;

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-4xl px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
            Simulação compartilhada · somente leitura
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">
            {item.client_name || "Impacto estimado da Reforma Tributária"}
          </h1>
          <p className="mt-3 text-sm text-navy-foreground/80">
            Gerada em {new Date(item.created_at).toLocaleDateString("pt-BR")} · cenário {year}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <ResultView
            input={input}
            year={year}
            onYearChange={() => {}}
            clientName={item.client_name ?? ""}
            onClientNameChange={() => {}}
            presentationMode
            onPresentationModeChange={() => {}}
            readOnly
          />
        </section>

        <Notice>
          Esta é uma estimativa baseada nos dados informados e na legislação vigente da Reforma
          Tributária (LC 214/2025) em {LEGAL_REFERENCE_DATE}. Não substitui uma análise fiscal
          completa nem constitui aconselhamento jurídico ou tributário.
        </Notice>

        <OfficeContactCta message="Olá! Recebi o link da simulação da Reforma Tributária e gostaria de conversar sobre o diagnóstico completo." />

        <Link to="/" className="inline-block text-sm font-semibold text-navy underline">
          Fazer minha própria simulação
        </Link>
      </div>
    </main>
  );
}
