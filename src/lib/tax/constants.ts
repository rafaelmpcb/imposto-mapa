/**
 * Constantes da Reforma Tributária (IBS/CBS).
 *
 * ATENÇÃO: a alíquota de referência de 26,5% é a estimativa atual prevista na
 * LC 214/2025 e está SUJEITA A ALTERAÇÃO por resolução do Senado Federal e por
 * regulamentação complementar. Todos os valores abaixo são configuráveis.
 */

/** Alíquota de referência cheia (CBS + IBS combinados). */
export const REFERENCE_RATE = 0.265;

/** Divisão estimada da alíquota de referência entre os dois tributos. */
export const CBS_SHARE = 0.088; // federal (substitui PIS/COFINS)
export const IBS_SHARE = 0.177; // estadual + municipal (substitui ICMS/ISS)

/** Alíquota simbólica de teste do IBS em 2026/2027. */
export const IBS_TEST_RATE = 0.001;
/** Alíquota de teste da CBS em 2026 (compensável com PIS/COFINS). */
export const CBS_TEST_RATE = 0.009;

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
export const ISS_RATE = 0.05;

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

/* ---------------- Lucro Presumido / Real ---------------- */

export const PIS_CUMULATIVO = 0.0065;
export const COFINS_CUMULATIVO = 0.03;
export const PIS_NAO_CUMULATIVO = 0.0165;
export const COFINS_NAO_CUMULATIVO = 0.076;
export const IRPJ_RATE = 0.15;
export const IRPJ_ADICIONAL_RATE = 0.1;
export const IRPJ_ADICIONAL_LIMIT_MONTHLY = 20000;
export const CSLL_RATE = 0.09;
export const CPP_RATE = 0.2;
/** Bases presumidas. */
export const PRESUMIDO_IRPJ_BASE = { servico: 0.32, comercio: 0.08, industria: 0.08 };
export const PRESUMIDO_CSLL_BASE = { servico: 0.32, comercio: 0.12, industria: 0.12 };

export const YEARS = [
  { id: 2026, label: "2026 — impacto real agora" },
  { id: 2027, label: "2027 — primeira mudança relevante" },
  { id: 2033, label: "2033 — regime pleno (projeção de longo prazo)" },
] as const;

export type YearId = (typeof YEARS)[number]["id"];
