import { createFileRoute, Link } from "@tanstack/react-router";

import { ParecerDashboard } from "@/components/cases/ParecerDashboard";
import { ParecerApresentacao } from "@/components/cases/ParecerApresentacao";
import { OfficeContactCta } from "@/components/contact/OfficeContactCta";
import { Notice } from "@/components/simulator/ui";
import { getParecerCompartilhado } from "@/lib/parecer.functions";
import { useState } from "react";

const TITLE = "Relatório executivo do diagnóstico — Reforma Tributária";
const DESCRIPTION =
  "Relatório executivo do diagnóstico tributário, com impacto apurado a partir dos documentos fiscais do cliente.";

export const Route = createFileRoute("/relatorio/$token")({
  loader: ({ params }) => getParecerCompartilhado({ data: { token: params.token } }),
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
  errorComponent: () => <Fallback message="Não foi possível abrir este relatório." />,
  notFoundComponent: () => <Fallback message="Relatório não encontrado." />,
  component: RelatorioDedicado,
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

function RelatorioDedicado() {
  const data = Route.useLoaderData();
  const [slides, setSlides] = useState(false);

  if (!data.found || !data.versao) {
    return <Fallback message="Este link de relatório não está mais ativo." />;
  }

  const parecer = data.versao;

  if (slides) {
    return (
      <main className="min-h-screen bg-background px-5 py-6">
        <div className="mx-auto max-w-5xl">
          <ParecerApresentacao
            snapshot={parecer.dados}
            edicoes={parecer.edicoes}
            versao={parecer.versao}
            onSair={() => setSlides(false)}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-5">
        <ParecerDashboard
          snapshot={parecer.dados}
          edicoes={parecer.edicoes}
          versao={parecer.versao}
          geradoEm={parecer.gerado_em}
          syncUrl
          onApresentar={() => setSlides(true)}
        />

        <Notice>
          Os valores deste relatório refletem os documentos e parâmetros disponíveis no momento da
          geração desta versão. Não substitui aconselhamento jurídico ou tributário individualizado.
        </Notice>

        <OfficeContactCta message="Olá! Recebi o link do relatório do diagnóstico e gostaria de conversar sobre os próximos passos." />
      </div>
    </main>
  );
}
