import {
  ACTIVITIES,
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
  meiType: keyof typeof MEI_DAS;
  // Etapa 3
  benefitConfirmed: boolean | null;
  // Etapa 4
  monofasicoShare: number; // %
  purchases: number;
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
  profitMargin: 15,
  simplesAnexo: "III",
  meiType: "servicos",
  benefitConfirmed: null,
  monofasicoShare: 0,
  purchases: 0,
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

function simplesEffectiveRate(anexo: keyof typeof SIMPLES_TABLES, revenue: number): number {
  const rbt12 = Math.max(revenue * 12, 1);
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

export type BusinessRegime = "simples" | "presumido" | "real";

export interface RegimeComparisonItem {
  regime: BusinessRegime;
  label: string;
  total: number;
  rate: number;
  lines: { label: string; value: number }[];
  isCurrent: boolean;
  isBest: boolean;
  estimateNote?: string;
}

/** Margem de lucro padrão quando o usuário não informou (Lucro Real estimado). */
export const DEFAULT_PROFIT_MARGIN = 20;

/** Anexo do Simples mais provável a partir da atividade informada. */
export function inferSimplesAnexo(activityId: string): keyof typeof SIMPLES_TABLES {
  const activity = getActivity(activityId);
  if (activity.sector === "comercio") return "I";
  if (activity.sector === "industria") return "II";
  return ["advocacia", "contabilidade", "engenharia", "tecnologia"].includes(activity.id)
    ? "V"
    : "III";
}

/** Compara a carga pós-reforma nos três regimes empresariais. */
export function compareRegimes(
  input: SimulationInput,
  year: YearId,
): RegimeComparisonItem[] {
  const regimes: { id: BusinessRegime; label: string }[] = [
    { id: "simples", label: "Simples Nacional" },
    { id: "presumido", label: "Lucro Presumido" },
    { id: "real", label: "Lucro Real" },
  ];

  const items = regimes.map(({ id, label }) => {
    const isCurrent = input.taxpayerType === id;
    let variant: SimulationInput = { ...input, taxpayerType: id };
    let estimateNote: string | undefined;

    if (id === "simples" && !isCurrent) {
      variant = { ...variant, simplesAnexo: inferSimplesAnexo(input.activityId) };
      estimateNote = `Anexo ${variant.simplesAnexo} estimado com base na atividade`;
    }
    if (id === "real" && !isCurrent) {
      variant = { ...variant, profitMargin: DEFAULT_PROFIT_MARGIN };
      estimateNote = `Margem de lucro estimada em ${DEFAULT_PROFIT_MARGIN}%`;
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
      ...(estimateNote ? { estimateNote } : {}),
    } satisfies RegimeComparisonItem;
  });

  const min = Math.min(...items.map((i) => i.total));
  return items.map((i) => ({ ...i, isBest: Math.abs(i.total - min) < 0.005 }));
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
    const simplesRate = simplesEffectiveRate(input.simplesAnexo, input.revenue);
    const currentTax = input.revenue * simplesRate;
    const reformLines: TaxLine[] =
      year === 2033
        ? [
            {
              label: `IBS + CBS (${pct(newRate)})`,
              value: input.revenue * taxableShare * newRate,
            },
          ]
        : [{ label: `Simples Nacional (${pct(simplesRate)})`, value: currentTax }];
    if (year !== 2033) {
      notes.push(
        "Até 2032 o Simples Nacional permanece como está. A comparação com o regime regular de IBS/CBS aparece no cenário de 2033.",
      );
    } else {
      notes.push(
        "Comparação com a hipótese de saída do Simples e apuração regular de IBS/CBS. A empresa também pode permanecer no Simples.",
      );
    }
    return {
      base: input.revenue,
      current: scenario(
        [{ label: `Simples — Anexo ${input.simplesAnexo} (${pct(simplesRate)})`, value: currentTax }],
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
  const credits = purchases * newRate;
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
