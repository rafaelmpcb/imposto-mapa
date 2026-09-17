import { useMemo, useState } from "react";
import { LEGAL_REFERENCE_DATE, YEARS, type YearId } from "@/lib/tax/constants";
import {
  brl,
  compareRegimes,
  pct,
  pjClientAdvisory,
  simulate,
  type RegimeComparisonItem,
  type SimulationInput,
  type TaxpayerType,
} from "@/lib/tax/calc";
import { ImpactChart } from "./ImpactChart";
import { RateMatrix } from "./RateMatrix";
import { Field, Notice, TextInput, Toggle } from "./ui";

const REGIME_LABELS: Record<TaxpayerType, string> = {
  pf: "Pessoa Física (CLT)",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

function DifferenceCard({
  diff,
  rateDiff,
  caption,
}: {
  diff: number;
  rateDiff: number;
  caption?: string;
}) {
  const worse = diff > 0;
  const unchanged = Math.abs(diff) < 0.005;
  const tone = unchanged
    ? "border-border bg-secondary text-foreground"
    : worse
      ? "border-danger/35 bg-danger-soft text-danger"
      : "border-success/35 bg-success-soft text-success";
  const label = unchanged
    ? "Sem alteração estimada"
    : worse
      ? "Aumento estimado"
      : "Economia estimada";
  const pp = `${rateDiff > 0 ? "+" : ""}${(rateDiff * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} p.p.`;
  return (
    <div className={`mx-auto max-w-xl rounded-xl border-2 p-6 text-center ${tone}`}>
      <p className="text-sm font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-4xl font-bold tabular-nums">{brl(Math.abs(diff))}</p>
      <p className="mt-1 text-sm font-medium">por mês</p>
      <p className="mt-4 border-t border-current/20 pt-4 text-base font-semibold tabular-nums">
        {pp} na carga tributária
      </p>
      {caption ? <p className="mt-2 text-xs font-medium opacity-80">{caption}</p> : null}
    </div>
  );
}

function RegimeDetail({
  currentItem,
  item,
  year,
  presentationMode,
}: {
  currentItem: RegimeComparisonItem;
  item: RegimeComparisonItem;
  year: YearId;
  presentationMode: boolean;
}) {
  const diff = item.total - currentItem.total;
  const rateDiff = item.rate - currentItem.rate;
  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Comparação das duas projeções pós-reforma em {year}: {currentItem.label} (seu regime atual)
        e {item.label}.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <ScenarioCard
          title={currentItem.label}
          subtitle={`Cenário ${year} — seu regime atual`}
          tone="current"
          total={currentItem.total}
          rate={currentItem.rate}
          lines={presentationMode ? undefined : currentItem.lines}
        />
        <ScenarioCard
          title={item.label}
          subtitle={`Cenário ${year} — regime alternativo`}
          tone="reform"
          total={item.total}
          rate={item.rate}
          lines={presentationMode ? undefined : item.lines}
        />
      </div>
      <DifferenceCard
        diff={diff}
        rateDiff={rateDiff}
        caption={`${item.label} em relação a ${currentItem.label}`}
      />
    </div>
  );
}

function RegimeComparison({
  input,
  year,
  presentationMode,
}: {
  input: SimulationInput;
  year: YearId;
  presentationMode: boolean;
}) {
  const items = compareRegimes(input, year);
  const currentItem = items.find((i) => i.isCurrent);
  const [openRegime, setOpenRegime] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold">Comparação entre regimes</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Carga tributária mensal estimada em {year}, após a reforma, nos três regimes. Clique em um
        regime alternativo para ver a comparação detalhada com o seu regime atual.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const expandable = !item.isCurrent && !!currentItem;
          const isOpen = openRegime === item.regime;
          const cardClass = `w-full rounded-lg border p-4 text-left transition-colors ${
            item.isBest ? "border-success/50 bg-success-soft" : "border-border bg-secondary"
          } ${isOpen ? "ring-2 ring-navy/40" : ""}`;
          const content = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-foreground">{item.label}</h4>
                {item.isCurrent ? (
                  <span className="rounded-full border border-navy/40 bg-card px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy">
                    Seu regime atual
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                {brl(item.total)}
              </p>
              <p className="text-xs text-muted-foreground">
                por mês · {pct(item.rate)} do faturamento
              </p>
              {item.isBest ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-success">
                  Mais vantajoso após a reforma
                </p>
              ) : null}
              {item.estimateNote ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {item.estimateNote}
                </p>
              ) : null}
              {expandable ? (
                <p className="mt-3 text-xs font-semibold text-navy">
                  {isOpen ? "Ocultar comparação detalhada" : "Ver comparação detalhada"}
                </p>
              ) : null}
            </>
          );

          return expandable ? (
            <button
              key={item.regime}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenRegime(isOpen ? null : item.regime)}
              className={cardClass}
            >
              {content}
            </button>
          ) : (
            <div key={item.regime} className={cardClass}>
              {content}
            </div>
          );
        })}
      </div>

      {currentItem
        ? items
            .filter((item) => !item.isCurrent && openRegime === item.regime)
            .map((item) => (
              <RegimeDetail
                key={item.regime}
                currentItem={currentItem}
                item={item}
                year={year}
                presentationMode={presentationMode}
              />
            ))
        : null}

      {advisory ? (
        <div className="mt-4">
          <Notice tone="warning">{advisory}</Notice>
        </div>
      ) : null}

      <div className="mt-4">
        <Notice>
          Simples Nacional exige faturamento anual de até R$ 4,8 milhões e não é permitido para
          algumas atividades. Lucro Real é obrigatório para faturamento anual acima de R$ 78 milhões
          ou determinadas atividades financeiras. Migrar de regime tributário tem implicações legais
          e operacionais além do cálculo de impostos — este comparativo é uma estimativa para
          orientar a conversa, não uma recomendação definitiva.
        </Notice>
      </div>
    </section>
  );
}

function ScenarioCard({
  title,
  subtitle,
  tone,
  total,
  rate,
  lines,
}: {
  title: string;
  subtitle: string;
  tone: "current" | "reform";
  total: number;
  rate: number;
  lines?: { label: string; value: number }[] | undefined;
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
      {lines?.length ? (
        <dl className="mt-4 space-y-2 text-sm">
          {lines.map((line) => (
            <div key={line.label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="font-medium tabular-nums">{brl(line.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className={`mt-4 pt-4 ${lines?.length ? "border-t border-border/60" : ""}`}>
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
  clientName,
  onClientNameChange,
  presentationMode,
  onPresentationModeChange,
  readOnly = false,
}: {
  input: SimulationInput;
  year: YearId;
  onYearChange: (y: YearId) => void;
  clientName: string;
  onClientNameChange: (name: string) => void;
  presentationMode: boolean;
  onPresentationModeChange: (active: boolean) => void;
  readOnly?: boolean;
}) {
  const [ratesVersion, setRatesVersion] = useState(0);
  // ratesVersion entra como dependência porque as alíquotas editadas na tabela
  // são constantes de módulo, não parte de `input`.
  const result = useMemo(() => simulate(input, year), [input, year, ratesVersion]);
  const isBusiness =
    input.taxpayerType === "simples" ||
    input.taxpayerType === "presumido" ||
    input.taxpayerType === "real";
  const diff = result.reform.total - result.current.total;
  const rateDiff = result.reform.rate - result.current.rate;
  const worse = diff > 0;
  const unchanged = Math.abs(diff) < 0.005;
  const differenceTone = unchanged
    ? "border-border bg-secondary text-foreground"
    : worse
      ? "border-danger/35 bg-danger-soft text-danger"
      : "border-success/35 bg-success-soft text-success";
  const differenceLabel = unchanged
    ? "Sem alteração estimada"
    : worse
      ? "Aumento estimado"
      : "Economia estimada";
  const percentagePointLabel = `${rateDiff > 0 ? "+" : ""}${(rateDiff * 100).toLocaleString(
    "pt-BR",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )} p.p.`;

  return (
    <div className="space-y-6">
      {!readOnly ? (
        <div className="flex justify-end">
          <Toggle
            checked={presentationMode}
            onChange={onPresentationModeChange}
            label="Modo Apresentação"
          />
        </div>
      ) : null}

      {!presentationMode ? (
        <div className="space-y-6">
          <Field label="Nome do cliente ou empresa (opcional)">
            <TextInput
              type="text"
              value={clientName}
              onChange={(event) => onClientNameChange(event.target.value)}
              placeholder="Ex.: Empresa Exemplo Ltda."
              autoComplete="off"
            />
          </Field>
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
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ScenarioCard
          title={REGIME_LABELS[input.taxpayerType]}
          subtitle="Sistema atual — como você paga hoje"
          tone="current"
          total={result.current.total}
          rate={result.current.rate}
          lines={presentationMode ? undefined : result.current.lines}
        />
        <ScenarioCard
          title={REGIME_LABELS[input.taxpayerType]}
          subtitle={`Cenário ${year} — Reforma Tributária`}
          tone="reform"
          total={result.reform.total}
          rate={result.reform.rate}
          lines={presentationMode ? undefined : result.reform.lines}
        />
      </div>

      <div className={`mx-auto max-w-xl rounded-xl border-2 p-6 text-center ${differenceTone}`}>
        <p className="text-sm font-semibold uppercase tracking-wide">{differenceLabel}</p>
        <p className="mt-2 text-4xl font-bold tabular-nums">{brl(Math.abs(diff))}</p>
        <p className="mt-1 text-sm font-medium">por mês</p>
        <p className="mt-4 border-t border-current/20 pt-4 text-base font-semibold tabular-nums">
          {percentagePointLabel} na carga tributária
        </p>
      </div>

      <ImpactChart input={input} year={year} />

      {isBusiness ? (
        <RegimeComparison input={input} year={year} presentationMode={presentationMode} />
      ) : null}

      {!presentationMode && !readOnly ? (
        <RateMatrix year={year} onRatesChange={() => setRatesVersion((v) => v + 1)} />
      ) : null}

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

      {!presentationMode ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
