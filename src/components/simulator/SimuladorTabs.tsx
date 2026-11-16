import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import logoNegativa from "@/assets/rcb-logo-negativa-crop.png";

type CalcRoute =
  | "/simulador"
  | "/aluguel"
  | "/capex"
  | "/contratos"
  | "/saldos-credores"
  | "/monofasico"
  | "/equiparacao-hospitalar";

/** Barra de marca das calculadoras públicas: logo RCB e retorno ao portal. */
export function SimuladorTabs({ active }: { active?: CalcRoute }) {
  void active;
  return (
    <nav className="border-b border-white/10 bg-navy">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link to="/" aria-label="Página inicial da RCB Inteligência Tributária">
          <img
            src={logoNegativa}
            alt="RCB Inteligência Tributária"
            className="h-11 w-auto sm:h-12"
          />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-mint px-5 py-2.5 text-sm font-bold text-navy shadow-[0_0_28px_-10px_#10b981] transition-transform hover:-translate-y-0.5"
          aria-label="Voltar à tela inicial do portal"
        >
          <ArrowLeft className="h-4 w-4" />
          Início
        </Link>
      </div>
    </nav>
  );
}
