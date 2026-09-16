import { LEGAL_REFERENCE_DATE, YEARS, type YearId } from "@/lib/tax/constants";
import { brl, pct, simulate, type SimulationInput } from "@/lib/tax/calc";
import { Notice } from "./ui";

function ScenarioCard({
  title,
  subtitle,
  tone,
  lines,
  total,
  rate,
}: {
  title: string;
  subtitle: string;
  tone: "current" | "reform";
  lines: { label: string; value: number }[];
  total: number;
  rate: number;
}) {
  const accent =
    tone === "current"
      ? "border-danger/35 bg-danger-soft"
      : "border-success/35 bg-success-soft";
  const totalColor = tone === "current" ? "text-danger" : "text-success";
  return (
    <div className={`rounded-xl border p-5 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {subtitle}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-foreground">{title}</h3>
      <dl className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{l.label}</dt>
            <dd className="font-medium tabular-nums">{brl(l.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t border-border/60 pt-4">
        <p className={`text-3xl font-bold tabular-nums ${totalColor}`}>{brl(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          por mês · carga de {pct(rate)} sobre a base informada
        </p>
      </div>
    </div>
  );
}

export function ResultView({
  input,
  year,
  onYearChange,
}: {
  input: SimulationInput;
  year: YearId;
  onYearChange: (y: YearId) => void;
}) {
  const result = simulate(input, year);
  const diff = result.reform.total - result.current.total;
  const worse = diff > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Ano de referência</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {YEARS.map((y) => (
            <button
              key={y.id}
              type="button"
              onClick={() => onYearChange(y.id)}
              className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                year === y.id
                  ? "border-navy bg-navy text-navy-foreground"
                  : "border-input bg-card hover:bg-secondary"
              }`}
            >
              {y.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Notice tone="warning">
            Os valores de 2027 em diante são projeções baseadas no cronograma legal atual, que
            ainda pode ser ajustado por regulamentação complementar.
          </Notice>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScenarioCard
          title="Sistema Atual"
          subtitle="Como você paga hoje"
          tone="current"
          lines={result.current.lines}
          total={result.current.total}
          rate={result.current.rate}
        />
        <ScenarioCard
          title="Reforma Tributária"
          subtitle={`Cenário ${year}`}
          tone="reform"
          lines={result.reform.lines}
          total={result.reform.total}
          rate={result.reform.rate}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Resumo executivo</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Com base nos dados informados, sua carga tributária projetada muda de{" "}
          <strong className="text-danger">{pct(result.current.rate)}</strong> para{" "}
          <strong className="text-success">{pct(result.reform.rate)}</strong> em {year} — uma{" "}
          {worse ? "elevação" : "redução"} estimada de{" "}
          <strong className="text-foreground">{brl(Math.abs(diff))}</strong> por mês (
          {brl(Math.abs(diff) * 12)} por ano).
        </p>
        {result.benefitLost ? (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm">
            Benefício de redução de alíquota <strong>não aplicado</strong>: a composição societária
            informada não atende aos requisitos da profissão regulamentada.
          </p>
        ) : null}
        {result.benefitApplied ? (
          <p className="mt-3 rounded-md border border-success/40 bg-success-soft px-4 py-3 text-sm">
            Benefício aplicado: alíquota efetiva de IBS/CBS de{" "}
            <strong>{pct(result.effectiveNewRate)}</strong> em vez de 26,5%.
          </p>
        ) : null}
        {result.notes.length ? (
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {result.notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden className="text-navy">
                  •
                </span>
                {n}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-semibold">O que esta estimativa considera</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>Alíquota de referência de 26,5% e reduções por atividade</li>
            <li>Tributos sobre consumo do regime atual (PIS, COFINS, ICMS/ISS, Simples)</li>
            <li>IRPJ, CSLL e contribuição previdenciária patronal sobre a folha</li>
            <li>Créditos estimados sobre compras e receita monofásica informadas</li>
            <li>Cronograma de transição previsto na LC 214/2025</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-semibold">O que NÃO considera</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>Benefícios estaduais/municipais, substituição tributária e regimes especiais</li>
            <li>Split payment, cashback e Imposto Seletivo</li>
            <li>Créditos acumulados, estoques e operações interestaduais específicas</li>
            <li>Planejamento societário, distribuição de lucros e tributação de dividendos</li>
            <li>Particularidades contratuais e reprecificação com clientes e fornecedores</li>
          </ul>
        </div>
      </div>

      <Notice>
        Esta é uma estimativa baseada nos dados informados e na legislação vigente da Reforma
        Tributária (LC 214/2025) em {LEGAL_REFERENCE_DATE}. Não substitui uma análise fiscal
        completa nem constitui aconselhamento jurídico ou tributário.
      </Notice>
    </div>
  );
}
