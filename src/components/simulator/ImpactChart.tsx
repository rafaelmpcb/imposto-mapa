import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  brl,
  isSimplesRegularExitScenario,
  SIMPLES_REGULAR_EXIT_2033_LABEL,
  simulate,
  type SimulationInput,
} from "@/lib/tax/calc";
import { TRANSITION_YEARS, type YearId } from "@/lib/tax/constants";

const compact = (v: number) =>
  v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function ImpactChart({
  input,
  year,
  presentationMode = false,
}: {
  input: SimulationInput;
  year: YearId;
  presentationMode?: boolean;
}) {
  const result = simulate(input, year);
  const isRegularExit = isSimplesRegularExitScenario(input, year);
  const projectedLabel = isRegularExit
    ? SIMPLES_REGULAR_EXIT_2033_LABEL
    : `Reforma ${year}`;
  const comparison = [
    { name: "Hoje", valor: Math.round(result.current.total), tone: "atual" },
    { name: projectedLabel, valor: Math.round(result.reform.total), tone: "reforma" },
  ];
  const evolution = TRANSITION_YEARS.map((y) => {
    const r = simulate(input, y.id);
    return {
      name: y.short,
      Atual: Math.round(r.current.total),
      Projetado: Math.round(r.reform.total),
    };
  });

  return (
    <section
      className={
        presentationMode
          ? "border-t border-border px-0 py-10"
          : "rounded-xl border border-border bg-card p-5"
      }
    >
      <h3 className={presentationMode ? "font-presentation-display text-xl font-semibold" : "text-lg font-semibold"}>
        Visão gráfica
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Carga tributária mensal estimada: comparação direta e evolução ao longo da transição.
      </p>
      {input.taxpayerType === "simples" ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Em 2033, a linha projetada representa “{SIMPLES_REGULAR_EXIT_2033_LABEL}” e não a
          permanência no DAS.
        </p>
      ) : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hoje x cenário {year}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={12} width={52} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {comparison.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.tone === "atual"
                          ? "var(--color-danger, #b91c1c)"
                          : "var(--color-success, #15803d)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evolução ano a ano (2026 a 2033)
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={12} width={52} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="Atual"
                  stroke="var(--color-danger, #b91c1c)"
                  strokeWidth={2}
                  dot
                />
                <Line
                  type="monotone"
                   dataKey="Projetado"
                   name="Cenário projetado"
                  stroke="var(--color-success, #15803d)"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
