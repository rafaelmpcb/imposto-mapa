import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { saveSimulation } from "@/lib/simulations.functions";
import { RESTORE_KEY } from "@/lib/tax/session";
import { simulate } from "@/lib/tax/calc";

import {
  ACTIVITIES,
  LEGAL_REFERENCE_DATE,
  UFS,
  UF_NAMES,
  type YearId,
} from "@/lib/tax/constants";
import {
  defaultInput,
  needsBenefitValidation,
  type SimulationInput,
  type TaxpayerType,
} from "@/lib/tax/calc";
import { ResultView } from "@/components/simulator/ResultView";
import { Button, Field, MoneyInput, NumberInput, Notice, Select } from "@/components/simulator/ui";

const TITLE = "Simulador de Impacto da Reforma Tributária (IBS/CBS)";
const DESCRIPTION =
  "Estime em minutos como a Reforma Tributária muda a carga da sua empresa ou do seu salário em 2026, 2027 e 2033. Ferramenta gratuita e estimativa.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Simulador da Reforma Tributária IBS/CBS | Estimativa gratuita" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Simulator,
});

const STORAGE_KEY = "reforma-simulador-v1";
// TODO: substituir pelo link real do diagnóstico completo quando ele for definido.
const DIAGNOSIS_URL = "";

const TAXPAYERS: { id: TaxpayerType; label: string }[] = [
  { id: "pf", label: "Pessoa Física (CLT)" },
  { id: "simples", label: "Empresa — Simples Nacional" },
  { id: "presumido", label: "Empresa — Lucro Presumido" },
  { id: "real", label: "Empresa — Lucro Real" },
  { id: "mei", label: "MEI" },
];

function Simulator() {
  const [input, setInput] = useState<SimulationInput>(defaultInput);
  const [step, setStep] = useState(1);
  const [year, setYear] = useState<YearId>(2027);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [presentationMode, setPresentationMode] = useState(false);
  const persist = useServerFn(saveSimulation);
  const savedIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const restore = localStorage.getItem(RESTORE_KEY);
      if (restore) {
        localStorage.removeItem(RESTORE_KEY);
        const parsed = JSON.parse(restore) as {
          id?: string;
          input?: Partial<SimulationInput>;
          year?: YearId;
          clientName?: string;
        };
        setInput({ ...defaultInput(), ...(parsed.input ?? {}) });
        if (parsed.year) setYear(parsed.year);
        setClientName(parsed.clientName ?? "");
        savedIdRef.current = parsed.id ?? null;
        setStep(5);
        return;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInput({ ...defaultInput(), ...JSON.parse(saved) });
    } catch {
      /* ignora dados inválidos */
    }
  }, []);

  // Persiste cada cálculo visualizado na Etapa 5 (atualiza o mesmo registro
  // quando o nome do cliente ou o ano de referência mudam).
  useEffect(() => {
    if (step !== 5) return;
    const result = simulate(input, year);
    const timer = setTimeout(() => {
      void persist({
        data: {
          id: savedIdRef.current ?? undefined,
          clientName,
          taxpayerType: input.taxpayerType,
          activityId: input.activityId,
          uf: input.uf,
          baseAmount: result.base,
          yearId: year,
          currentTotal: result.current.total,
          reformTotal: result.reform.total,
          currentRate: result.current.rate,
          reformRate: result.reform.rate,
          input: { ...input } as unknown as Record<string, unknown>,
        },
      })
        .then((res) => {
          savedIdRef.current = res.id;
        })
        .catch(() => {
          /* histórico indisponível não bloqueia a simulação */
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [step, input, year, clientName, persist]);


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* armazenamento indisponível */
    }
  }, [input]);

  const set = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const showBenefitStep = useMemo(() => needsBenefitValidation(input), [input]);
  const steps = useMemo(
    () => [1, 2, ...(showBenefitStep ? [3] : []), 4, 5],
    [showBenefitStep],
  );
  const currentIndex = Math.max(0, steps.indexOf(step));
  const progress = ((currentIndex + 1) / steps.length) * 100;

  const go = (delta: number) => {
    const next = steps[Math.min(steps.length - 1, Math.max(0, currentIndex + delta))] ?? 1;
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepTitles: Record<number, string> = {
    1: "Perfil tributário",
    2: "Dados financeiros",
    3: "Validação do benefício fiscal",
    4: "Ajustes opcionais",
    5: "Resultado da simulação",
  };

  const isCompany = input.taxpayerType !== "pf";
  const canAdvance =
    step === 1
      ? Boolean(input.taxpayerType && input.activityId && input.uf)
      : step === 2
        ? input.taxpayerType === "pf"
          ? input.salary > 0
          : input.revenue > 0
        : step === 3
          ? input.benefitConfirmed !== null
          : true;

  return (
    <main className="min-h-screen bg-background">
      {!(step === 5 && presentationMode) ? <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
            Ferramenta gratuita · Direito Tributário
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-5xl">
            Simulador de Impacto da Reforma Tributária
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-foreground/80 sm:text-base">
            Em 5 etapas, compare a carga tributária que você paga hoje com a projeção sob o novo
            sistema de IBS e CBS. É uma estimativa — não substitui um diagnóstico fiscal completo.
          </p>
        </div>
      </header> : null}

      <div className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
        {!(step === 5 && presentationMode) ? <div className="mb-8">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-foreground">{stepTitles[step]}</span>
            <span className="text-muted-foreground">
              Etapa {currentIndex + 1} de {steps.length}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-navy transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div> : null}

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          {step === 1 && (
            <div className="space-y-5">
              <Field label="Tipo de contribuinte">
                <Select
                  value={input.taxpayerType}
                  onChange={(e) => set("taxpayerType", e.target.value as TaxpayerType)}
                >
                  {TAXPAYERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Atividade principal">
                <Select
                  value={input.activityId}
                  onChange={(e) => set("activityId", e.target.value)}
                >
                  {ACTIVITIES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estado (UF)">
                <Select value={input.uf} onChange={(e) => set("uf", e.target.value)}>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf} — {UF_NAMES[uf]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {input.taxpayerType === "pf" && (
                <>
                  <Field label="Salário bruto mensal">
                    <MoneyInput value={input.salary} onChange={(v) => set("salary", v)} />
                  </Field>
                  <Field label="Número de dependentes">
                    <NumberInput
                      value={input.dependents}
                      onChange={(v) => set("dependents", v)}
                    />
                  </Field>
                </>
              )}

              {input.taxpayerType === "simples" && (
                <>
                  <Field label="Faturamento bruto mensal">
                    <MoneyInput value={input.revenue} onChange={(v) => set("revenue", v)} />
                  </Field>
                  <Field label="Anexo do Simples Nacional">
                    <Select
                      value={input.simplesAnexo}
                      onChange={(e) =>
                        set("simplesAnexo", e.target.value as SimulationInput["simplesAnexo"])
                      }
                    >
                      <option value="I">Anexo I — Comércio</option>
                      <option value="II">Anexo II — Indústria</option>
                      <option value="III">Anexo III — Serviços</option>
                      <option value="IV">Anexo IV — Serviços (sem CPP no DAS)</option>
                      <option value="V">Anexo V — Serviços</option>
                    </Select>
                  </Field>
                </>
              )}

              {(input.taxpayerType === "presumido" || input.taxpayerType === "real") && (
                <>
                  <Field label="Faturamento bruto mensal">
                    <MoneyInput value={input.revenue} onChange={(v) => set("revenue", v)} />
                  </Field>
                  <Field label="Folha de pagamento mensal">
                    <MoneyInput value={input.payroll} onChange={(v) => set("payroll", v)} />
                  </Field>
                  {input.taxpayerType === "real" && (
                    <Field
                      label="Margem de lucro estimada"
                      hint="Percentual do faturamento que sobra como lucro antes de IRPJ/CSLL."
                    >
                      <NumberInput
                        value={input.profitMargin}
                        onChange={(v) => set("profitMargin", v)}
                        suffix="%"
                        max={100}
                      />
                    </Field>
                  )}
                </>
              )}

              {input.taxpayerType === "mei" && (
                <>
                  <Field label="Faturamento bruto mensal">
                    <MoneyInput value={input.revenue} onChange={(v) => set("revenue", v)} />
                  </Field>
                  <Field label="Tipo de atuação">
                    <Select
                      value={input.meiType}
                      onChange={(e) =>
                        set("meiType", e.target.value as SimulationInput["meiType"])
                      }
                    >
                      <option value="comercio">Comércio</option>
                      <option value="servicos">Serviços</option>
                      <option value="ambos">Comércio e Serviços</option>
                    </Select>
                  </Field>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Identificamos que sua atividade pode ter direito a uma redução de alíquota. Para
                confirmar, responda:
              </p>
              <p className="text-base font-medium">
                Todos os sócios da empresa possuem registro no conselho profissional da atividade e
                nenhum sócio é pessoa jurídica?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: true, label: "Sim" },
                  { value: false, label: "Não" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => set("benefitConfirmed", opt.value)}
                    className={`rounded-md border px-4 py-3 text-sm font-semibold transition-colors ${
                      input.benefitConfirmed === opt.value
                        ? "border-navy bg-navy text-navy-foreground"
                        : "border-input bg-card hover:bg-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {input.benefitConfirmed === false && (
                <Notice tone="warning">
                  Sem o requisito atendido, a redução de alíquota não é aplicada na estimativa — e
                  isso será sinalizado no resultado.
                </Notice>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setOptionalOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-md border border-input bg-secondary px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold">Ajustes opcionais</span>
                <span className="text-sm text-muted-foreground">
                  {optionalOpen ? "Fechar" : "Abrir"}
                </span>
              </button>
              <p className="text-xs text-muted-foreground">
                Isso é opcional — sem preencher, ainda calculamos uma estimativa.
              </p>
              {optionalOpen && (
                <div className="space-y-5 pt-2">
                  <Field
                    label="% da receita vinda de produtos monofásicos"
                    hint="Produtos com PIS/COFINS já recolhido na cadeia."
                  >
                    <NumberInput
                      value={input.monofasicoShare}
                      onChange={(v) => set("monofasicoShare", v)}
                      suffix="%"
                      max={100}
                    />
                  </Field>
                  {isCompany && (
                    <Field
                      label="Compras e insumos do mês"
                      hint="Usado para estimar créditos de IBS/CBS."
                    >
                      <MoneyInput value={input.purchases} onChange={(v) => set("purchases", v)} />
                    </Field>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <ResultView
              input={input}
              year={year}
              onYearChange={setYear}
              clientName={clientName}
              onClientNameChange={setClientName}
              presentationMode={presentationMode}
              onPresentationModeChange={setPresentationMode}
            />
          )}

          {!(step === 5 && presentationMode) ? <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => go(-1)} disabled={currentIndex === 0}>
              Voltar
            </Button>
            {step !== 5 ? (
              <Button onClick={() => go(1)} disabled={!canAdvance}>
                {steps[currentIndex + 1] === 5 ? "Ver resultado" : "Continuar"}
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  savedIdRef.current = null;
                  setClientName("");
                  setInput(defaultInput());
                  setStep(1);
                }}
              >
                Refazer simulação
              </Button>
            )}
          </div> : null}
        </section>

        {step === 5 && (
          <section className="mt-6 rounded-xl border border-navy/25 bg-navy p-6 text-navy-foreground sm:p-8">
            <h2 className="text-2xl">Próximo passo</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-foreground/80">
              Esse é o retrato estimado do impacto da reforma no seu negócio. O próximo passo é o
              diagnóstico completo — com base em documentos fiscais reais — que começa com a
              assinatura de um Memorando de Entendimento e Confidencialidade.
            </p>
            <a
              href={DIAGNOSIS_URL || "#"}
              onClick={(event) => {
                if (!DIAGNOSIS_URL) event.preventDefault();
              }}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Avançar para o diagnóstico completo
            </a>
          </section>
        )}

        {!(step === 5 && presentationMode) ? <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          Conteúdo informativo. Estimativas baseadas na LC 214/2025 e no cronograma de transição
          vigente em {LEGAL_REFERENCE_DATE}. Alíquota de referência de 26,5% sujeita a alteração
          pelo Senado Federal.
          <span className="mt-3 block">
            <Link to="/meus-calculos" className="font-semibold underline">
              Meus Cálculos (acesso do escritório)
            </Link>
          </span>
        </footer> : null}
      </div>
    </main>
  );
}
