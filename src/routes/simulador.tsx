import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { saveSimulation, type JsonValue } from "@/lib/simulations.functions";
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
  inferSimplesAnexo,
  needsBenefitValidation,
  simplesAnexoWarning,
  type SimulationInput,
  type TaxpayerType,
} from "@/lib/tax/calc";

import { ResultView } from "@/components/simulator/ResultView";
import { OfficeContactCta } from "@/components/contact/OfficeContactCta";
import { MemorandoDialog } from "@/components/memorando/MemorandoDialog";
import { HelpButton } from "@/components/help/HelpPanel";
import { lookupCnpj } from "@/lib/cnpj.functions";
import type { CnpjData } from "@/lib/cnpj/types";
import { slugifyWords, truncateWords } from "@/lib/text";
import {
  Button,
  Field,
  MoneyInput,
  NumberInput,
  Notice,
  Select,
  TextInput,
} from "@/components/simulator/ui";

const TITLE = "Simulador de Impacto da Reforma Tributária (IBS/CBS)";
const DESCRIPTION =
  "Estime em minutos como a Reforma Tributária muda a carga da sua empresa ou do seu salário em 2026, 2027 e 2033. Ferramenta gratuita e estimativa.";

export const Route = createFileRoute("/simulador")({
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [creditFromDiagnostic, setCreditFromDiagnostic] = useState(false);
  const [pgdasdOrigin, setPgdasdOrigin] = useState<{
    competencia: string | null;
    anexo: string;
    rbt12: number | null;
  } | null>(null);
  const [pdfError, setPdfError] = useState("");

  const searchCnpjFn = useServerFn(lookupCnpj);
  const [cnpj, setCnpj] = useState("");
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const [manualName, setManualName] = useState(false);
  const [activitySuggested, setActivitySuggested] = useState(false);
  const [anexoSuggested, setAnexoSuggested] = useState(false);
  // O tipo de contribuinte nunca nasce pré-selecionado: exige escolha ativa.
  const [taxpayerChosen, setTaxpayerChosen] = useState(false);

  const [memoOpen, setMemoOpen] = useState(false);

  const searchCnpj = async () => {
    setCnpjBusy(true);
    setCnpjError("");
    try {
      const res = await searchCnpjFn({ data: { cnpj } });
      if (!res.ok) {
        setCnpjData(null);
        setCnpjError(`${res.error} Você pode preencher o nome manualmente.`);
        setManualName(true);
        setActivitySuggested(false);
        setInput((prev) => ({ ...prev, activityId: defaultInput().activityId }));
        return;
      }
      setCnpjData(res.data);
      setCnpj(res.data.cnpj);
      setClientName(truncateWords(res.data.nome_fantasia || res.data.razao_social, 150));
      // Nova empresa = novos números: zera todos os campos financeiros para o padrão.
      setInput((prev) => ({
        ...defaultInput(),
        taxpayerType: prev.taxpayerType,
        activityId: res.data.atividade_sugerida,
        simplesAnexo: inferSimplesAnexo(
          res.data.atividade_sugerida,
        ) as SimulationInput["simplesAnexo"],
        ...(res.data.uf && UFS.includes(res.data.uf) ? { uf: res.data.uf } : {}),
      }));
      setActivitySuggested(true);
      setAnexoSuggested(true);

    } catch {
      setCnpjData(null);
      setCnpjError("Não foi possível consultar o CNPJ agora. Preencha o nome manualmente.");
      setManualName(true);
    } finally {
      setCnpjBusy(false);
    }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    setPdfError("");
    try {
      const response = await fetch("/api/public/relatorio-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          year,
          clientName: clientName.trim() || null,
          cnpj: cnpjData?.cnpj ?? null,
          cnpjData,
        }),
      });
      if (!response.ok) throw new Error("falha");
      const blob = await response.blob();
      const slug = clientName.trim()
        ? slugifyWords(clientName, 60)
        : new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-reforma-tributaria-${slug || "simulacao"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError("Não foi possível gerar o PDF agora. Tente novamente em alguns instantes.");
    } finally {
      setPdfBusy(false);
    }
  };
  const savedIdRef = useRef<string | null>(null);

  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    try {
      const restore = localStorage.getItem(RESTORE_KEY);
      if (restore) {
        localStorage.removeItem(RESTORE_KEY);
        const parsed = JSON.parse(restore) as {
          id?: string;
          input?: Partial<SimulationInput>;
          year?: YearId;
          clientName?: string;
          cnpjData?: CnpjData | null;
          suggestedSimplesSupplierShare?: number;
          pgdasdOrigin?: { competencia: string | null; anexo: string; rbt12: number | null };
        };
        const suggestion = parsed.suggestedSimplesSupplierShare;
        if (parsed.pgdasdOrigin) setPgdasdOrigin(parsed.pgdasdOrigin);
        setInput({
          ...defaultInput(),
          ...(parsed.input ?? {}),
          ...(typeof suggestion === "number" ? { simplesSupplierShare: suggestion } : {}),
        });
        if (parsed.year) setYear(parsed.year);
        setClientName(parsed.clientName ?? "");
        if (parsed.cnpjData) {
          setCnpjData(parsed.cnpjData);
          setCnpj(parsed.cnpjData.cnpj);
        }
        savedIdRef.current = parsed.id ?? null;
        setTaxpayerChosen(true);
        if (typeof suggestion === "number") {
          setCreditFromDiagnostic(true);
          setOptionalOpen(true);
          setStep(4);
        } else if (parsed.pgdasdOrigin) {
          setStep(2);
        } else {
          setStep(5);
        }
        return;
      }
      // Nada é restaurado automaticamente: dados financeiros de uma empresa
      // nunca podem vazar para a simulação da empresa seguinte.
      localStorage.removeItem(STORAGE_KEY);
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
          input: { ...input } as unknown as JsonValue,
          cnpj: cnpjData?.cnpj ?? null,
          cnpjData: cnpjData ? ({ ...cnpjData } as unknown as JsonValue) : null,
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
  }, [step, input, year, clientName, cnpjData, persist]);



  const set = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const showBenefitStep = useMemo(() => needsBenefitValidation(input), [input]);
  const anexoMismatch = useMemo(
    () =>
      input.taxpayerType === "simples"
        ? simplesAnexoWarning(input.activityId, input.simplesAnexo)
        : null,
    [input.taxpayerType, input.activityId, input.simplesAnexo],
  );

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
      ? Boolean(taxpayerChosen && input.taxpayerType && input.activityId && input.uf)
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
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
              Ferramenta gratuita · Direito Tributário
            </p>
            <HelpButton variant="simulator" />
          </div>
          <h1 className="mt-3 text-3xl leading-tight sm:text-5xl">
            Simulador de Impacto da Reforma Tributária
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-foreground/80 sm:text-base">
            Em 5 etapas, compare a carga tributária que você paga hoje com a projeção sob o novo
            sistema de IBS e CBS. É uma estimativa — não substitui um diagnóstico fiscal completo.
          </p>
        </div>
      </header> : null}

      <div
        className={
          step === 5 && presentationMode
            ? "presentation-shell mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8"
            : "mx-auto max-w-4xl px-5 py-8 sm:py-10"
        }
      >
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

        <section
          className={
            step === 5 && presentationMode
              ? "presentation-sheet overflow-hidden rounded-lg border border-border bg-card"
              : "rounded-xl border border-border bg-card p-5 sm:p-7"
          }
        >
          {step === 1 && (
            <div className="space-y-5">
              {manualName ? (
                <Field label="Nome do cliente/empresa (opcional)">
                  <TextInput
                    value={clientName}
                    maxLength={150}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Ex.: Padaria Bom Pão Ltda"
                  />
                </Field>
              ) : (
                <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
                  <Field
                    label="CNPJ do cliente (opcional)"
                    hint="Usamos dados públicos da Receita Federal para preencher a simulação."
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TextInput
                        value={cnpj}
                        onChange={(event) => setCnpj(event.target.value)}
                        placeholder="00.000.000/0001-00"
                        inputMode="numeric"
                        className="min-w-48 flex-1"
                      />
                      <Button onClick={() => void searchCnpj()} disabled={cnpjBusy}>
                        {cnpjBusy ? "Buscando..." : "Buscar dados"}
                      </Button>
                    </div>
                  </Field>
                  <button
                    type="button"
                    onClick={() => {
                      setManualName(true);
                      setCnpjData(null);
                      setCnpjError("");
                      setActivitySuggested(false);
                      setInput((prev) => ({ ...prev, activityId: defaultInput().activityId }));
                    }}
                    className="text-sm font-semibold text-navy underline"
                  >
                    Pular e preencher manualmente
                  </button>

                  {cnpjError ? <Notice tone="warning">{cnpjError}</Notice> : null}

                  {cnpjData ? (
                    <div className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
                      <p className="font-semibold text-foreground">{cnpjData.razao_social}</p>
                      <p className="text-muted-foreground">{cnpjData.endereco}</p>
                      <p
                        className={
                          cnpjData.situacao_cadastral === "ATIVA"
                            ? "text-muted-foreground"
                            : "font-semibold text-danger"
                        }
                      >
                        Situação cadastral: {cnpjData.situacao_cadastral || "não informada"}
                      </p>
                      <p className="text-muted-foreground">
                        CNAE {cnpjData.cnae_codigo} — {cnpjData.cnae_descricao}
                      </p>
                      {cnpjData.representante_sugerido ? (
                        <p className="text-muted-foreground">
                          Representante sugerido: {cnpjData.representante_sugerido} (confirme antes
                          de usar em documentos)
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {cnpjData ? (
                    <Field label="Nome do cliente/empresa">
                      <TextInput
                        value={clientName}
                        maxLength={150}
                        onChange={(event) => setClientName(event.target.value)}
                      />
                    </Field>
                  ) : null}
                </div>
              )}

              <Field
                label="Tipo de contribuinte"
                hint="A Receita Federal não informa publicamente o regime tributário — confirme com o cliente. Essa escolha muda todo o cálculo."
              >
                <Select
                  value={taxpayerChosen ? input.taxpayerType : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setTaxpayerChosen(false);
                      return;
                    }
                    setTaxpayerChosen(true);
                    set("taxpayerType", value as TaxpayerType);
                  }}
                >
                  <option value="" disabled>
                    Selecione o regime tributário desta empresa
                  </option>
                  {TAXPAYERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Atividade principal"
                {...(activitySuggested
                  ? { hint: "Sugerido a partir do CNAE — confirme ou ajuste." }
                  : {})}
              >
                <Select
                  value={input.activityId}
                  onChange={(e) => {
                    const activityId = e.target.value;
                    setAnexoSuggested(true);
                    setInput((prev) => ({
                      ...prev,
                      activityId,
                      simplesAnexo: inferSimplesAnexo(
                        activityId,
                      ) as SimulationInput["simplesAnexo"],
                    }));
                  }}
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

              {input.taxpayerType === "simples" && pgdasdOrigin && (
                <div className="rounded-md border border-navy/30 bg-navy/5 px-3 py-2 text-xs text-navy">
                  ✓ Faturamento, Anexo{pgdasdOrigin.rbt12 ? ", RBT12" : ""} e folha preenchidos a
                  partir do PGDAS-D
                  {pgdasdOrigin.competencia ? ` da competência ${pgdasdOrigin.competencia}` : ""}.
                  Todos os campos continuam editáveis.
                  {pgdasdOrigin.rbt12
                    ? " A faixa do Simples passa a usar o RBT12 real, no lugar de faturamento mensal × 12."
                    : ""}
                </div>
              )}

              {input.taxpayerType === "simples" && (
                <>
                  <Field
                    label="Faturamento bruto mensal"
                    hint="É a base de todo o cálculo: define a faixa do Simples e o valor de IBS/CBS. Sem esse dado não há estimativa."
                  >
                    <MoneyInput
                      value={input.revenue}
                      onChange={(v) => {
                        set("revenue", v);
                      }}
                    />
                  </Field>
                  <Field
                    label="Anexo do Simples Nacional"
                    hint={
                      anexoSuggested
                        ? "Sugerido a partir da atividade — confirme ou ajuste. O Anexo define a tabela de alíquotas e se a CPP patronal está ou não dentro do DAS."
                        : "O Anexo define a tabela de alíquotas e se a CPP patronal está ou não dentro do DAS. Um Anexo errado muda bastante a carga estimada."
                    }
                  >
                    <Select
                      value={input.simplesAnexo}
                      onChange={(e) => {
                        setAnexoSuggested(false);
                        set("simplesAnexo", e.target.value as SimulationInput["simplesAnexo"]);
                      }}
                    >
                      <option value="I">Anexo I — Comércio</option>
                      <option value="II">Anexo II — Indústria</option>
                      <option value="III">Anexo III — Serviços</option>
                      <option value="IV">Anexo IV — Serviços (sem CPP no DAS)</option>
                      <option value="V">Anexo V — Serviços</option>
                    </Select>
                  </Field>
                  {anexoMismatch && (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                      {anexoMismatch}
                    </p>
                  )}
                  {input.simplesAnexo === "IV" && (
                    <Field
                      label="Folha de pagamento mensal"
                      hint="No Anexo IV a contribuição previdenciária patronal (20% sobre a folha) fica fora do DAS e é paga em GPS. Informe a folha para estimar esse custo."
                    >
                      <MoneyInput
                        value={input.payroll}
                        onChange={(v) => set("payroll", v)}
                      />
                    </Field>
                  )}
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
                      hint="Percentual do faturamento que sobra como lucro antes de IRPJ/CSLL. É o que define IRPJ e CSLL no Lucro Real — deixada no padrão de 20%, o resultado pode ficar longe da realidade."
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
                  {creditFromDiagnostic && !(isCompany && input.purchases > 0) && (
                    <Notice>
                      O Diagnóstico Completo sugeriu{" "}
                      <strong>{input.simplesSupplierShare}%</strong> de compras vindas de
                      fornecedores do Simples. Informe as compras e insumos do mês para esse
                      percentual entrar na estimativa de crédito.
                    </Notice>
                  )}
                  <Field
                    label="% da receita vinda de produtos monofásicos"
                    hint="Produtos com PIS/COFINS já recolhido na cadeia: essa fatia sai da base tributável da estimativa. Em branco, consideramos que toda a receita é tributada normalmente."
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
                      hint="Usado para estimar créditos de IBS/CBS: quanto maior a compra de fornecedores tributados, menor o imposto a pagar depois da reforma."
                    >
                      <MoneyInput value={input.purchases} onChange={(v) => set("purchases", v)} />
                    </Field>
                  )}
                  {isCompany && !(input.purchases > 0) && (
                    <Notice tone="warning">
                      Sem informar as compras e insumos do mês, não conseguimos estimar os créditos
                      de IBS/CBS sobre essas compras — a carga projetada depois da reforma tende a
                      ficar superestimada. Você pode seguir assim mesmo.
                    </Notice>
                  )}
                  {isCompany && input.purchases > 0 && (
                    <Field
                      label="Dessas compras, quantos % vieram de fornecedores optantes pelo Simples Nacional?"
                      hint="Nesta estimativa, essa fatia não gera crédito integral de IBS/CBS."
                    >
                      <NumberInput
                        value={input.simplesSupplierShare}
                        onChange={(v) => {
                          setCreditFromDiagnostic(false);
                          set("simplesSupplierShare", v);
                        }}
                        suffix="%"
                        max={100}
                      />
                      {creditFromDiagnostic ? (
                        <p className="mt-2 rounded-md border border-navy/30 bg-navy/5 px-3 py-2 text-xs text-navy">
                          ✓ Calculado a partir do Diagnóstico Completo — CNPJs de fornecedores em
                          regime regular. Você pode alterar este valor antes de seguir.
                        </p>
                      ) : null}
                    </Field>
                  )}
                  {isCompany && (
                    <Field
                      label="Aproximadamente que % da sua receita vem de clientes PJ (empresas) que aproveitam o crédito de IBS/CBS que você recolhe?"
                      hint="Não altera nenhum valor do cálculo — serve para avaliar competitividade entre regimes. Em branco, apenas deixamos de exibir esse alerta."
                    >
                      <NumberInput
                        value={input.pjClientShare}
                        onChange={(v) => set("pjClientShare", v)}
                        suffix="%"
                        max={100}
                      />
                    </Field>
                  )}
                  {isCompany && input.taxpayerType !== "real" && (
                    <Field
                      label="Margem de lucro estimada (%)"
                      hint="Lucro líquido ÷ faturamento. Usada apenas no cenário de Lucro Real da seção “Comparação entre regimes” — mantida no padrão de 20%, esse comparativo pode ficar bem distante da realidade da empresa."
                    >
                      <NumberInput
                        value={input.profitMargin}
                        onChange={(v) => set("profitMargin", v)}
                        suffix="%"
                        max={100}
                      />
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
              cnpjData={cnpjData}
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
                  setTaxpayerChosen(false);
                  setCnpj("");
                  setCnpjData(null);
                  setCnpjError("");
                  setManualName(false);
                  setActivitySuggested(false);
                  setStep(1);
                }}
              >
                Refazer simulação
              </Button>
            )}
          </div> : null}
        </section>

        {step === 5 && (
          <section
            className={
              presentationMode
                ? "mt-0 border-x border-b border-border bg-navy px-6 py-8 text-navy-foreground sm:px-10 lg:px-12"
                : "mt-6 rounded-xl border border-navy/25 bg-navy p-6 text-navy-foreground sm:p-8"
            }
          >
            <h2 className="text-2xl">Próximo passo</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-foreground/80">
              Esse é o retrato estimado do impacto da reforma no seu negócio. O próximo passo é o
              diagnóstico completo — com base em documentos fiscais reais — que começa com a
              assinatura de um Memorando de Entendimento e Confidencialidade. Clique em "Gerar
              Memorando" para começar.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">

              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={pdfBusy}
                className="inline-flex items-center justify-center rounded-md border border-navy-foreground/40 px-6 py-3 text-sm font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pdfBusy ? "Gerando PDF..." : "Baixar PDF"}
              </button>
              <button
                type="button"
                onClick={() => setMemoOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-navy-foreground/40 px-6 py-3 text-sm font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10"
              >
                Gerar Memorando
              </button>
            </div>
            {pdfError ? (
              <p className="mt-3 text-xs font-medium text-navy-foreground/80">{pdfError}</p>
            ) : null}
          </section>
        )}

        {step === 5 && !presentationMode && (
          <div className="mt-6">
            <OfficeContactCta />
          </div>
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

      {memoOpen ? (
        <MemorandoDialog
          cnpjData={cnpjData}
          clientName={clientName}
          onClose={() => setMemoOpen(false)}
        />
      ) : null}
    </main>
  );
}
