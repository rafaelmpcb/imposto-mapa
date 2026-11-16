import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { OfficeContactCta } from "@/components/contact/OfficeContactCta";
import { SimuladorTabs } from "@/components/simulator/SimuladorTabs";
import { Field, MoneyInput, NumberInput, Notice } from "@/components/simulator/ui";
import { AVISO_EQUIPARACAO, calcularEquiparacao } from "@/lib/equiparacao/calculo";
import { brl } from "@/lib/tax/calc";

const TITLE = "Simulação rápida de Equiparação Hospitalar para clínicas";
const DESCRIPTION =
  "Clínicas médicas no Lucro Presumido podem pagar menos IRPJ e CSLL sobre exames e procedimentos. Estime a economia mensal e o valor a recuperar dos últimos 5 anos.";

export const Route = createFileRoute("/equiparacao-hospitalar")({
  head: () => ({
    meta: [
      { title: `${TITLE} | RCB Inteligência Tributária` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EquiparacaoRapida,
});

function EquiparacaoRapida() {
  const [receita, setReceita] = useState(0);
  const [pct, setPct] = useState(60);
  const [meses, setMeses] = useState(60);
  const r = calcularEquiparacao({
    receitaMensal: receita,
    fracaoProcedimentos: pct / 100,
    mesesRetroativos: meses,
    selicAcumuladaPct: 0,
    exitoPct: 0,
  });

  const pronto = receita > 0;
  const tributos = [
    { nome: "IRPJ", Hoje: r.atual.irpj, Equiparado: r.equiparado.irpj },
    { nome: "CSLL", Hoje: r.atual.csll, Equiparado: r.equiparado.csll },
    { nome: "Total", Hoje: r.atual.total, Equiparado: r.equiparado.total },
  ];
  const acumulado = Array.from({ length: Math.ceil(r.meses / 12) }, (_, k) => {
    const m = Math.min(r.meses, (k + 1) * 12);
    return { ano: `${m} meses`, valor: r.economiaMensal * m };
  });

  return (
    <main className="min-h-screen bg-background">
      <SimuladorTabs active="/equiparacao-hospitalar" />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            Tese tributária · Lei 9.249/95 · Tema 217/STJ
          </p>
          <h1 className="font-brand mt-1 text-2xl font-extrabold text-foreground sm:text-3xl">
            Equiparação Hospitalar: quanto sua clínica paga a mais
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{DESCRIPTION}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <Field label="Faturamento bruto mensal médio" hint="Média dos últimos 12 meses.">
              <MoneyInput value={receita} onChange={setReceita} />
            </Field>
            <Field
              label={`Exames e procedimentos: ${pct}% do faturamento`}
              hint="Consultas simples não entram no benefício. Use uma estimativa."
            >
              <input
                type="range"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-full accent-[var(--color-navy)]"
              />
            </Field>
            <Field label="Meses no Lucro Presumido" hint="Considera no máximo os últimos 60 meses.">
              <NumberInput value={meses} onChange={setMeses} suffix="meses" max={60} />
            </Field>
            <Notice>{AVISO_EQUIPARACAO}</Notice>
          </section>

          <section className="space-y-6">
            {pronto ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Kpi
                    label="Pago a maior no período"
                    value={brl(r.indebitoNominal)}
                    detail={`${r.meses} meses, ainda sem correção pela Selic`}
                    tone="good"
                  />
                  <Kpi
                    label="Pago a maior por mês"
                    value={brl(r.economiaMensal)}
                    detail="Diferença de IRPJ + CSLL"
                    tone="bad"
                  />
                  <Kpi
                    label="Economia nos próximos 12 meses"
                    value={brl(r.economiaAnual)}
                    detail={`Tributo trimestral cai de ${brl(r.atual.total)} para ${brl(r.equiparado.total)}`}
                  />
                </div>

                <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Leitura do cenário</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Com {pct}% do faturamento em exames e procedimentos, a base de cálculo dessa
                    parcela cai de 32% para 8% no IRPJ e 12% na CSLL. O valor a recuperar ainda é
                    corrigido pela Selic e a confirmação depende da análise das notas da clínica
                    pela equipe da RCB.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    IRPJ e CSLL por trimestre: hoje x equiparado
                  </p>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tributos}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v: number) => brl(v)} tick={{ fontSize: 11 }} width={90} />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Legend />
                        <Bar dataKey="Hoje" fill={COLORS.atual} radius={[6, 6, 0, 0]} />
                        <Bar dataKey="Equiparado" fill={COLORS.economia} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Valor pago a maior acumulado no período
                  </p>
                  <div className="mt-3 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={acumulado}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v: number) => brl(v)} tick={{ fontSize: 11 }} width={90} />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Bar dataKey="valor" name="Acumulado" fill={COLORS.correcao} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Informe o faturamento mensal para ver a estimativa e os gráficos.
              </div>
            )}
          </section>
        </div>

        <div className="mt-8">
          <OfficeContactCta message="Olá! Fiz a simulação de Equiparação Hospitalar e quero confirmar o valor da minha clínica." />
        </div>
      </div>
    </main>
  );
}

const COLORS = { atual: "#1e3a5f", correcao: "#d946a0", economia: "#2bbfa4" };

function Kpi({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const ring =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "bad"
        ? "border-rose-200 bg-rose-50"
        : "border-border bg-secondary";
  return (
    <article className={`rounded-xl border p-4 ${ring}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </article>
  );
}
