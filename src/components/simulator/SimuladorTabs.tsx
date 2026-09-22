import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/simulador", label: "Empresas e salários (IBS/CBS)" },
  { to: "/aluguel", label: "Locação e contratos" },
] as const;

/** Abas de navegação entre as calculadoras públicas. */
export function SimuladorTabs({ active }: { active: "/simulador" | "/aluguel" }) {
  return (
    <nav className="mx-auto max-w-6xl px-5">
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
    </nav>
  );
}
