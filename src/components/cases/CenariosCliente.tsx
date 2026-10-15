/**
 * Comparação visual de cenários de preço e margem para um cliente:
 * absorver o IBS/CBS, repassar integralmente ou dividir o impacto, ano a ano.
 * Usa o motor de reequilíbrio de contratos (transição gradual 2026–2033).
 */
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ANOS_DISPONIVEIS,
  calcularContrato,
  type ContratoInput,
  type RegimePrestador,
} from "@/lib/contratos/calculo";
import { brl } from "@/lib/tax/calc";

const pct = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const compact = (v: number) =>
  v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function CenariosCliente({
  faturamentoTotal,
  meses,
  regimeCliente,
}: {
  faturamentoTotal: number;
  meses: number;
  regimeCliente: string | null | undefined;
}) {
  const [regime, setRegime] = useState<RegimePrestador>("presumido");
  const [custoPct, setCustoPct] = useState(40);
  const [ano, setAno] = useState(2027);
  const precoMensal = faturamentoTotal / Math.max(1, meses);
  const perfil = regimeCliente === "simples" ? "simples" : "regular";

  const base: Omit<ContratoInput, "ano"> = {
    precoMensalAtual: precoMensal,
    regimePrestador: regime,
    perfilContratante: perfil,
    custoDiretoPct: custoPct,
    creditoInsumosPct: 50,
    cenario: "margem_prestador",
  };

  const serie = useMemo(
    () =>
      ANOS_DISPONIVEIS.map((a) => {
        const r = calcularContrato({ ...base, ano: a });
        const rep = r.cenarios.find((c) => c.id === "margem_prestador")!;
        const eq = r.cenarios.find((c) => c.id === "equilibrio")!;
        return {
          ano: String(a),
          r,
          precoRepasse: rep.precoSugerido,
          precoEquilibrio: eq.precoSugerido,
          margemAtual: r.atual.margemPrestador,
          margemAbsorve: r.semReequilibrio.margemPrestador,
          margemEquilibrio: eq.detalhe.margemPrestador,
          credito: rep.detalhe.creditoContratante,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [precoMensal, regime, perfil, custoPct],
  );

  const sel = serie.find((s) => s.ano === String(ano)) ?? serie[0]!;
  const r = sel.r;
  const rep = r.cenarios.find((c) => c.id === "margem_prestador")!;
  const eq = r.cenarios.find((c) => c.id === "equilibrio")!;
  const quedaMargem =
    r.atual.margemPrestador > 0
      ? ((r.semReequilibrio.margemPrestador - r.atual.margemPrestador) / r.atual.margemPrestador) * 100
      : 0;
  const custoLiqCliente = rep.detalhe.custoLiquidoContratante;

  const cards = [
    {
      t: "Se absorver o imposto",
      v: brl(r.semReequilibrio.margemPrestador),
      s: `Margem mensal ${pct(quedaMargem)} vs. hoje (${brl(r.atual.margemPrestador)})`,
      cls: "border-destructive/40",
    },
    {
      t: "Se repassar tudo",
      v: brl(rep.precoSugerido),
      s: `Preço ${pct(rep.variacaoPrecoPct)} · margem preservada`,
      cls: "border-primary/40",
    },
    {
      t: "Crédito que o cliente aproveita",
      v: brl(rep.detalhe.creditoContratante),
      s:
        perfil === "simples"
          ? "Cliente do Simples não aproveita crédito"
          : `Custo líquido dele: ${brl(custoLiqCliente)} (${pct(rep.variacaoCustoContratantePct)})`,
      cls: "border-border",
    },
    {
      t: "Ponto de equilíbrio",
      v: brl(eq.precoSugerido),
      s: `Preço ${pct(eq.variacaoPrecoPct)} · margem ${pct(eq.variacaoMargemPct)}`,
      cls: "border-border",
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Impacto do IBS/CBS no preço e na margem
          </p>
          <p className="text-xs text-muted-foreground">
            Preço mensal médio hoje: {brl(precoMensal)} · alíquota efetiva em {ano}:{" "}
            {r.aliquotaEfetivaPct.toLocaleString("pt-BR")}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
            value={regime}
            onChange={(e) => setRegime(e.target.value as RegimePrestador)}
          >
            <option value="presumido">Empresa no Presumido</option>
            <option value="real">Empresa no Real</option>
            <option value="simples">Empresa no Simples</option>
          </select>
          <label className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
            Custo direto
            <input
              type="number"
              min={0}
              max={95}
              value={custoPct}
              onChange={(e) => setCustoPct(Number(e.target.value))}
              className="w-12 bg-transparent text-right"
            />
            %
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {ANOS_DISPONIVEIS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAno(a)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              a === ano ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.t} className={`min-w-0 rounded-lg border-2 p-3 ${c.cls}`}>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">{c.t}</p>
            <p className="mt-1 break-words font-presentation-display text-xl text-foreground">{c.v}</p>
            <p className="text-[11px] text-muted-foreground">{c.s}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Margem mensal: absorver x equilíbrio x hoje
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compact} fontSize={11} width={50} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="margemAtual" name="Hoje" fill="#12234a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="margemEquilibrio" name="Equilíbrio" fill="#7c6cf5" radius={[3, 3, 0, 0]} />
                <Bar dataKey="margemAbsorve" name="Absorvendo" fill="#e05fa8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Preço necessário e crédito ao cliente, ano a ano
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compact} fontSize={11} width={50} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="precoRepasse" name="Repasse total" stroke="#12234a" strokeWidth={2} />
                <Line dataKey="precoEquilibrio" name="Equilíbrio" stroke="#7c6cf5" strokeWidth={2} />
                <Line dataKey="credito" name="Crédito ao cliente" stroke="#2ec4a6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimativa com transição gradual do IBS/CBS. Ajuste o regime da empresa e o custo direto para
        refletir a realidade do contrato.
      </p>
    </div>
  );
}
