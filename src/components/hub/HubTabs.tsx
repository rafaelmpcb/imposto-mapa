import {
  Briefcase,
  Building2,
  Calculator,
  FileText,
  Factory,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Abas do painel de gestão: uma por ferramenta do SaaS. */
export type HubTabId =
  | "casos"
  | "simulacoes"
  | "locacao"
  | "contratos"
  | "creditos"
  | "capex";

export interface HubTab {
  id: HubTabId;
  label: string;
  hint: string;
  ativo: boolean;
  icon: LucideIcon;
}

export const HUB_TABS: HubTab[] = [
  {
    id: "casos",
    label: "Casos e funil",
    hint: "Clientes, etapas e diagnóstico",
    ativo: true,
    icon: Briefcase,
  },
  {
    id: "simulacoes",
    label: "Impacto fiscal",
    hint: "Histórico de simulações IBS/CBS",
    ativo: true,
    icon: Calculator,
  },
  {
    id: "locacao",
    label: "Locação",
    hint: "Contratos de aluguel simulados",
    ativo: true,
    icon: Building2,
  },
  {
    id: "contratos",
    label: "Gestão de contratos",
    hint: "Reequilíbrio econômico",
    ativo: false,
    icon: FileText,
  },
  {
    id: "creditos",
    label: "Saldos credores",
    hint: "PIS/COFINS e ICMS",
    ativo: true,
    icon: Wallet,
  },

  {
    id: "capex",
    label: "CAPEX",
    hint: "Crédito imediato x 1/48",
    ativo: true,
    icon: Factory,
  },
];

export function HubTabBar({
  active,
  onChange,
}: {
  active: HubTabId;
  onChange: (id: HubTabId) => void;
}) {
  return (
    <nav aria-label="Ferramentas do painel" className="mx-auto max-w-6xl px-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {HUB_TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`group flex flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                isActive
                  ? "border-navy bg-navy text-navy-foreground shadow-md"
                  : "border-border bg-card text-foreground hover:border-navy/40 hover:shadow-sm"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-navy-foreground/15 text-navy-foreground"
                    : "bg-secondary text-navy group-hover:bg-navy/10"
                }`}
              >
                <Icon size={18} strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">
                  {tab.label}
                </span>
                <span
                  className={`mt-0.5 block text-xs leading-snug ${
                    isActive ? "text-navy-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {tab.hint}
                </span>
              </span>
              {!tab.ativo ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isActive
                      ? "bg-navy-foreground/15 text-navy-foreground/80"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Em breve
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
