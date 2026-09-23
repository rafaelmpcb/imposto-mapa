import {
  Briefcase,
  Building2,
  Calculator,
  FileText,
  Factory,
  PiggyBank,
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
  | "monofasico"
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
    label: "Casos e Funil Comercial",
    hint: "CRM: clientes, etapas, contatos e diagnóstico",
    ativo: true,
    icon: Briefcase,
  },
  {
    id: "simulacoes",
    label: "Simulador de Impacto Fiscal",
    hint: "Histórico de simulações IBS/CBS",
    ativo: true,
    icon: Calculator,
  },
  {
    id: "locacao",
    label: "Locação e Contratos Imobiliários",
    hint: "Simulador de aluguéis e repactuação",
    ativo: true,
    icon: Building2,
  },
  {
    id: "contratos",
    label: "Gestão de Contratos e Reequilíbrio",
    hint: "Reequilíbrio econômico de contratos",
    ativo: true,
    icon: FileText,
  },
  {
    id: "creditos",
    label: "Monetização de Saldos Credores",
    hint: "Saldos acumulados de PIS/COFINS e ICMS",
    ativo: true,
    icon: Wallet,
  },
  {
    id: "monofasico",
    label: "PIS/COFINS Monofásico",
    hint: "Recuperação de crédito monofásico",
    ativo: true,
    icon: PiggyBank,
  },
  {
    id: "capex",
    label: "Planejamento de CAPEX",
    hint: "Crédito imediato x 1/48 avos",
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
    <nav aria-label="Ferramentas do painel" className="mx-auto max-w-7xl px-5">
      <div className="mb-4 mt-6 flex flex-wrap gap-2.5">
        {HUB_TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              title={tab.hint}
              className={`flex basis-[calc(50%-0.625rem)] items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-bold transition-all duration-200 sm:basis-[calc(33.333%-0.834rem)] xl:basis-0 xl:flex-1 xl:justify-center xl:whitespace-nowrap ${
                isActive
                  ? "border-navy bg-navy text-navy-foreground shadow-md"
                  : "border-border bg-card text-foreground hover:border-navy/40 hover:shadow-sm"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-navy-foreground/15 text-navy-foreground"
                    : "bg-secondary text-navy group-hover:bg-navy/10"
                }`}
              >
                <Icon size={16} strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 truncate">{tab.label}</span>
              {!tab.ativo ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
