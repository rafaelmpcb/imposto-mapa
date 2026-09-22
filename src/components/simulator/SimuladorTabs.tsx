import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type CalcRoute =
  | "/simulador"
  | "/aluguel"
  | "/capex"
  | "/contratos"
  | "/saldos-credores"
  | "/monofasico";

/** Cabeçalho de navegação das calculadoras públicas: botão Início centralizado. */
export function SimuladorTabs({ active }: { active?: CalcRoute }) {
  void active;
  return (
    <nav className="mx-auto max-w-6xl px-5 pt-5">
      <div className="flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:bg-navy/90 hover:shadow-lg"
          aria-label="Voltar à tela inicial do portal"
        >
          <ArrowLeft className="h-4 w-4" />
          Início
        </Link>
      </div>
    </nav>
  );
}
