/**
 * Reequilíbrio econômico de contratos de prestação continuada sob o IBS/CBS.
 *
 * Módulo puro e independente do simulador de impacto fiscal: recebe os dados
 * do contrato e devolve os três cenários de negociação (preservar a margem do
 * prestador, preservar o custo do contratante e o ponto de equilíbrio).
 * Nada aqui é recomendação comercial — é o piso técnico da renegociação.
 */

export type RegimePrestador = "real" | "presumido" | "simples";
export type PerfilContratante = "regular" | "simples" | "consumidor_final";
export type CenarioId = "margem_prestador" | "custo_contratante" | "equilibrio";
export type PapelContrato = "prestador" | "contratante";

export const REGIME_PRESTADOR_LABEL: Record<RegimePrestador, string> = {
  real: "Prestador — Lucro Real",
  presumido: "Prestador — Lucro Presumido",
  simples: "Prestador — Simples Nacional",
};

export const PERFIL_CONTRATANTE_LABEL: Record<PerfilContratante, string> = {
  regular: "Contratante em regime regular (toma crédito integral)",
  simples: "Contratante no Simples Nacional (não toma crédito)",
  consumidor_final: "Consumidor final (não toma crédito)",
};

export const CENARIO_LABEL: Record<CenarioId, string> = {
  margem_prestador: "A — Preservar a margem do prestador",
  custo_contratante: "B — Preservar o custo do contratante",
  equilibrio: "C — Ponto de equilíbrio (impacto dividido)",
};

export const PAPEL_LABEL: Record<PapelContrato, string> = {
  prestador: "Sou o prestador do serviço",
  contratante: "Sou o contratante do serviço",
};

export interface PremissasPrestador {
  /** Tributos de hoje substituídos pelo IBS/CBS (PIS/COFINS/ISS), em % do preço. */
  substituidaPct: number;
  /** Tributos de hoje que permanecem (IRPJ/CSLL ou IRPJ/CSLL dentro do DAS), em % do preço. */
  mantidaPct: number;
  /** O prestador destaca IBS/CBS aproveitável pelo contratante. */
  destacaIbsCbs: boolean;
  nota: string;
}

/** Premissas ESTIMADAS por regime — todas editáveis na tela. */
export const PREMISSAS_PRESTADOR: Record<RegimePrestador, PremissasPrestador> = {
  real: {
    substituidaPct: 14.25,
    mantidaPct: 10,
    destacaIbsCbs: true,
    nota: "PIS/COFINS não cumulativos (9,25%) e ISS estimado em 5% substituídos; IRPJ/CSLL estimados sobre o resultado.",
  },
  presumido: {
    substituidaPct: 8.65,
    mantidaPct: 10.88,
    destacaIbsCbs: true,
    nota: "PIS/COFINS cumulativos (3,65%) e ISS estimado em 5% substituídos; IRPJ/CSLL com presunção de 32% da receita.",
  },
  simples: {
    substituidaPct: 6,
    mantidaPct: 4.5,
    destacaIbsCbs: false,
    nota: "No Simples o IBS/CBS fica dentro do DAS; pela convenção adotada, não transfere crédito cheio ao contratante.",
  },
};

export const APROVEITAMENTO_CONTRATANTE: Record<PerfilContratante, number> = {
  regular: 100,
  simples: 0,
  consumidor_final: 0,
};

export const ALIQUOTA_PLENA_PADRAO_PCT = 26.5;

/** Fração ESTIMADA da alíquota plena em cada ano da transição. */
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
  "Cálculo estimativo de apoio à negociação contratual. A alíquota plena, as reduções setoriais e a rampa de transição dependem de regulamentação e podem mudar.";

export const AVISO_CLAUSULA =
  "A minuta sugerida é um ponto de partida de redação; a cláusula final deve ser revisada frente ao contrato vigente e ao equilíbrio original da avença.";

export interface ContratoInput {
  /** Preço mensal pago hoje pelo contratante. */
  precoMensalAtual: number;
  regimePrestador: RegimePrestador;
  perfilContratante: PerfilContratante;
  /** Custo direto do prestador em % do preço (folha, subcontratação, materiais). */
  custoDiretoPct: number;
  /** Quanto dos custos diretos gera crédito de IBS/CBS ao prestador (0 a 100). */
  creditoInsumosPct: number;
  ano: number;
  cenario: CenarioId;
  aliquotaPlenaPct?: number;
  /** Redução setorial sobre a alíquota plena (0 a 100). */
  reducaoPct?: number;
  substituidaPct?: number;
  mantidaPct?: number;
  /** Sobrepõe o aproveitamento de crédito do contratante (0 a 100). */
  aproveitamentoContratantePct?: number;
}

export interface CenarioContrato {
  id: "atual" | "sem_reequilibrio" | CenarioId;
  label: string;
  /** Preço total pago pelo contratante. */
  precoContrato: number;
  /** Base da operação, sem o IBS/CBS por fora. */
  baseOperacao: number;
  ibsCbs: number;
  tributosMantidos: number;
  custoDireto: number;
  creditoInsumos: number;
  margemPrestador: number;
  creditoContratante: number;
  custoLiquidoContratante: number;
}

export type Semaforo = "baixo" | "medio" | "alto";

export interface ResultadoContrato {
  ano: number;
  fracao: number;
  aliquotaEfetivaPct: number;
  cenarioEscolhido: CenarioId;
  premissas: {
    substituidaPct: number;
    mantidaPct: number;
    aliquotaPlenaPct: number;
    reducaoPct: number;
    aproveitamentoContratantePct: number;
  };
  atual: CenarioContrato;
  semReequilibrio: CenarioContrato;
  cenarios: {
    id: CenarioId;
    label: string;
    precoSugerido: number;
    variacaoPrecoPct: number;
    variacaoMargemPct: number;
    variacaoCustoContratantePct: number;
    /** Parcela do aumento absorvida pelo crédito do contratante, em R$. */
    aumentoAbsorvidoPorCredito: number;
    detalhe: CenarioContrato;
  }[];
  evolucao: {
    ano: number;
    precoSugerido: number;
    variacaoPct: number;
    margemPrestador: number;
    custoLiquidoContratante: number;
  }[];
  semaforo: Semaforo;
  avisos: string[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const pctVar = (novo: number, base: number) => (base > 0 ? ((novo - base) / base) * 100 : 0);
const clampPct = (v: number) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));

export const fracaoDoAno = (ano: number): number => FRACAO_TRANSICAO[ano] ?? 1;

/** Alíquota de IBS/CBS aplicável ao contrato no ano, já com redução e rampa. */
export function aliquotaEfetiva(input: ContratoInput, ano: number): number {
  const plena = (input.aliquotaPlenaPct ?? ALIQUOTA_PLENA_PADRAO_PCT) / 100;
  const reducao = 1 - clampPct(input.reducaoPct ?? 0) / 100;
  return plena * reducao * fracaoDoAno(ano);
}

const substDe = (i: ContratoInput) =>
  (i.substituidaPct ?? PREMISSAS_PRESTADOR[i.regimePrestador].substituidaPct) / 100;
const mantidaDe = (i: ContratoInput) =>
  (i.mantidaPct ?? PREMISSAS_PRESTADOR[i.regimePrestador].mantidaPct) / 100;
const aprovDe = (i: ContratoInput) => {
  const base =
    i.aproveitamentoContratantePct ?? APROVEITAMENTO_CONTRATANTE[i.perfilContratante];
  const destaca = PREMISSAS_PRESTADOR[i.regimePrestador].destacaIbsCbs;
  return destaca ? clampPct(base) / 100 : 0;
};

/** Cenário de hoje: sem IBS/CBS, com os tributos atuais do regime. */
export function cenarioAtual(input: ContratoInput): CenarioContrato {
  const preco = Math.max(0, Number(input.precoMensalAtual) || 0);
  const subst = substDe(input);
  const mantida = mantidaDe(input);
  const custoDireto = preco * (clampPct(input.custoDiretoPct) / 100);
  const tributosMantidos = preco * mantida;
  return {
    id: "atual",
    label: "Contrato hoje",
    precoContrato: round2(preco),
    baseOperacao: round2(preco),
    ibsCbs: round2(preco * subst),
    tributosMantidos: round2(tributosMantidos),
    custoDireto: round2(custoDireto),
    creditoInsumos: 0,
    margemPrestador: round2(preco - preco * subst - tributosMantidos - custoDireto),
    creditoContratante: 0,
    custoLiquidoContratante: round2(preco),
  };
}

function cenarioNoAno(
  input: ContratoInput,
  ano: number,
  precoContrato: number,
  id: CenarioContrato["id"],
  label: string,
): CenarioContrato {
  const e = aliquotaEfetiva(input, ano);
  const mantida = mantidaDe(input);
  const aprov = aprovDe(input);
  const custoDireto = Math.max(0, Number(input.precoMensalAtual) || 0) * (clampPct(input.custoDiretoPct) / 100);
  const creditoInsumos = custoDireto * (clampPct(input.creditoInsumosPct) / 100) * e;

  const base = precoContrato / (1 + e);
  const ibsCbs = base * e;
  const tributosMantidos = base * mantida;
  const creditoContratante = ibsCbs * aprov;

  return {
    id,
    label,
    precoContrato: round2(precoContrato),
    baseOperacao: round2(base),
    ibsCbs: round2(ibsCbs),
    tributosMantidos: round2(tributosMantidos),
    custoDireto: round2(custoDireto),
    creditoInsumos: round2(creditoInsumos),
    margemPrestador: round2(base - tributosMantidos - custoDireto + creditoInsumos),
    creditoContratante: round2(creditoContratante),
    custoLiquidoContratante: round2(precoContrato - creditoContratante),
  };
}

/** Preço que atende ao cenário escolhido no ano informado. */
export function precoSugerido(
  input: ContratoInput,
  ano: number,
  atual: CenarioContrato,
  cenario: CenarioId,
): number {
  const e = aliquotaEfetiva(input, ano);
  const mantida = mantidaDe(input);
  const aprov = aprovDe(input);
  const custoDireto = atual.custoDireto;
  const creditoInsumos = custoDireto * (clampPct(input.creditoInsumosPct) / 100) * e;

  if (cenario === "equilibrio") {
    const a = precoSugerido(input, ano, atual, "margem_prestador");
    const b = precoSugerido(input, ano, atual, "custo_contratante");
    return (a + b) / 2;
  }

  if (cenario === "margem_prestador") {
    if (mantida >= 1) return atual.precoContrato;
    const base = (atual.margemPrestador + custoDireto - creditoInsumos) / (1 - mantida);
    return Math.max(0, base * (1 + e));
  }

  const divisor = 1 + e * (1 - aprov);
  if (divisor <= 0) return atual.precoContrato;
  const base = atual.custoLiquidoContratante / divisor;
  return Math.max(0, base * (1 + e));
}

function semaforoDe(variacaoPct: number): Semaforo {
  const v = Math.abs(variacaoPct);
  if (v < 5) return "baixo";
  if (v <= 15) return "medio";
  return "alto";
}

export function calcularContrato(input: ContratoInput): ResultadoContrato {
  const ano = input.ano;
  const atual = cenarioAtual(input);
  const semReequilibrio = cenarioNoAno(
    input,
    ano,
    atual.precoContrato,
    "sem_reequilibrio",
    "Mesmo preço, já sob IBS/CBS",
  );

  const ids: CenarioId[] = ["margem_prestador", "custo_contratante", "equilibrio"];
  const cenarios = ids.map((id) => {
    const preco = precoSugerido(input, ano, atual, id);
    const detalhe = cenarioNoAno(input, ano, preco, id, CENARIO_LABEL[id]);
    const aumento = detalhe.precoContrato - atual.precoContrato;
    return {
      id,
      label: CENARIO_LABEL[id],
      precoSugerido: detalhe.precoContrato,
      variacaoPrecoPct: round2(pctVar(detalhe.precoContrato, atual.precoContrato)),
      variacaoMargemPct: round2(pctVar(detalhe.margemPrestador, atual.margemPrestador)),
      variacaoCustoContratantePct: round2(
        pctVar(detalhe.custoLiquidoContratante, atual.custoLiquidoContratante),
      ),
      aumentoAbsorvidoPorCredito: round2(Math.min(Math.max(aumento, 0), detalhe.creditoContratante)),
      detalhe,
    };
  });

  const evolucao = ANOS_DISPONIVEIS.map((a) => {
    const preco = precoSugerido(input, a, atual, input.cenario);
    const det = cenarioNoAno(input, a, preco, input.cenario, CENARIO_LABEL[input.cenario]);
    return {
      ano: a,
      precoSugerido: det.precoContrato,
      variacaoPct: round2(pctVar(det.precoContrato, atual.precoContrato)),
      margemPrestador: det.margemPrestador,
      custoLiquidoContratante: det.custoLiquidoContratante,
    };
  });

  const escolhido = cenarios.find((c) => c.id === input.cenario) ?? cenarios[0]!;

  const avisos: string[] = [AVISO_ESTIMATIVA, AVISO_CLAUSULA];
  if (!PREMISSAS_PRESTADOR[input.regimePrestador].destacaIbsCbs) {
    avisos.push(
      "Prestador no Simples Nacional: pela convenção adotada o contratante não aproveita crédito cheio, então o aumento tende a ser sentido integralmente.",
    );
  }
  if (input.perfilContratante !== "regular") {
    avisos.push(
      "O contratante não recupera o IBS/CBS como crédito — o reajuste nominal é sentido de forma integral e a negociação tende a ser mais dura.",
    );
  }

  return {
    ano,
    fracao: fracaoDoAno(ano),
    aliquotaEfetivaPct: round2(aliquotaEfetiva(input, ano) * 100),
    cenarioEscolhido: input.cenario,
    premissas: {
      substituidaPct: round2(substDe(input) * 100),
      mantidaPct: round2(mantidaDe(input) * 100),
      aliquotaPlenaPct: input.aliquotaPlenaPct ?? ALIQUOTA_PLENA_PADRAO_PCT,
      reducaoPct: clampPct(input.reducaoPct ?? 0),
      aproveitamentoContratantePct: round2(aprovDe(input) * 100),
    },
    atual,
    semReequilibrio,
    cenarios,
    evolucao,
    semaforo: semaforoDe(escolhido.variacaoPrecoPct),
    avisos,
  };
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Minuta de cláusula de revisão de preço por alteração tributária. */
export function minutaClausula(r: ResultadoContrato, titulo: string): string {
  const c = r.cenarios.find((x) => x.id === r.cenarioEscolhido) ?? r.cenarios[0]!;
  return [
    `CLÁUSULA DE REEQUILÍBRIO ECONÔMICO-FINANCEIRO (IBS/CBS) — ${titulo || "Contrato de prestação continuada"}`,
    "",
    "1. As partes reconhecem que o preço ora ajustado foi formado com base na carga tributária vigente na data da contratação.",
    "2. A implantação do IBS e da CBS, nos termos da EC 132/2023 e da LC 214/2025, com substituição de PIS, COFINS e ISS e destaque do tributo por fora, constitui fato superveniente apto a justificar a revisão do preço para restabelecimento do equilíbrio original.",
    `3. Para o exercício de ${r.ano}, considerada a alíquota efetiva estimada de ${r.aliquotaEfetivaPct.toFixed(2)}%, o preço mensal passa de ${brl(r.atual.precoContrato)} para ${brl(c.precoSugerido)}, variação de ${c.variacaoPrecoPct.toFixed(2)}%.`,
    "4. O preço será revisto anualmente, na mesma data-base, acompanhando a evolução das alíquotas do período de transição, mediante simples comunicação escrita instruída com a memória de cálculo.",
    "5. O valor do IBS e da CBS será destacado em documento fiscal, ficando assegurado ao CONTRATANTE, quando for o caso, o direito à apropriação integral do crédito correspondente.",
    "6. A recusa injustificada à revisão autoriza a parte prejudicada a promover a renegociação ou a resilição do contrato, na forma da lei.",
  ].join("\n");
}

/** Texto de notificação para abertura da renegociação. */
export function minutaNotificacao(r: ResultadoContrato, titulo: string, contraparte: string): string {
  const c = r.cenarios.find((x) => x.id === r.cenarioEscolhido) ?? r.cenarios[0]!;
  const absorvido =
    c.aumentoAbsorvidoPorCredito > 0
      ? ` Do acréscimo proposto, aproximadamente ${brl(c.aumentoAbsorvidoPorCredito)} retornam a essa parte na forma de crédito de IBS/CBS, de modo que o custo líquido permanece praticamente inalterado.`
      : "";
  return [
    `Assunto: Revisão de preço do contrato ${titulo || "de prestação continuada"} — reforma tributária (IBS/CBS)`,
    "",
    `Prezados${contraparte ? ` — ${contraparte}` : ""},`,
    "",
    `Comunicamos a necessidade de revisão do preço do contrato em referência em razão da entrada em vigor do IBS e da CBS, que substituem PIS, COFINS e ISS e passam a ser destacados por fora do preço.`,
    `Com base na carga estimada para ${r.ano} (alíquota efetiva de ${r.aliquotaEfetivaPct.toFixed(2)}%), o preço mensal necessário para preservar o equilíbrio original é de ${brl(c.precoSugerido)}, ante os atuais ${brl(r.atual.precoContrato)} — variação de ${c.variacaoPrecoPct.toFixed(2)}%.${absorvido}`,
    "",
    "Seguem em anexo a memória de cálculo e a minuta do aditivo. Colocamo-nos à disposição para tratar do tema em reunião.",
    "",
    "Atenciosamente,",
  ].join("\n");
}
