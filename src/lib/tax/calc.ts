import {
  ACTIVITIES,
  ANEXOS_CPP_FORA_DAS,
  TYPICAL_SIMPLES_ANEXO,
  CBS_SHARE,

  CBS_TEST_RATE,
  COFINS_CUMULATIVO,
  COFINS_NAO_CUMULATIVO,
  CPP_RATE,
  CSLL_RATE,
  DEPENDENT_DEDUCTION,
  IBS_SHARE,
  IBS_TEST_RATE,
  ICMS_BY_UF,
  INSS_TABLE,
  IRPF_NEW_FULL_EXEMPTION,
  IRPF_NEW_PARTIAL_LIMIT,
  IRPF_TABLE,
  IRPJ_ADICIONAL_LIMIT_MONTHLY,
  IRPJ_ADICIONAL_RATE,
  IRPJ_RATE,
  ISS_RATE,
  MEI_DAS,
  PIS_CUMULATIVO,
  PIS_NAO_CUMULATIVO,
  PRESUMIDO_CSLL_BASE,
  PRESUMIDO_IRPJ_BASE,
  REFERENCE_RATE,
  SIMPLES_TABLES,
  SIMPLIFIED_DISCOUNT,
  getActivity,
  type YearId,
} from "./constants";

export type TaxpayerType = "pf" | "simples" | "presumido" | "real" | "mei";

export interface SimulationInput {
  taxpayerType: TaxpayerType;
  activityId: string;
  uf: string;
  // PF
  salary: number;
  dependents: number;
  // Empresas
  revenue: number;
  payroll: number;
  profitMargin: number; // %
  simplesAnexo: keyof typeof SIMPLES_TABLES;
  /** RBT12 real (PGDAS-D). Quando ausente, usa faturamento mensal x 12. */
  rbt12?: number;
  meiType: keyof typeof MEI_DAS;
  // Etapa 3
  benefitConfirmed: boolean | null;
  // Etapa 4
  monofasicoShare: number; // %
  purchases: number;
  /** % das compras vindas de fornecedores optantes pelo Simples Nacional. */
  simplesSupplierShare: number; // %
  /** % da receita vinda de clientes PJ que aproveitam crédito (não entra no cálculo). */
  pjClientShare: number; // %
}

export interface TaxLine {
  label: string;
  value: number;
}

export interface Scenario {
  lines: TaxLine[];
  total: number;
  /** Carga sobre a base (faturamento ou salário bruto). */
  rate: number;
}

export interface SimulationResult {
  base: number;
  current: Scenario;
  reform: Scenario;
  effectiveNewRate: number;
  benefitApplied: boolean;
  benefitLost: boolean;
  notes: string[];
}

export const defaultInput = (): SimulationInput => ({
  taxpayerType: "presumido",
  activityId: ACTIVITIES[0]!.id,
  uf: "SP",
  salary: 0,
  dependents: 0,
  revenue: 0,
  payroll: 0,
  profitMargin: DEFAULT_PROFIT_MARGIN,
  simplesAnexo: "III",
  meiType: "servicos",
  benefitConfirmed: null,
  monofasicoShare: 0,
  purchases: 0,
  simplesSupplierShare: 0,
  pjClientShare: 0,
});

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** A atividade exige validação de sócios (Etapa 3)? */
export function needsBenefitValidation(input: SimulationInput): boolean {
  const activity = getActivity(input.activityId);
  return (
    activity.reduction > 0 &&
    activity.regulated &&
    input.taxpayerType !== "pf" &&
    input.taxpayerType !== "mei"
  );
}

export function hasBenefit(input: SimulationInput): boolean {
  return getActivity(input.activityId).reduction > 0;
}

/** Alíquota efetiva de IBS+CBS considerando o benefício da atividade. */
export function effectiveRate(input: SimulationInput): {
  rate: number;
  applied: boolean;
  lost: boolean;
} {
  const activity = getActivity(input.activityId);
  const lost =
    activity.reduction > 0 &&
    needsBenefitValidation(input) &&
    input.benefitConfirmed === false;
  const applied = activity.reduction > 0 && !lost;
  return {
    rate: REFERENCE_RATE * (1 - (applied ? activity.reduction : 0)),
    applied,
    lost,
  };
}

function inss(salary: number): number {
  let remaining = salary;
  let previous = 0;
  let total = 0;
  for (const band of INSS_TABLE) {
    const slice = Math.max(0, Math.min(salary, band.limit) - previous);
    total += slice * band.rate;
    previous = band.limit;
    remaining -= slice;
    if (remaining <= 0) break;
  }
  return total;
}

function irpfFromBase(base: number): number {
  const band = IRPF_TABLE.find((b) => base <= b.limit) ?? IRPF_TABLE[IRPF_TABLE.length - 1]!;
  return Math.max(0, base * band.rate - band.deduct);
}

function irpfCurrent(salary: number, dependents: number): { inss: number; irpf: number } {
  const inssValue = inss(salary);
  const legalBase = Math.max(0, salary - inssValue - dependents * DEPENDENT_DEDUCTION);
  const simplifiedBase = Math.max(0, salary - SIMPLIFIED_DISCOUNT);
  const tax = Math.min(irpfFromBase(legalBase), irpfFromBase(simplifiedBase));
  return { inss: inssValue, irpf: tax };
}

/** Nova regra: isenção até R$5.000 e redução gradual até R$7.350. */
function irpfNew(salary: number, dependents: number): number {
  const full = irpfCurrent(salary, dependents).irpf;
  if (salary <= IRPF_NEW_FULL_EXEMPTION) return 0;
  if (salary >= IRPF_NEW_PARTIAL_LIMIT) return full;
  const progress =
    (salary - IRPF_NEW_FULL_EXEMPTION) /
    (IRPF_NEW_PARTIAL_LIMIT - IRPF_NEW_FULL_EXEMPTION);
  return full * progress; // interpolação linear (aproximação)
}

function simplesEffectiveRate(
  anexo: keyof typeof SIMPLES_TABLES,
  revenue: number,
  rbt12Real?: number,
): number {
  const rbt12 = Math.max(rbt12Real && rbt12Real > 0 ? rbt12Real : revenue * 12, 1);
  const table = SIMPLES_TABLES[anexo] ?? SIMPLES_TABLES['III']!;
  const bracket = table.find((b) => rbt12 <= b.rbt12) ?? table[table.length - 1]!;
  return Math.max(0, (rbt12 * bracket.rate - bracket.deduct) / rbt12);
}

function irpjCsll(
  input: SimulationInput,
  profitBaseIRPJ: number,
  profitBaseCSLL: number,
): TaxLine[] {
  const irpj =
    profitBaseIRPJ * IRPJ_RATE +
    Math.max(0, profitBaseIRPJ - IRPJ_ADICIONAL_LIMIT_MONTHLY) * IRPJ_ADICIONAL_RATE;
  const csll = profitBaseCSLL * CSLL_RATE;
  return [
    { label: "IRPJ (+ adicional)", value: irpj },
    { label: "CSLL", value: csll },
    { label: "CPP sobre a folha", value: input.payroll * CPP_RATE },
  ];
}

function scenario(lines: TaxLine[], base: number): Scenario {
  const filtered = lines.filter((l) => l.value > 0.004);
  const total = filtered.reduce((sum, l) => sum + l.value, 0);
  return { lines: filtered, total, rate: base > 0 ? total / base : 0 };
}

/**
 * Peso da transição do novo sistema por ano de referência.
 * 2026: alíquotas de teste (CBS 0,9% compensável + IBS 0,1%).
 * 2027: CBS cheia substitui PIS/COFINS; ICMS/ISS permanecem; IBS em teste.
 * 2033: regime pleno — IBS+CBS substituem PIS/COFINS/ICMS/ISS.
 */
function transition(year: YearId) {
  switch (year) {
    case 2026:
      return { newRateShare: 0, keepPisCofins: true, keepIcmsIss: true, testRate: IBS_TEST_RATE + CBS_TEST_RATE * 0 };
    case 2027:
      return { newRateShare: CBS_SHARE / REFERENCE_RATE, keepPisCofins: false, keepIcmsIss: true, testRate: IBS_TEST_RATE };
    default:
      return { newRateShare: 1, keepPisCofins: false, keepIcmsIss: false, testRate: 0 };
  }
}

export type BusinessRegime = "simples" | "simples_hibrido" | "presumido" | "real";

/**
 * Partilha oficial do DAS por faixa (LC 123/2006, Anexos I–V, redação da LC 155/2016).
 * Percentuais por faixa: [IRPJ, CSLL, COFINS, PIS, CPP].
 * O restante (ICMS / IPI / ISS) é a parcela subnacional ou IPI.
 */
const PARTILHA_OFICIAL: Record<string, [number, number, number, number, number][]> = {
  I: [
    [5.5, 3.5, 12.74, 2.76, 41.5], [5.5, 3.5, 12.74, 2.76, 41.5], [5.5, 3.5, 12.74, 2.76, 42],
    [5.5, 3.5, 12.74, 2.76, 42], [5.5, 3.5, 12.74, 2.76, 42], [13.5, 10, 28.27, 6.13, 42.1],
  ],
  II: [
    [5.5, 3.5, 11.51, 2.49, 37.5], [5.5, 3.5, 11.51, 2.49, 37.5], [5.5, 3.5, 11.51, 2.49, 37.5],
    [5.5, 3.5, 11.51, 2.49, 37.5], [5.5, 3.5, 11.51, 2.49, 37.5], [8.5, 7.5, 20.96, 4.54, 23.5],
  ],
  III: [
    [4, 3.5, 12.82, 2.78, 43.4], [4, 3.5, 14.05, 3.05, 43.4], [4, 3.5, 13.64, 2.96, 43.4],
    [4, 3.5, 13.64, 2.96, 43.4], [4, 3.5, 12.82, 2.78, 43.4], [35, 15, 16.03, 3.47, 30.5],
  ],
  IV: [
    [18.8, 15.2, 17.67, 3.83, 0], [19.8, 15.2, 20.55, 4.45, 0], [20.8, 15.2, 19.73, 4.27, 0],
    [17.8, 19.2, 18.9, 4.1, 0], [18.8, 19.2, 18.08, 3.92, 0], [53.5, 21.5, 20.55, 4.45, 0],
  ],
  V: [
    [25, 15, 14.1, 3.05, 28.85], [23, 15, 14.1, 3.05, 27.85], [24, 15, 14.92, 3.23, 23.85],
    [21, 15, 15.74, 3.41, 23.85], [23, 12.5, 14.1, 3.05, 23.85], [35, 15.5, 16.44, 3.56, 29.5],
  ],
};

/** Faixa (1–6) do Simples conforme o RBT12. */
export function simplesFaixa(anexo: string, rbt12: number): number {
  const table = SIMPLES_TABLES[anexo] ?? SIMPLES_TABLES["III"]!;
  const idx = table.findIndex((b) => rbt12 <= b.rbt12);
  return (idx === -1 ? table.length - 1 : idx) + 1;
}

/**
 * Partilha oficial da faixa: federal = IRPJ + CSLL + CPP (fica no DAS no híbrido);
 * pisCofins = parcela de PIS/COFINS (sai do DAS a partir de 2027).
 */
export function simplesPartilha(anexo: string, rbt12: number): { federal: number; pisCofins: number; faixa: number } {
  const faixa = simplesFaixa(anexo, rbt12);
  const row = (PARTILHA_OFICIAL[anexo] ?? PARTILHA_OFICIAL["III"]!)[faixa - 1]!;
  const [irpj, csll, cofins, pis, cpp] = row;
  return { federal: (irpj + csll + cpp) / 100, pisCofins: (cofins + pis) / 100, faixa };
}

export const SIMPLES_LIMITE_ANUAL = 4_800_000;

/** Simples Nacional Híbrido: DAS residual + IBS/CBS apurados por fora (regime regular). */
function simplesHibrido(input: SimulationInput, year: YearId, isCurrent: boolean): RegimeComparisonItem {
  const base = {
    regime: "simples_hibrido" as const,
    label: "Simples Nacional Híbrido",
    isCurrent: false,
    isBest: false,
  };
  const anexo = isCurrent ? input.simplesAnexo : inferSimplesAnexo(input.activityId);
  if (year === 2026) {
    return {
      ...base, total: null, rate: null, lines: [], isAvailable: false,
      estimateNote: "A opção de recolher IBS/CBS por fora do DAS passa a valer a partir de 2027 (LC 214/2025).",
    };
  }
  const rbt12 = input.rbt12 && input.rbt12 > 0 ? input.rbt12 : input.revenue * 12;
  if (rbt12 > SIMPLES_LIMITE_ANUAL) {
    return {
      ...base, total: null, rate: null, lines: [], isAvailable: false,
      estimateNote: "Faturamento acima de R$ 4,8 milhões/ano — fora do limite do Simples Nacional.",
    };
  }
  const activity = getActivity(input.activityId);
  const { rate: newRate } = effectiveRate(input);
  const partilha = simplesPartilha(anexo, rbt12);
  const dasRate = simplesEffectiveRate(anexo, input.revenue, input.rbt12);
  const residualShare = year === 2033 ? partilha.federal : 1 - partilha.pisCofins;
  const dasResidual = input.revenue * dasRate * residualShare;
  const ivaRate =
    year === 2033 ? newRate : newRate * (CBS_SHARE / REFERENCE_RATE) + IBS_TEST_RATE;
  const taxableShare = 1 - Math.min(100, Math.max(0, input.monofasicoShare)) / 100;
  const supplierShare = Math.min(100, Math.max(0, input.simplesSupplierShare || 0));
  const purchases = Math.min(Math.max(0, input.purchases), input.revenue);
  const credits = purchases * (1 - supplierShare / 100) * ivaRate;
  const iva = Math.max(0, input.revenue * taxableShare * ivaRate - credits);
  const cppFora = cppOutsideDas(anexo);
  const lines: TaxLine[] = [
    {
      label: `DAS residual (${year === 2033 ? "IRPJ, CSLL e CPP" : "sem PIS/COFINS"} · ${pct(dasRate * residualShare)})`,
      value: dasResidual,
    },
    { label: `${year === 2033 ? "IBS + CBS" : "CBS + IBS teste"} líquido (${pct(ivaRate)} − créditos)`, value: iva },
  ];
  if (cppFora) lines.push({ label: `CPP patronal via GPS (${pct(CPP_RATE)} da folha)`, value: Math.max(0, input.payroll) * CPP_RATE });
  const total = lines.reduce((a, l) => a + l.value, 0);
  const notes = [
    `Anexo ${anexo}${isCurrent ? "" : " estimado pela atividade"}; ${partilha.faixa}ª faixa; partilha oficial do DAS (LC 123/2006, redação LC 155/2016).`,
    "Clientes PJ aproveitam crédito integral do IBS/CBS destacado.",
  ];
  if (activity.sector === "servico" && year !== 2033) notes.push("ISS segue dentro do DAS até 2032.");
  return {
    ...base,
    total,
    rate: input.revenue > 0 ? total / input.revenue : 0,
    lines,
    isAvailable: true,
    estimateNote: notes.join(" "),
  };
}

export interface RegimeComparisonItem {
  regime: BusinessRegime;
  label: string;
  total: number | null;
  rate: number | null;
  lines: { label: string; value: number }[];
  isCurrent: boolean;
  isBest: boolean;
  isAvailable: boolean;
  estimateNote?: string;
}

export const SIMPLES_REGULAR_EXIT_2033_LABEL =
  "Se sair do Simples — regime regular (2033)";

export const SIMPLES_2033_UNAVAILABLE_NOTE =
  "Para quem permanece optante pelo Simples em 2033, o cálculo continua sendo feito em guia única (DAS), com uma nova tabela de partilha que substitui ICMS/ISS por IBS/CBS. Essa tabela específica para 2033 ainda não está confirmada em nossa base — não exibir um valor estimado até essa fonte ser validada.";

export function isSimplesRegularExitScenario(input: SimulationInput, year: YearId): boolean {
  return input.taxpayerType === "simples" && year === 2033;
}

/** Margem de lucro padrão quando o usuário não informou (Lucro Real estimado). */
export const DEFAULT_PROFIT_MARGIN = 20;

/** Anexo do Simples mais provável a partir da atividade informada. */
export function inferSimplesAnexo(activityId: string): keyof typeof SIMPLES_TABLES {
  const activity = getActivity(activityId);
  const typical = TYPICAL_SIMPLES_ANEXO[activity.id];
  if (typical) return typical;
  if (activity.sector === "comercio") return "I";
  if (activity.sector === "industria") return "II";
  return "III";
}

/** A CPP patronal fica fora do DAS neste anexo? */
export function cppOutsideDas(anexo: string): boolean {
  return ANEXOS_CPP_FORA_DAS.includes(anexo);
}

/** Aviso quando o anexo escolhido diverge do enquadramento típico da atividade. */
export function simplesAnexoWarning(
  activityId: string,
  anexo: string,
): string | null {
  const activity = getActivity(activityId);
  const typical = TYPICAL_SIMPLES_ANEXO[activity.id];
  if (!typical || typical === anexo) return null;
  return `${activity.label} normalmente se enquadra no Anexo ${typical} — confirme se essa empresa realmente está no Anexo ${anexo}.`;
}


function compareSimplesEligible(input: SimulationInput): boolean {
  const rbt12 = input.rbt12 && input.rbt12 > 0 ? input.rbt12 : input.revenue * 12;
  return rbt12 <= SIMPLES_LIMITE_ANUAL;
}

/** Compara a carga pós-reforma nos regimes empresariais (inclui Simples Híbrido). */
export function compareRegimes(
  input: SimulationInput,
  year: YearId,
): RegimeComparisonItem[] {
  const regimes: { id: Exclude<BusinessRegime, "simples_hibrido">; label: string }[] = [
    { id: "simples", label: "Simples Nacional (tradicional)" },
    { id: "presumido", label: "Lucro Presumido" },
    { id: "real", label: "Lucro Real" },
  ];

  const items: RegimeComparisonItem[] = regimes.map(({ id, label }) => {
    const isCurrent = input.taxpayerType === id;
    if (id === "simples" && year === 2033) {
      return {
        regime: id,
        label: "Permanecer no Simples em 2033",
        total: null,
        rate: null,
        lines: [],
        isCurrent,
        isBest: false,
        isAvailable: false,
        estimateNote: SIMPLES_2033_UNAVAILABLE_NOTE,
      } satisfies RegimeComparisonItem;
    }
    let variant: SimulationInput = { ...input, taxpayerType: id };
    let estimateNote: string | undefined;

    if (id === "simples" && !isCurrent) {
      variant = { ...variant, simplesAnexo: inferSimplesAnexo(input.activityId) };
      estimateNote = `Anexo ${variant.simplesAnexo} estimado com base na atividade`;
    }
    if (id === "real" && !isCurrent) {
      const margin =
        Number.isFinite(input.profitMargin) && input.profitMargin > 0
          ? Math.min(100, input.profitMargin)
          : DEFAULT_PROFIT_MARGIN;
      variant = { ...variant, profitMargin: margin };
      estimateNote = `Margem de lucro estimada em ${margin.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })}%`;
    }

    const reform = simulate(variant, year).reform;
    return {
      regime: id,
      label,
      total: reform.total,
      rate: reform.rate,
      lines: reform.lines,
      isCurrent,
      isBest: false,
      isAvailable: true,
      ...(estimateNote ? { estimateNote } : {}),
    } satisfies RegimeComparisonItem;
  });

  if (input.taxpayerType === "simples" || compareSimplesEligible(input)) {
    items.splice(1, 0, simplesHibrido(input, year, input.taxpayerType === "simples"));
  }

  const availableTotals = items.flatMap((item) =>
    item.isAvailable && item.total !== null ? [item.total] : [],
  );
  const min = availableTotals.length ? Math.min(...availableTotals) : null;
  return items.map((item) => ({
    ...item,
    isBest:
      min !== null && item.total !== null && item.isAvailable
        ? Math.abs(item.total - min) < 0.005
        : false,
  }));
}

/** Percentual acima do qual a base de clientes PJ vira um alerta de competitividade. */
export const PJ_CLIENT_ALERT_THRESHOLD = 50;

/**
 * Observação qualitativa sobre clientes PJ que aproveitam crédito.
 * Não entra em nenhuma fórmula de carga tributária.
 */
export function pjClientAdvisory(
  input: SimulationInput,
  items: RegimeComparisonItem[],
): string | null {
  const share = Math.min(100, Math.max(0, input.pjClientShare || 0));
  if (share <= PJ_CLIENT_ALERT_THRESHOLD) return null;
  const simples = items.find((i) => i.regime === "simples");
  if (!simples) return null;
  if (!simples.isAvailable) return null;
  if (!simples.isCurrent && (!simples.isAvailable || !simples.isBest)) return null;
  return "Boa parte da sua receita vem de clientes PJ que provavelmente aproveitam o crédito integral do seu IBS/CBS. Mesmo com carga nominal menor, permanecer no Simples pode ser menos competitivo com esses clientes, que perdem esse crédito. O Simples Nacional Híbrido preserva o crédito integral para esses clientes — vale considerar essa opção na decisão de regime.";
}

export function simulate(input: SimulationInput, year: YearId): SimulationResult {
  const activity = getActivity(input.activityId);
  const { rate: newRate, applied, lost } = effectiveRate(input);
  const t = transition(year);
  const notes: string[] = [];

  const icms = (ICMS_BY_UF[input.uf] ?? 18) / 100;
  const consumptionOldRate = activity.sector === "servico" ? ISS_RATE : icms;
  const consumptionOldLabel =
    activity.sector === "servico" ? "ISS (serviços)" : `ICMS ${input.uf}`;

  const taxableShare = 1 - Math.min(100, Math.max(0, input.monofasicoShare)) / 100;

  if (lost) {
    notes.push(
      "O benefício de redução de alíquota NÃO foi aplicado porque nem todos os sócios possuem registro no conselho profissional ou há sócio pessoa jurídica.",
    );
  }

  /* ---------- Pessoa Física ---------- */
  if (input.taxpayerType === "pf") {
    const base = input.salary;
    const current = irpfCurrent(input.salary, input.dependents);
    const newIrpf = year === 2026 ? current.irpf : irpfNew(input.salary, input.dependents);
    if (year === 2026) {
      notes.push(
        "A nova tabela de isenção do IRPF até R$ 5.000 é considerada a partir de 2027 nesta simulação.",
      );
    }
    if (Math.abs(newIrpf - current.irpf) > 0.004) {
      notes.push(
        "Atenção: a mudança no IRPF vem da Lei 15.270/2025 (isenção até R$5.000), uma lei diferente da Reforma Tributária do consumo (LC 214/2025, IBS/CBS). Salários CLT não são afetados pelo IBS/CBS — INSS e a nova faixa de IRPF são regras à parte.",
      );
    }
    return {
      base,
      current: scenario(
        [
          { label: "INSS", value: current.inss },
          { label: "IRPF", value: current.irpf },
        ],
        base,
      ),
      reform: scenario(
        [
          { label: "INSS (inalterado)", value: current.inss },
          { label: "IRPF (nova regra)", value: newIrpf },
        ],
        base,
      ),
      effectiveNewRate: newRate,
      benefitApplied: false,
      benefitLost: false,
      notes,
    };
  }

  /* ---------- MEI ---------- */
  if (input.taxpayerType === "mei") {
    const das = MEI_DAS[input.meiType];
    notes.push(
      "O MEI permanece em regime próprio: o DAS fixo não é substituído por IBS/CBS, mas o MEI poderá optar por recolher IBS/CBS para gerar créditos aos clientes.",
    );
    return {
      base: input.revenue,
      current: scenario([{ label: "DAS fixo", value: das }], input.revenue),
      reform: scenario([{ label: "DAS fixo (mantido)", value: das }], input.revenue),
      effectiveNewRate: newRate,
      benefitApplied: applied,
      benefitLost: lost,
      notes,
    };
  }

  /* ---------- Simples Nacional ---------- */
  if (input.taxpayerType === "simples") {
    const simplesRate = simplesEffectiveRate(input.simplesAnexo, input.revenue, input.rbt12);
    const currentTax = input.revenue * simplesRate;
    const cppFora = cppOutsideDas(input.simplesAnexo);
    const cppValue = cppFora ? Math.max(0, input.payroll) * CPP_RATE : 0;
    const cppLine: TaxLine[] = cppFora
      ? [{ label: `CPP patronal via GPS (${pct(CPP_RATE)} da folha)`, value: cppValue }]
      : [];
    // Em 2033 este ramo representa exclusivamente a saída do Simples e a apuração
    // pelo regime regular. A permanência no DAS não recebe valor sem a tabela validada.
    const simplesSupplierShare2033 = Math.min(100, Math.max(0, input.simplesSupplierShare || 0));
    const purchases2033 = Math.min(Math.max(0, input.purchases), input.revenue);
    const credits2033 = purchases2033 * (1 - simplesSupplierShare2033 / 100) * newRate;
    const profitBase2033 = input.revenue * PRESUMIDO_IRPJ_BASE[activity.sector];
    const csllBase2033 = input.revenue * PRESUMIDO_CSLL_BASE[activity.sector];
    const reformLines: TaxLine[] =
      year === 2033
        ? [
            {
              label: `IBS + CBS (${pct(newRate)})`,
              value: Math.max(0, input.revenue * taxableShare * newRate - credits2033),
            },
            ...irpjCsll(input, profitBase2033, csllBase2033),
          ]
        : [
            { label: `Simples Nacional (${pct(simplesRate)})`, value: currentTax },
            ...cppLine,
          ];

    if (cppFora) {
      notes.push(
        `No Anexo ${input.simplesAnexo} a contribuição previdenciária patronal (CPP, ${pct(
          CPP_RATE,
        )} sobre a folha) NÃO está incluída no DAS: ela é recolhida à parte, em GPS. Diferente do Anexo III, em que a CPP já vem embutida na guia única.${
          input.payroll > 0
            ? ""
            : " Informe a folha de pagamento mensal para estimar esse valor."
        }`,
      );
    }
    if (year !== 2033) {
      notes.push(
        "Até 2032 o Simples Nacional permanece como está. A comparação com o regime regular de IBS/CBS aparece no cenário de 2033.",
      );
    } else {
      notes.push(
        "Este cenário representa exclusivamente a hipótese de saída do Simples e apuração pelo regime regular em 2033 — não é uma projeção de permanência no DAS. O IBS/CBS substitui os tributos sobre consumo, e IRPJ, CSLL e CPP estão somados separadamente (IRPJ/CSLL estimados pelas bases do Lucro Presumido).",
      );
      notes.push(
        SIMPLES_2033_UNAVAILABLE_NOTE,
      );
    }

    return {
      base: input.revenue,
      current: scenario(
        [
          {
            label: `DAS — Simples Anexo ${input.simplesAnexo} (${pct(simplesRate)})`,
            value: currentTax,
          },
          ...cppLine,
        ],
        input.revenue,
      ),
      reform: scenario(reformLines, input.revenue),
      effectiveNewRate: newRate,
      benefitApplied: applied,
      benefitLost: lost,
      notes,
    };
  }


  /* ---------- Lucro Presumido / Real ---------- */
  const isReal = input.taxpayerType === "real";
  const revenue = input.revenue;
  const purchases = Math.min(input.purchases, revenue);

  const pisRate = isReal ? PIS_NAO_CUMULATIVO : PIS_CUMULATIVO;
  const cofinsRate = isReal ? COFINS_NAO_CUMULATIVO : COFINS_CUMULATIVO;
  const pisCofinsCredit = isReal ? purchases * (pisRate + cofinsRate) : 0;

  const profitBase = isReal
    ? revenue * (Math.max(0, input.profitMargin) / 100)
    : revenue * PRESUMIDO_IRPJ_BASE[activity.sector];
  const csllBase = isReal
    ? revenue * (Math.max(0, input.profitMargin) / 100)
    : revenue * PRESUMIDO_CSLL_BASE[activity.sector];

  const directTaxes = irpjCsll(input, profitBase, csllBase);

  const currentLines: TaxLine[] = [
    { label: `PIS (${pct(pisRate)})`, value: revenue * taxableShare * pisRate - pisCofinsCredit * (pisRate / (pisRate + cofinsRate)) },
    { label: `COFINS (${pct(cofinsRate)})`, value: revenue * taxableShare * cofinsRate - pisCofinsCredit * (cofinsRate / (pisRate + cofinsRate)) },
    { label: consumptionOldLabel, value: revenue * consumptionOldRate },
    ...directTaxes,
  ];

  // Cenário reforma
  const newBase = revenue * taxableShare;
  const simplesSupplierShare = Math.min(100, Math.max(0, input.simplesSupplierShare || 0));
  const creditablePurchases = purchases * (1 - simplesSupplierShare / 100);
  const credits = creditablePurchases * newRate;
  if (purchases > 0 && simplesSupplierShare > 0) {
    notes.push(
      `Crédito reduzido: ${simplesSupplierShare.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })}% das compras informadas foram de fornecedores no Simples Nacional, sem gerar crédito integral nesta estimativa.`,
    );
  }
  const reformLines: TaxLine[] = [];

  if (t.keepPisCofins) {
    reformLines.push(currentLines[0]!, currentLines[1]!);
  } else {
    const share = t.newRateShare;
    reformLines.push({
      label: `IBS + CBS (${pct(newRate * share)})`,
      value: Math.max(0, newBase * newRate * share - credits * share),
    });
  }
  if (t.keepIcmsIss) {
    reformLines.push({ label: consumptionOldLabel, value: revenue * consumptionOldRate });
  }
  if (t.testRate > 0) {
    reformLines.push({
      label: "IBS (alíquota de teste)",
      value: newBase * t.testRate,
    });
  }
  reformLines.push(...directTaxes);

  if (year === 2026) {
    notes.push(
      "Em 2026 vigoram apenas as alíquotas de teste (CBS 0,9% compensável com PIS/COFINS e IBS 0,1%): o impacto financeiro é baixo, mas há obrigações acessórias novas.",
    );
  }
  if (year === 2027) {
    notes.push(
      "Em 2027 PIS e COFINS são extintos e substituídos pela CBS; ICMS e ISS seguem vigentes até a transição estadual/municipal.",
    );
  }

  return {
    base: revenue,
    current: scenario(currentLines, revenue),
    reform: scenario(reformLines, revenue),
    effectiveNewRate: newRate,
    benefitApplied: applied,
    benefitLost: lost,
    notes,
  };
}
