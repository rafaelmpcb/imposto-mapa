/**
 * Planejamento de CAPEX e ativo imobilizado sob a Reforma Tributária.
 *
 * Módulo puro: compara a apropriação tradicional do ICMS em 1/48 avos (CIAP)
 * com o crédito imediato e integral de IBS/CBS, por ano de aquisição.
 * Nada aqui consulta banco. Todos os números são ESTIMATIVAS de apoio à
 * decisão — a regulamentação pode alterar alíquotas e cronograma.
 */

export type TipoAtivo = "maquinas" | "veiculos" | "ti" | "instalacoes";
export type RegimeCapex = "real" | "presumido" | "simples";

export const TIPO_ATIVO_LABEL: Record<TipoAtivo, string> = {
  maquinas: "Máquinas e equipamentos industriais",
  veiculos: "Veículos e frota",
  ti: "Tecnologia, hardware e software",
  instalacoes: "Instalações e benfeitorias",
};

export const REGIME_CAPEX_LABEL: Record<RegimeCapex, string> = {
  real: "Lucro Real (não cumulativo)",
  presumido: "Lucro Presumido (cumulativo)",
  simples: "Simples Nacional",
};

export interface AtivoPreset {
  /** ICMS tipicamente destacado na aquisição (%). */
  icmsPct: number;
  /** IPI tipicamente destacado na aquisição (%). */
  ipiPct: number;
  /** Fator CIAP sugerido (%). */
  fatorCiapPct: number;
  /**
   * Parcela ESTIMADA do ICMS da aquisição efetivamente apropriável via CIAP
   * para esse tipo de ativo (uso e consumo / bens alheios à atividade têm
   * restrição). O IBS/CBS, ao contrário, é creditado de forma ampla.
   */
  elegibilidadeIcmsPct: number;
  nota: string;
}

/** Premissas típicas por tipo de ativo — todas editáveis pelo usuário. */
export const ATIVO_PRESETS: Record<TipoAtivo, AtivoPreset> = {
  maquinas: {
    icmsPct: 18,
    ipiPct: 5,
    fatorCiapPct: 100,
    elegibilidadeIcmsPct: 100,
    nota: "Bem do ativo imobilizado ligado à produção: crédito de ICMS pelo CIAP em 1/48 avos, com IPI destacado na aquisição.",
  },
  veiculos: {
    icmsPct: 12,
    ipiPct: 0,
    fatorCiapPct: 100,
    elegibilidadeIcmsPct: 50,
    nota: "Frota costuma sofrer glosa parcial de ICMS quando não está diretamente vinculada à atividade-fim; no IBS/CBS o crédito é amplo.",
  },
  ti: {
    icmsPct: 18,
    ipiPct: 0,
    fatorCiapPct: 100,
    elegibilidadeIcmsPct: 20,
    nota: "Hardware e software de uso administrativo hoje quase não geram crédito de ICMS — é onde a Reforma traz o maior ganho relativo.",
  },
  instalacoes: {
    icmsPct: 0,
    ipiPct: 0,
    fatorCiapPct: 100,
    elegibilidadeIcmsPct: 0,
    nota: "Benfeitorias e instalações incorporadas ao imóvel não geram crédito de ICMS; no IBS/CBS passam a ser creditáveis.",
  },
};

export const ALIQUOTA_PLENA_PADRAO_PCT = 26.5;
/** Crédito de PIS/COFINS não cumulativos sobre a aquisição (Lucro Real). */
export const PIS_COFINS_CREDITO_PCT = 9.25;
export const ICMS_PADRAO_PCT = 18;
export const MESES_CIAP = 48;

/** Fração ESTIMADA da alíquota plena de IBS/CBS creditável no ano da compra. */
export const FRACAO_IBSCBS: Record<number, number> = {
  2026: 0.038,
  2027: 0.336,
  2028: 0.336,
  2029: 0.398,
  2030: 0.46,
  2031: 0.522,
  2032: 0.585,
  2033: 1,
};

/** Fração do ICMS ainda vigente em cada ano (extinção gradual até 2033). */
export const FRACAO_ICMS: Record<number, number> = {
  2026: 1,
  2027: 1,
  2028: 1,
  2029: 0.9,
  2030: 0.8,
  2031: 0.7,
  2032: 0.6,
  2033: 0,
};

/** PIS/COFINS e IPI só geram crédito em aquisições feitas até 2026. */
const creditoPisCofinsVigente = (ano: number) => ano <= 2026;
const creditoIpiVigente = (ano: number) => ano <= 2026;

export const ANOS_CAPEX = Object.keys(FRACAO_IBSCBS)
  .map(Number)
  .sort((a, b) => a - b);

export const AVISO_CAPEX =
  "Estudo estimativo de planejamento. O crédito efetivo depende da natureza do ativo, do CIAP, da legislação estadual e da regulamentação do IBS/CBS.";

export interface CapexInput {
  /** Valor total da aquisição (nota fiscal). */
  valorInvestimento: number;
  tipoAtivo: TipoAtivo;
  regime: RegimeCapex;
  /** Alíquota de ICMS destacada na aquisição (%). */
  icmsPct: number;
  /** IPI destacado na aquisição (%). */
  ipiPct: number;
  /** Proporção de saídas tributadas que autoriza o crédito CIAP (0 a 100). */
  fatorCiapPct: number;
  /** Custo de oportunidade do capital ao ano (%). */
  custoOportunidadeAaPct: number;
  /** Ano de aquisição analisado em detalhe. */
  ano: number;
  aliquotaPlenaPct?: number;
}

export interface MesCapex {
  mes: number;
  creditoIbsCbs: number;
  creditoIcms: number;
  creditoPisCofins: number;
  creditoIpi: number;
  creditoMes: number;
  acumulado: number;
}

export interface AnoCapex {
  ano: number;
  creditoIbsCbs: number;
  creditoIcmsTotal: number;
  creditoPisCofins: number;
  creditoIpi: number;
  /** Soma nominal de todos os créditos da aquisição. */
  creditoTotal: number;
  /** Parcela disponível já no primeiro mês. */
  creditoImediato: number;
  /** Parcela diluída em 48 meses (ICMS/CIAP). */
  creditoDiluido: number;
  /** Valor presente dos créditos ao custo de oportunidade informado. */
  vpl: number;
  /** Perda de valor pela diluição (nominal − valor presente). */
  perdaDiluicao: number;
  /** Custo líquido do ativo considerando o valor presente dos créditos. */
  custoLiquido: number;
  /** Meses até acumular 90% do crédito nominal. */
  meses90Pct: number;
}

export interface ResultadoCapex {
  ano: number;
  premissas: {
    aliquotaPlenaPct: number;
    icmsPct: number;
    ipiPct: number;
    fatorCiapPct: number;
    custoOportunidadeAaPct: number;
  };
  anoSelecionado: AnoCapex;
  /** Estudo de todos os anos de aquisição possíveis. */
  anos: AnoCapex[];
  /** Fluxo mensal acumulado do ano selecionado (48 meses). */
  fluxo: MesCapex[];
  /** Melhor janela de compra pelo valor presente do crédito. */
  melhorAno: number;
  ganhoVsPior: number;
  recomendacao: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const clampPct = (v: number) => Math.min(100, Math.max(0, Number(v) || 0)) / 100;

/** Créditos mês a mês (48 meses) de uma aquisição feita no ano informado. */
export function fluxoMensal(input: CapexInput, ano: number): MesCapex[] {
  const valor = Math.max(0, Number(input.valorInvestimento) || 0);
  const ciap = clampPct(input.fatorCiapPct);
  const plena = (input.aliquotaPlenaPct ?? ALIQUOTA_PLENA_PADRAO_PCT) / 100;

  // O Simples não apropria créditos de IBS/CBS nem de ICMS sobre o ativo.
  const creditaIbsCbs = input.regime !== "simples";
  const creditaIcms = input.regime !== "simples";
  const creditaPisCofins = input.regime === "real";

  const ibsCbs = creditaIbsCbs ? valor * plena * (FRACAO_IBSCBS[ano] ?? 1) : 0;
  const icmsTotal = creditaIcms
    ? valor * clampPct(input.icmsPct) * (FRACAO_ICMS[ano] ?? 0) * ciap
    : 0;
  const pisCofins =
    creditaPisCofins && creditoPisCofinsVigente(ano)
      ? valor * (PIS_COFINS_CREDITO_PCT / 100)
      : 0;
  const ipi =
    creditaPisCofins && creditoIpiVigente(ano) ? valor * clampPct(input.ipiPct) : 0;

  const parcelaIcms = icmsTotal / MESES_CIAP;
  const linhas: MesCapex[] = [];
  let acumulado = 0;

  for (let mes = 1; mes <= MESES_CIAP; mes += 1) {
    const cIbs = mes === 1 ? ibsCbs : 0;
    const cPis = mes === 1 ? pisCofins : 0;
    const cIpi = mes === 1 ? ipi : 0;
    const total = cIbs + cPis + cIpi + parcelaIcms;
    acumulado += total;
    linhas.push({
      mes,
      creditoIbsCbs: round2(cIbs),
      creditoIcms: round2(parcelaIcms),
      creditoPisCofins: round2(cPis),
      creditoIpi: round2(cIpi),
      creditoMes: round2(total),
      acumulado: round2(acumulado),
    });
  }

  return linhas;
}

function resumoAno(input: CapexInput, ano: number): AnoCapex {
  const fluxo = fluxoMensal(input, ano);
  const taxaMensal = Math.pow(1 + Math.max(0, Number(input.custoOportunidadeAaPct) || 0) / 100, 1 / 12) - 1;

  let vpl = 0;
  for (const l of fluxo) vpl += l.creditoMes / Math.pow(1 + taxaMensal, l.mes);

  const creditoIbsCbs = fluxo[0]?.creditoIbsCbs ?? 0;
  const creditoPisCofins = fluxo[0]?.creditoPisCofins ?? 0;
  const creditoIpi = fluxo[0]?.creditoIpi ?? 0;
  const creditoIcmsTotal = fluxo.reduce((s, l) => s + l.creditoIcms, 0);
  const creditoTotal = creditoIbsCbs + creditoPisCofins + creditoIpi + creditoIcmsTotal;
  const alvo = creditoTotal * 0.9;
  const meses90Pct = creditoTotal > 0 ? (fluxo.find((l) => l.acumulado >= alvo)?.mes ?? MESES_CIAP) : 0;

  return {
    ano,
    creditoIbsCbs: round2(creditoIbsCbs),
    creditoIcmsTotal: round2(creditoIcmsTotal),
    creditoPisCofins: round2(creditoPisCofins),
    creditoIpi: round2(creditoIpi),
    creditoTotal: round2(creditoTotal),
    creditoImediato: round2(creditoIbsCbs + creditoPisCofins + creditoIpi),
    creditoDiluido: round2(creditoIcmsTotal),
    vpl: round2(vpl),
    perdaDiluicao: round2(creditoTotal - vpl),
    custoLiquido: round2(Math.max(0, Number(input.valorInvestimento) || 0) - vpl),
    meses90Pct,
  };
}

export function calcularCapex(input: CapexInput): ResultadoCapex {
  const anos = ANOS_CAPEX.map((a) => resumoAno(input, a));
  const anoSelecionado = resumoAno(input, input.ano);

  const ordenados = [...anos].sort((a, b) => b.vpl - a.vpl);
  const melhor = ordenados[0];
  const pior = ordenados[ordenados.length - 1];
  const melhorAno = melhor?.ano ?? input.ano;
  const ganhoVsPior = round2((melhor?.vpl ?? 0) - (pior?.vpl ?? 0));

  const recomendacao =
    input.regime === "simples"
      ? "No Simples Nacional a aquisição não gera crédito de IBS/CBS nem de ICMS sobre o ativo; avalie o impacto de migrar de regime antes de investir."
      : melhorAno === input.ano
        ? `O ano escolhido (${input.ano}) é a melhor janela entre as analisadas: o valor presente do crédito é o mais alto.`
        : `Adquirir em ${melhorAno} traz o maior valor presente de crédito — diferença de aproximadamente ${ganhoVsPior.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} frente ao pior ano analisado.`;

  return {
    ano: input.ano,
    premissas: {
      aliquotaPlenaPct: input.aliquotaPlenaPct ?? ALIQUOTA_PLENA_PADRAO_PCT,
      icmsPct: input.icmsPct,
      ipiPct: input.ipiPct,
      fatorCiapPct: input.fatorCiapPct,
      custoOportunidadeAaPct: input.custoOportunidadeAaPct,
    },
    anoSelecionado,
    anos,
    fluxo: fluxoMensal(input, input.ano),
    melhorAno,
    ganhoVsPior,
    recomendacao,
  };
}
