/**
 * Constantes da Reforma Tributária (IBS/CBS).
 *
 * ATENÇÃO: a alíquota de referência de 26,5% é a estimativa atual prevista na
 * LC 214/2025 e está SUJEITA A ALTERAÇÃO por resolução do Senado Federal e por
 * regulamentação complementar. Todos os valores abaixo são configuráveis.
 */

/* Os valores marcados como ajustáveis (export let) podem ser sobrescritos pelo
   painel de configuração do escritório — ver applyTaxOverrides() no fim do arquivo. */

/** Alíquota de referência cheia (CBS + IBS combinados). */
export let REFERENCE_RATE = 0.265;

/** Divisão estimada da alíquota de referência entre os dois tributos. */
export let CBS_SHARE = 0.088; // federal (substitui PIS/COFINS)
export let IBS_SHARE = 0.177; // estadual + municipal (substitui ICMS/ISS)

/** Alíquota simbólica de teste do IBS em 2026/2027. */
export let IBS_TEST_RATE = 0.001;
/** Alíquota de teste da CBS em 2026 (compensável com PIS/COFINS). */
export let CBS_TEST_RATE = 0.009;

/** Data de referência da legislação usada nas estimativas. */
export const LEGAL_REFERENCE_DATE = "setembro de 2026";

export type Sector = "servico" | "comercio" | "industria";

export interface Activity {
  id: string;
  label: string;
  /** Redução sobre a alíquota de referência (0,3 = 30%). */
  reduction: number;
  /**
   * Profissão regulamentada (Art. 127 da LC 214/2025): a redução de 30% exige
   * que todos os sócios tenham registro no conselho profissional e nenhum seja
   * pessoa jurídica — por isso dispara a validação da Etapa 3.
   * Os benefícios de 60% (Art. 125 da LC 214/2025: saúde, educação, cultura,
   * transporte público, insumos agro) NÃO têm esse requisito e são aplicados
   * automaticamente (regulated = false).
   */
  regulated: boolean;
  sector: Sector;
}

export const ACTIVITIES: Activity[] = [
  {
    id: "advocacia",
    label: "Serviços advocatícios",
    reduction: 0.3,
    regulated: true,
    sector: "servico",
  },
  {
    id: "contabilidade",
    label: "Serviços de contabilidade",
    reduction: 0.3,
    regulated: true,
    sector: "servico",
  },
  {
    id: "engenharia",
    label: "Serviços de engenharia / arquitetura",
    reduction: 0.3,
    regulated: true,
    sector: "servico",
  },
  {
    id: "saude",
    label: "Serviços de saúde",
    reduction: 0.6,
    regulated: false, // Art. 125: redução de 60% sem requisito societário
    sector: "servico",
  },
  {
    id: "educacao",
    label: "Serviços de educação",
    reduction: 0.6,
    regulated: false,
    sector: "servico",
  },
  {
    id: "cultura",
    label: "Produção cultural / transporte público",
    reduction: 0.6,
    regulated: false,
    sector: "servico",
  },
  {
    id: "agro",
    label: "Insumos agropecuários",
    reduction: 0.6,
    regulated: false,
    sector: "comercio",
  },
  {
    id: "varejo",
    label: "Comércio varejista",
    reduction: 0,
    regulated: false,
    sector: "comercio",
  },
  {
    id: "industria",
    label: "Indústria",
    reduction: 0,
    regulated: false,
    sector: "industria",
  },
  {
    id: "tecnologia",
    label: "Serviços de tecnologia",
    reduction: 0,
    regulated: false,
    sector: "servico",
  },
  {
    id: "servicos_gerais",
    label: "Serviços em geral — outros",
    reduction: 0,
    regulated: false,
    sector: "servico",
  },
];

export const getActivity = (id: string): Activity =>
  ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[ACTIVITIES.length - 1]!;

/**
 * Enquadramento típico no Simples Nacional por atividade (LC 123/2006, art. 18).
 * É apenas uma sugestão: o usuário pode ajustar (há exceções, como o Fator R).
 */
export const TYPICAL_SIMPLES_ANEXO: Record<string, string> = {
  advocacia: "IV", // art. 18, §5º-C, V — CPP fora do DAS
  engenharia: "IV", // art. 18, §5º-C, II (serviços de engenharia)
  contabilidade: "III",
  saude: "III",
  educacao: "III",
  cultura: "III",
  tecnologia: "V",
  varejo: "I",
  agro: "I",
  industria: "II",
  servicos_gerais: "III",
};

/** Anexos em que a CPP patronal fica FORA do DAS (recolhida por GPS). */
export const ANEXOS_CPP_FORA_DAS = ["IV"];


/** Alíquota interna padrão de ICMS por UF (%). */
export const ICMS_BY_UF: Record<string, number> = {
  AC: 19.0, AL: 21.5, AP: 18.0, AM: 20.0, BA: 20.5, CE: 20.0, DF: 20.0,
  ES: 17.0, GO: 19.0, MA: 23.0, MT: 17.0, MS: 17.0, MG: 18.0, PA: 19.0,
  PB: 20.0, PR: 19.5, PE: 20.5, PI: 22.5, RJ: 22.0, RN: 20.0, RS: 17.0,
  RO: 19.5, RR: 20.0, SC: 17.0, SP: 18.0, SE: 20.0, TO: 20.0,
};

export const UFS = Object.keys(ICMS_BY_UF).sort();

export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia",
  RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe",
  TO: "Tocantins",
};

/** ISS fixo usado para serviços (aproximação de alíquota municipal média). */
export let ISS_RATE = 0.05;

/** DAS do MEI — valores de referência 2026 (configuráveis). */
export const MEI_DAS = {
  comercio: 70.6,
  servicos: 75.6,
  ambos: 76.6,
};

/* ---------------- Pessoa Física ---------------- */

export const DEPENDENT_DEDUCTION = 189.59;
/** Desconto simplificado mensal do IRPF. */
export const SIMPLIFIED_DISCOUNT = 607.2;

/** Tabela progressiva mensal do IRPF (base, alíquota, parcela a deduzir). */
export const IRPF_TABLE = [
  { limit: 2428.8, rate: 0, deduct: 0 },
  { limit: 2826.65, rate: 0.075, deduct: 182.16 },
  { limit: 3751.05, rate: 0.15, deduct: 394.16 },
  { limit: 4664.68, rate: 0.225, deduct: 675.49 },
  { limit: Infinity, rate: 0.275, deduct: 908.73 },
];

/** Tabela progressiva do INSS (empregado). */
export const INSS_TABLE = [
  { limit: 1518.0, rate: 0.075 },
  { limit: 2793.88, rate: 0.09 },
  { limit: 4190.83, rate: 0.12 },
  { limit: 8157.41, rate: 0.14 },
];

/** Novas faixas de isenção do IRPF. */
export const IRPF_NEW_FULL_EXEMPTION = 5000;
export const IRPF_NEW_PARTIAL_LIMIT = 7350;

/* ---------------- Simples Nacional ---------------- */

export interface SimplesBracket {
  rbt12: number;
  rate: number;
  deduct: number;
}

export const SIMPLES_TABLES: Record<string, SimplesBracket[]> = {
  I: [
    { rbt12: 180000, rate: 0.04, deduct: 0 },
    { rbt12: 360000, rate: 0.073, deduct: 5940 },
    { rbt12: 720000, rate: 0.095, deduct: 13860 },
    { rbt12: 1800000, rate: 0.107, deduct: 22500 },
    { rbt12: 3600000, rate: 0.143, deduct: 87300 },
    { rbt12: 4800000, rate: 0.19, deduct: 378000 },
  ],
  II: [
    { rbt12: 180000, rate: 0.045, deduct: 0 },
    { rbt12: 360000, rate: 0.078, deduct: 5940 },
    { rbt12: 720000, rate: 0.1, deduct: 13860 },
    { rbt12: 1800000, rate: 0.112, deduct: 22500 },
    { rbt12: 3600000, rate: 0.147, deduct: 85500 },
    { rbt12: 4800000, rate: 0.3, deduct: 720000 },
  ],
  III: [
    { rbt12: 180000, rate: 0.06, deduct: 0 },
    { rbt12: 360000, rate: 0.112, deduct: 9360 },
    { rbt12: 720000, rate: 0.135, deduct: 17640 },
    { rbt12: 1800000, rate: 0.16, deduct: 35640 },
    { rbt12: 3600000, rate: 0.21, deduct: 125640 },
    { rbt12: 4800000, rate: 0.33, deduct: 648000 },
  ],
  IV: [
    { rbt12: 180000, rate: 0.045, deduct: 0 },
    { rbt12: 360000, rate: 0.09, deduct: 8100 },
    { rbt12: 720000, rate: 0.102, deduct: 12420 },
    { rbt12: 1800000, rate: 0.14, deduct: 39780 },
    { rbt12: 3600000, rate: 0.22, deduct: 183780 },
    { rbt12: 4800000, rate: 0.33, deduct: 828000 },
  ],
  V: [
    { rbt12: 180000, rate: 0.155, deduct: 0 },
    { rbt12: 360000, rate: 0.18, deduct: 4500 },
    { rbt12: 720000, rate: 0.195, deduct: 9900 },
    { rbt12: 1800000, rate: 0.205, deduct: 17100 },
    { rbt12: 3600000, rate: 0.23, deduct: 62100 },
    { rbt12: 4800000, rate: 0.305, deduct: 540000 },
  ],
};

/** Cópia imutável dos valores originais das faixas do Simples (usada como padrão). */
export const SIMPLES_DEFAULTS: Record<string, SimplesBracket[]> = JSON.parse(
  JSON.stringify(SIMPLES_TABLES),
);

export const SIMPLES_ANEXOS = ["I", "II", "III", "IV", "V"] as const;

/** Sobrescreve um campo de uma faixa do Simples com o valor vigente cadastrado. */
export function setSimplesBracket(
  anexo: string,
  index: number,
  field: keyof SimplesBracket,
  value: number,
): void {
  const bracket = SIMPLES_TABLES[anexo]?.[index];
  if (!bracket || !Number.isFinite(value)) return;
  bracket[field] = value;
}

/* ---------------- Lucro Presumido / Real ---------------- */

export let PIS_CUMULATIVO = 0.0065;
export let COFINS_CUMULATIVO = 0.03;
export let PIS_NAO_CUMULATIVO = 0.0165;
export let COFINS_NAO_CUMULATIVO = 0.076;
export let IRPJ_RATE = 0.15;
export const IRPJ_ADICIONAL_RATE = 0.1;
export const IRPJ_ADICIONAL_LIMIT_MONTHLY = 20000;
export let CSLL_RATE = 0.09;
export let CPP_RATE = 0.2;
/** Bases presumidas. */
export const PRESUMIDO_IRPJ_BASE = { servico: 0.32, comercio: 0.08, industria: 0.08 };
export const PRESUMIDO_CSLL_BASE = { servico: 0.32, comercio: 0.12, industria: 0.12 };

export const YEARS = [
  { id: 2026, label: "2026 — impacto real agora" },
  { id: 2027, label: "2027 — primeira mudança relevante" },
  { id: 2033, label: "2033 — regime pleno (projeção de longo prazo)" },
] as const;

export type YearId = (typeof YEARS)[number]["id"];

/* ---------------- Configuração ajustável pelo escritório ---------------- */

export interface TunableDef {
  key: string;
  label: string;
  group: string;
  /** Valor padrão (fração: 0,265 = 26,5%). */
  fallback: number;
}

export const TUNABLES: TunableDef[] = [
  { key: "REFERENCE_RATE", label: "Alíquota de referência (IBS + CBS)", group: "IBS / CBS", fallback: 0.265 },
  { key: "CBS_SHARE", label: "Parcela da CBS (federal)", group: "IBS / CBS", fallback: 0.088 },
  { key: "IBS_SHARE", label: "Parcela do IBS (estadual/municipal)", group: "IBS / CBS", fallback: 0.177 },
  { key: "IBS_TEST_RATE", label: "IBS — alíquota de teste", group: "IBS / CBS", fallback: 0.001 },
  { key: "CBS_TEST_RATE", label: "CBS — alíquota de teste (2026)", group: "IBS / CBS", fallback: 0.009 },
  { key: "ISS_RATE", label: "ISS médio (serviços)", group: "Sistema atual", fallback: 0.05 },
  { key: "PIS_CUMULATIVO", label: "PIS cumulativo", group: "Sistema atual", fallback: 0.0065 },
  { key: "COFINS_CUMULATIVO", label: "COFINS cumulativo", group: "Sistema atual", fallback: 0.03 },
  { key: "PIS_NAO_CUMULATIVO", label: "PIS não cumulativo", group: "Sistema atual", fallback: 0.0165 },
  { key: "COFINS_NAO_CUMULATIVO", label: "COFINS não cumulativo", group: "Sistema atual", fallback: 0.076 },
  { key: "IRPJ_RATE", label: "IRPJ", group: "Renda e folha", fallback: 0.15 },
  { key: "CSLL_RATE", label: "CSLL", group: "Renda e folha", fallback: 0.09 },
  { key: "CPP_RATE", label: "CPP sobre a folha", group: "Renda e folha", fallback: 0.2 },
];

const setters: Record<string, (v: number) => void> = {
  REFERENCE_RATE: (v) => { REFERENCE_RATE = v; },
  CBS_SHARE: (v) => { CBS_SHARE = v; },
  IBS_SHARE: (v) => { IBS_SHARE = v; },
  IBS_TEST_RATE: (v) => { IBS_TEST_RATE = v; },
  CBS_TEST_RATE: (v) => { CBS_TEST_RATE = v; },
  ISS_RATE: (v) => { ISS_RATE = v; },
  PIS_CUMULATIVO: (v) => { PIS_CUMULATIVO = v; },
  COFINS_CUMULATIVO: (v) => { COFINS_CUMULATIVO = v; },
  PIS_NAO_CUMULATIVO: (v) => { PIS_NAO_CUMULATIVO = v; },
  COFINS_NAO_CUMULATIVO: (v) => { COFINS_NAO_CUMULATIVO = v; },
  IRPJ_RATE: (v) => { IRPJ_RATE = v; },
  CSLL_RATE: (v) => { CSLL_RATE = v; },
  CPP_RATE: (v) => { CPP_RATE = v; },
};

const getters: Record<string, () => number> = {
  REFERENCE_RATE: () => REFERENCE_RATE,
  CBS_SHARE: () => CBS_SHARE,
  IBS_SHARE: () => IBS_SHARE,
  IBS_TEST_RATE: () => IBS_TEST_RATE,
  CBS_TEST_RATE: () => CBS_TEST_RATE,
  ISS_RATE: () => ISS_RATE,
  PIS_CUMULATIVO: () => PIS_CUMULATIVO,
  COFINS_CUMULATIVO: () => COFINS_CUMULATIVO,
  PIS_NAO_CUMULATIVO: () => PIS_NAO_CUMULATIVO,
  COFINS_NAO_CUMULATIVO: () => COFINS_NAO_CUMULATIVO,
  IRPJ_RATE: () => IRPJ_RATE,
  CSLL_RATE: () => CSLL_RATE,
  CPP_RATE: () => CPP_RATE,
};

/** Aplica os valores salvos pelo escritório; chaves ausentes voltam ao padrão. */
export function applyTaxOverrides(overrides: Record<string, number>): void {
  for (const def of TUNABLES) {
    const raw = overrides[def.key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : def.fallback;
    setters[def.key]?.(value);
  }
}

/** Valores em uso neste momento. */
export function currentTaxConfig(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of TUNABLES) out[def.key] = getters[def.key]?.() ?? def.fallback;
  return out;
}
