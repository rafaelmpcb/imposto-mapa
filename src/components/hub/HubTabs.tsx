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
}

export const HUB_TABS: HubTab[] = [
  { id: "casos", label: "Casos e funil", hint: "Clientes, etapas e diagnóstico", ativo: true },
  {
    id: "simulacoes",
    label: "Impacto fiscal",
    hint: "Histórico de simulações IBS/CBS",
    ativo: true,
  },
  { id: "locacao", label: "Locação", hint: "Contratos de aluguel simulados", ativo: true },
  {
    id: "contratos",
    label: "Gestão de contratos",
    hint: "Reequilíbrio econômico",
    ativo: false,
  },
  { id: "creditos", label: "Saldos credores", hint: "PIS/COFINS e ICMS", ativo: false },
  { id: "capex", label: "CAPEX", hint: "Crédito imediato x 1/48", ativo: false },
];

export function HubTabBar({
  active,
  onChange,
}: {
  active: HubTabId;
  onChange: (id: HubTabId) => void;
}) {
  return (
    <nav className="mx-auto max-w-6xl px-5">
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {HUB_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${
                isActive
                  ? "border-b-2 border-navy text-navy"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="block">{tab.label}</span>
              <span className="block text-xs font-normal text-muted-foreground">{tab.hint}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
