import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SpedRegistro } from "@/lib/sped.functions";
import { baseAnual, impactoPorRegime, type RegimeComparado } from "@/lib/sped/impacto";
import type { SpedContribResumo, SpedIcmsResumo } from "@/lib/sped/parse";
import { brl } from "@/lib/tax/calc";

const LABEL: Record<RegimeComparado, string> = { real: "Lucro Real", presumido: "Lucro Presumido" };
const compact = (v: number) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Impacto real por regime: parte da apuração escriturada no SPED, ano a ano. */
export function SpedImpactoRegimes({ itens }: { itens: SpedRegistro[] }) {
  const [ano, setAno] = useState(2027);
  const base = useMemo(
    () =>
      baseAnual(
        itens.filter((i) => i.tipo === "icms_ipi").map((i) => ({ periodo_ini: i.periodo_ini, resumo: i.resumo as SpedIcmsResumo })),
        itens.filter((i) => i.tipo === "contribuicoes").map((i) => ({ periodo_ini: i.periodo_ini, resumo: i.resumo as SpedContribResumo })),
      ),
    [itens],
  );
  const regimes = useMemo(() => (base ? impactoPorRegime(base) : []), [base]);
  if (!base || regimes.length === 0) return null;

  const serie = regimes[0]!.anos.map((a, idx) => ({
    ano: String(a.ano),
    ...Object.fromEntries(regimes.map((r) => [r.regime, r.anos[idx]!.total])),
  }));
  const melhor = [...regimes].sort(
    (a, b) => (a.anos.find((x) => x.ano === ano)?.total ?? 0) - (b.anos.find((x) => x.ano === ano)?.total ?? 0),
  )[0]!;

  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Impacto real por regime — a partir do que foi escriturado
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Base anualizada de {base.meses} mês(es) do SPED: receita {brl(base.receita)} · entradas {brl(base.entradas)} ·
        ICMS recolhido {brl(base.icmsRecolhido)} · PIS/Cofins recolhido {brl(base.pisCofinsRecolhido)}.
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {regimes[0]!.anos.map((a) => (
          <button
            key={a.ano}
            type="button"
            onClick={() => setAno(a.ano)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${a.ano === ano ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {a.ano}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {regimes.map((r) => {
          const a = r.anos.find((x) => x.ano === ano)!;
          return (
            <div key={r.regime} className={`min-w-0 rounded-lg border-2 p-3 ${r === melhor ? "border-primary/50" : "border-border"}`}>
              <p className="text-sm font-semibold text-foreground">
                {LABEL[r.regime]}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {r.declarado ? "(regime declarado no SPED)" : "(simulado com a mesma base)"}
                </span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Hoje (ICMS+IPI+PIS/Cofins)</dt>
                <dd className="text-right font-semibold">{brl(r.hoje.total)}</dd>
                <dt className="text-muted-foreground">Créditos aproveitados hoje</dt>
                <dd className="text-right">{brl(r.hoje.creditosAproveitados)}</dd>
                <dt className="text-muted-foreground">Débito IBS/CBS em {ano}</dt>
                <dd className="text-right">{brl(a.debitoIbsCbs)}</dd>
                <dt className="text-muted-foreground">Crédito IBS/CBS das entradas</dt>
                <dd className="text-right">{brl(a.creditoIbsCbs)}</dd>
                <dt className="text-muted-foreground">Tributos antigos que restam</dt>
                <dd className="text-right">{brl(a.icms + a.ipi + a.pisCofins)}</dd>
                <dt className="font-semibold text-foreground">Total no ano</dt>
                <dd className="break-words text-right font-semibold text-foreground">{brl(a.total)}</dd>
                <dt className="text-muted-foreground">Variação vs. hoje</dt>
                <dd className={`text-right font-semibold ${a.variacaoVsHoje > 0 ? "text-destructive" : "text-foreground"}`}>
                  {a.variacaoVsHoje > 0 ? "+" : ""}
                  {brl(a.variacaoVsHoje)}
                </dd>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="mt-4 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={compact} fontSize={11} width={50} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="real" name="Lucro Real" fill="#12234a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="presumido" name="Lucro Presumido" fill="#7c6cf5" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {base.saldoCredorIcms > 0 || base.saldoCredorPisCofins > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Créditos herdados: saldo de PIS/Cofins {brl(base.saldoCredorPisCofins)} (pode abater a CBS a partir de 2027) e
          saldo credor de ICMS {brl(base.saldoCredorIcms)} (ressarcimento parcelado após 2033, se homologado).
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Só tributos sobre o consumo; IRPJ/CSLL ficam fora. O regime declarado usa os valores reais do SPED; o outro é
        simulado sobre a mesma receita e as mesmas entradas. O Simples depende do DAS e não entra nesta comparação.
      </p>
    </div>
  );
}
