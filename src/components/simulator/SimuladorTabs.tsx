import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const TABS = [
  { to: "/simulador", label: "Empresas e salários (IBS/CBS)" },
  { to: "/aluguel", label: "Locação e contratos" },
  { to: "/capex", label: "Planejamento de CAPEX" },
  { to: "/contratos", label: "Contratos e reequilíbrio" },
  { to: "/saldos-credores", label: "Saldos credores" },
  { to: "/monofasico", label: "Recuperação monofásica" },
] as const;

/** Abas de navegação entre as calculadoras públicas. */
export function SimuladorTabs({
  active,
}: {
  active:
    | "/simulador"
    | "/aluguel"
    | "/capex"
    | "/contratos"
    | "/saldos-credores"
    | "/monofasico";
}) {

  return (
    <nav className="mx-auto max-w-6xl px-5">
      <div className="flex items-end gap-4">
        <Link
          to="/"
          className="mb-2 flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Voltar à tela inicial do portal"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Início
        </Link>
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => {
            const isActive = t.to === active;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-b-2 border-navy text-navy"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
