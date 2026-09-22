/**
 * Precificação e repactuação de contratos de locação sob o IBS/CBS.
 *
 * Módulo puro: recebe os dados do contrato e devolve os três cenários
 * (hoje, ano escolhido sem repactuação e ano escolhido com repactuação).
 * Nada aqui consulta banco e nada é recomendação comercial — é o piso
 * técnico da negociação entre locador e locatário.
 */

export type RegimeLocador =
  | "real"
  | "presumido"
  | "simples"
  | "pf_contribuinte"
  | "pf_nao_contribuinte";

/** Critério de repactuação do contrato. */
export type CriterioRepactuacao = "liquido_locador" | "custo_locatario";

export const REGIME_LOCADOR_LABEL: Record<RegimeLocador, string> = {
  real: "Pessoa jurídica — Lucro Real",
  presumido: "Pessoa jurídica — Lucro Presumido",
  simples: "Pessoa jurídica — Simples Nacional",
  pf_contribuinte: "Pessoa física — contribuinte de IBS/CBS",
  pf_nao_contribuinte: "Pessoa física — fora do campo de incidência",
};

export const CRITERIO_LABEL: Record<CriterioRepactuacao, string> = {
  liquido_locador: "Preservar a receita líquida do locador",
  custo_locatario: "Preservar o custo efetivo do locatário",
};

export interface PremissasRegime {
  /** Tributos de hoje que o IBS/CBS substitui (PIS/COFINS/ISS), em % do aluguel. */
  substituidaPct: number;
  /** Tributos de hoje que permanecem (IRPJ/CSLL/IRPF/DAS), em % do aluguel. */
  mantidaPct: number;
  /** O locador destaca IBS/CBS na operação. */
  destacaIbsCbs: boolean;
  nota: string;
}

/** Premissas ESTIMADAS por regime — todas editáveis na tela. */
export const PREMISSAS_PADRAO: Record<RegimeLocador, PremissasRegime> = {
  real: {
    substituidaPct: 9.25,
    mantidaPct: 10,
    destacaIbsCbs: true,
    nota: "PIS/COFINS não cumulativos substituídos; IRPJ/CSLL estimados sobre o resultado da locação.",
  },
  presumido: {
    substituidaPct: 3.65,
    mantidaPct: 7.68,
    destacaIbsCbs: true,
    nota: "PIS/COFINS cumulativos substituídos; IRPJ/CSLL com presunção de 32% sobre a receita de locação.",
  },
  simples: {
    substituidaPct: 6,
    mantidaPct: 0,
    destacaIbsCbs: false,
    nota: "No Simples o IBS/CBS fica dentro do DAS e, pela convenção adotada, não transfere crédito ao locatário.",
  },
  pf_contribuinte: {
    substituidaPct: 0,
    mantidaPct: 27.5,
    destacaIbsCbs: true,
    nota: "Pessoa física equiparada a contribuinte pelos limites de receita e de número de imóveis; IRPF mantido.",
  },
  pf_nao_contribuinte: {
    substituidaPct: 0,
    mantidaPct: 27.5,
    destacaIbsCbs: false,
    nota: "Pessoa física fora do campo de incidência: não há IBS/CBS na locação e o locatário não toma crédito.",
  },
};

export const ALIQUOTA_PLENA_PADRAO_PCT = 26.5;
/** Redutor da locação de bem imóvel previsto na LC 214/2025. */
export const REDUTOR_IMOVEL_PADRAO_PCT = 70;

/**
 * Fração ESTIMADA da alíquota plena em cada ano da transição.
 * 2026 é o ano-teste (1%); 2027–2028 a CBS já é integral; o IBS estadual
 * entra em degraus de 2029 a 2032 e o regime fica pleno em 2033.
 */
export const FRACAO_TRANSICAO: Record<number, number> = {
  2026: 0.038,
  2027: 0.336,
  2028: 0.336,
  2029: 0.398,
  2030: 0.46,
  2031: 0.522,
  2032: 0.585,
  2033: 1,
};

export const ANOS_DISPONIVEIS = Object.keys(FRACAO_TRANSICAO)
  .map(Number)
  .sort((a, b) => a - b);

export const AVISO_ESTIMATIVA =
  "Cálculo estimativo de apoio à negociação. A alíquota plena, o redutor da locação e a rampa de transição dependem de regulamentação e podem mudar.";

export const AVISO_CONTRATO_ANTIGO =
  "Contratos de locação de bem imóvel firmados até 16/01/2025 e registrados podem seguir regra específica de transição; confira o contrato antes de repactuar.";

export interface ContratoInput {
  /** Aluguel mensal cobrado hoje (valor do contrato). */
  aluguelMensal: number;
  regimeLocador: RegimeLocador;
  /** Quanto do IBS/CBS destacado o locatário consegue aproveitar como crédito (0 a 100). */
  aproveitamentoCreditoPct: number;
  ano: number;
  criterio: CriterioRepactuacao;
  aliquotaPlenaPct?: number;
  redutorPct?: number;
  substituidaPct?: number;
  mantidaPct?: number;
}

export interface CenarioAluguel {
  id: "atual" | "sem_repactuacao" | "repactuado";
  label: string;
  /** Valor total pago pelo locatário. */
  valorContrato: number;
  /** Base da operação, sem o IBS/CBS por fora. */
  baseOperacao: number;
  ibsCbs: number;
  tributosMantidos: number;
  liquidoLocador: number;
  creditoLocatario: number;
  custoEfetivoLocatario: number;
}

export interface ResultadoAluguel {
  ano: number;
  fracao: number;
  aliquotaEfetivaPct: number;
  criterio: CriterioRepactuacao;
  premissas: { substituidaPct: number; mantidaPct: number; aliquotaPlenaPct: number; redutorPct: number };
  cenarios: CenarioAluguel[];
  /** Variações do cenário sem repactuação frente ao atual. */
  semRepactuacao: { variacaoLiquidoPct: number; variacaoCustoPct: number };
  /** Aluguel sugerido e variação frente ao contrato de hoje. */
  repactuacao: { aluguelSugerido: number; variacaoAluguelPct: number; variacaoLiquidoPct: number; variacaoCustoPct: number };
  /** Série 2026–2033 do aluguel sugerido pelo mesmo critério. */
  evolucao: { ano: number; aluguelSugerido: number; variacaoPct: number; liquidoLocador: number; custoLocatario: number }[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const pctVar = (novo: number, base: number) => (base > 0 ? ((novo - base) / base) * 100 : 0);

export const fracaoDoAno = (ano: number): number => FRACAO_TRANSICAO[ano] ?? 1;

/** Alíquota de IBS/CBS aplicável ao contrato no ano, já com redutor e rampa. */
export function aliquotaEfetiva(input: ContratoInput, ano: number): number {
  const premissas = PREMISSAS_PADRAO[input.regimeLocador];
  if (!premissas.destacaIbsCbs) return 0;
  const plena = (input.aliquotaPlenaPct ?? ALIQUOTA_PLENA_PADRAO_PCT) / 100;
  const redutor = 1 - (input.redutorPct ?? REDUTOR_IMOVEL_PADRAO_PCT) / 100;
  return plena * redutor * fracaoDoAno(ano);
}

function cenarioAno(
  input: ContratoInput,
  ano: number,
  valorContrato: number,
  id: CenarioAluguel["id"],
  label: string,
): CenarioAluguel {
  const e = aliquotaEfetiva(input, ano);
  const mantida = (input.mantidaPct ?? PREMISSAS_PADRAO[input.regimeLocador].mantidaPct) / 100;
  const aprov = Math.min(100, Math.max(0, input.aproveitamentoCreditoPct)) / 100;

  const base = valorContrato / (1 + e);
  const ibsCbs = base * e;
  const tributosMantidos = base * mantida;
  const credito = ibsCbs * aprov;

  return {
    id,
    label,
    valorContrato: round2(valorContrato),
    baseOperacao: round2(base),
    ibsCbs: round2(ibsCbs),
    tributosMantidos: round2(tributosMantidos),
    liquidoLocador: round2(base - tributosMantidos),
    creditoLocatario: round2(credito),
    custoEfetivoLocatario: round2(valorContrato - credito),
  };
}

/** Aluguel que atende ao critério escolhido no ano informado. */
export function aluguelSugerido(input: ContratoInput, ano: number, atual: CenarioAluguel): number {
  const e = aliquotaEfetiva(input, ano);
  const mantida = (input.mantidaPct ?? PREMISSAS_PADRAO[input.regimeLocador].mantidaPct) / 100;
  const aprov = Math.min(100, Math.max(0, input.aproveitamentoCreditoPct)) / 100;

  if (input.criterio === "liquido_locador") {
    if (mantida >= 1) return atual.valorContrato;
    const base = atual.liquidoLocador / (1 - mantida);
    return base * (1 + e);
  }
  const divisor = 1 + e * (1 - aprov);
  return divisor > 0 ? atual.custoEfetivoLocatario / divisor : atual.valorContrato;
}

/** Cenário de hoje: sem IBS/CBS, com os tributos atuais do regime. */
function cenarioAtual(input: ContratoInput): CenarioAluguel {
  const subst = (input.substituidaPct ?? PREMISSAS_PADRAO[input.regimeLocador].substituidaPct) / 100;
  const mantida = (input.mantidaPct ?? PREMISSAS_PADRAO[input.regimeLocador].mantidaPct) / 100;
  const v = input.aluguelMensal;
  const tributos = v * (subst + mantida);
  return {
    id: "atual",
    label: "Contrato de hoje",
    valorContrato: round2(v),
    baseOperacao: round2(v),
    ibsCbs: 0,
    tributosMantidos: round2(tributos),
    liquidoLocador: round2(v - tributos),
    creditoLocatario: 0,
    custoEfetivoLocatario: round2(v),
  };
}

export function calcularContrato(input: ContratoInput): ResultadoAluguel {
  const atual = cenarioAtual(input);
  const semRepac = cenarioAno(input, input.ano, input.aluguelMensal, "sem_repactuacao", `${input.ano} sem repactuação`);
  const sugerido = aluguelSugerido(input, input.ano, atual);
  const repactuado = cenarioAno(input, input.ano, sugerido, "repactuado", `${input.ano} com repactuação`);

  const evolucao = ANOS_DISPONIVEIS.map((ano) => {
    const valor = aluguelSugerido(input, ano, atual);
    const cen = cenarioAno(input, ano, valor, "repactuado", String(ano));
    return {
      ano,
      aluguelSugerido: round2(valor),
      variacaoPct: round2(pctVar(valor, atual.valorContrato)),
      liquidoLocador: cen.liquidoLocador,
      custoLocatario: cen.custoEfetivoLocatario,
    };
  });

  return {
    ano: input.ano,
    fracao: fracaoDoAno(input.ano),
    aliquotaEfetivaPct: round2(aliquotaEfetiva(input, input.ano) * 100),
    criterio: input.criterio,
    premissas: {
      substituidaPct: input.substituidaPct ?? PREMISSAS_PADRAO[input.regimeLocador].substituidaPct,
      mantidaPct: input.mantidaPct ?? PREMISSAS_PADRAO[input.regimeLocador].mantidaPct,
      aliquotaPlenaPct: input.aliquotaPlenaPct ?? ALIQUOTA_PLENA_PADRAO_PCT,
      redutorPct: input.redutorPct ?? REDUTOR_IMOVEL_PADRAO_PCT,
    },
    cenarios: [atual, semRepac, repactuado],
    semRepactuacao: {
      variacaoLiquidoPct: round2(pctVar(semRepac.liquidoLocador, atual.liquidoLocador)),
      variacaoCustoPct: round2(pctVar(semRepac.custoEfetivoLocatario, atual.custoEfetivoLocatario)),
    },
    repactuacao: {
      aluguelSugerido: round2(sugerido),
      variacaoAluguelPct: round2(pctVar(sugerido, atual.valorContrato)),
      variacaoLiquidoPct: round2(pctVar(repactuado.liquidoLocador, atual.liquidoLocador)),
      variacaoCustoPct: round2(pctVar(repactuado.custoEfetivoLocatario, atual.custoEfetivoLocatario)),
    },
    evolucao,
  };
}

/** Texto de cláusula sugerida para a negociação (rascunho, não é minuta final). */
export function clausulaSugerida(res: ResultadoAluguel): string {
  const money = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const criterio =
    res.criterio === "liquido_locador"
      ? "preservação da receita líquida do locador"
      : "preservação do custo efetivo do locatário";
  return [
    `As partes reconhecem que a implementação do IBS e da CBS altera a carga tributária incidente sobre a locação a partir de ${res.ano}.`,
    `Para o critério de ${criterio}, o valor do aluguel passa a ${money(res.repactuacao.aluguelSugerido)} mensais (${res.repactuacao.variacaoAluguelPct >= 0 ? "+" : ""}${res.repactuacao.variacaoAluguelPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o valor vigente), com destaque do IBS/CBS quando devido.`,
    "As partes se comprometem a revisar este valor a cada alteração da alíquota de referência, do redutor aplicável à locação ou do cronograma de transição, mediante simples aditivo.",
  ].join(" ");
}
