/**
 * Recuperação de crédito tributário de PIS/COFINS monofásico — calculadora ESTIMATIVA.
 *
 * Produtos monofásicos (combustíveis, medicamentos, perfumaria, bebidas frias,
 * autopeças, entre outros — Leis 10.147/2000, 10.485/2002, 10.865/2004 e
 * art. 25, §1º, I da LC 123/2006 para o Simples Nacional) têm PIS/COFINS
 * recolhido de forma concentrada na indústria/importador. O revendedor aplica
 * alíquota zero. Quando o varejista tributa novamente essas receitas, paga a
 * maior e pode pedir restituição/compensação dos últimos 60 meses.
 *
 * Este módulo é puro e estimativo: a apuração definitiva exige leitura dos XMLs
 * de venda item a item e cruzamento com a tabela oficial de NCMs monofásicos.
 */

export type SegmentoMonofasico =
  | "farmacia"
  | "autopecas"
  | "posto"
  | "conveniencia"
  | "perfumaria"
  | "supermercado"
  | "petshop"
  | "outro";

export type RegimeMonofasico = "simples" | "presumido" | "real";

export const PRESCRICAO_MESES = 60;

export const AVISO_MONOFASICO =
  "Estimativa comercial de viabilidade. O valor efetivamente recuperável depende da segregação das receitas produto a produto (NCM) nos XMLs de venda e na escrituração, da ausência de compensações anteriores e da homologação pela Receita Federal.";

export interface SegmentoPreset {
  id: SegmentoMonofasico;
  label: string;
  /** Participação média estimada de produtos monofásicos na receita (%). */
  participacaoPct: number;
  exemplos: string;
}

export const SEGMENTOS: SegmentoPreset[] = [
  {
    id: "farmacia",
    label: "Farmácia e drogaria",
    participacaoPct: 45,
    exemplos: "Medicamentos de uso humano, higiene pessoal, perfumaria e cosméticos",
  },
  {
    id: "autopecas",
    label: "Autopeças e acessórios",
    participacaoPct: 60,
    exemplos: "Peças e componentes automotivos dos Anexos I e II da Lei 10.485/2002",
  },
  {
    id: "posto",
    label: "Posto de combustíveis",
    participacaoPct: 88,
    exemplos: "Gasolina, diesel, GLP e álcool — tributação concentrada na refinaria",
  },
  {
    id: "conveniencia",
    label: "Conveniência, bar e distribuidora de bebidas",
    participacaoPct: 35,
    exemplos: "Cervejas, refrigerantes, águas e demais bebidas frias",
  },
  {
    id: "perfumaria",
    label: "Perfumaria e cosméticos",
    participacaoPct: 55,
    exemplos: "Perfumes, cremes, xampus e produtos de toucador",
  },
  {
    id: "supermercado",
    label: "Supermercado e mercearia",
    participacaoPct: 15,
    exemplos: "Bebidas frias, higiene e limpeza dentro de um mix majoritariamente tributado",
  },
  {
    id: "petshop",
    label: "Pet shop e agropecuária",
    participacaoPct: 20,
    exemplos: "Medicamentos veterinários e produtos de higiene animal",
  },
  {
    id: "outro",
    label: "Outro segmento",
    participacaoPct: 0,
    exemplos: "Informe manualmente a participação estimada de produtos monofásicos",
  },
];

export const REGIMES: { id: RegimeMonofasico; label: string; hint: string }[] = [
  {
    id: "simples",
    label: "Simples Nacional",
    hint: "PIS/COFINS embutidos no DAS — segregação da receita monofásica no PGDAS-D",
  },
  {
    id: "presumido",
    label: "Lucro Presumido (cumulativo)",
    hint: "PIS 0,65% + COFINS 3,00% = 3,65% sobre a receita",
  },
  {
    id: "real",
    label: "Lucro Real (não cumulativo)",
    hint: "PIS 1,65% + COFINS 7,60% = 9,25% sobre a receita",
  },
];

/** Alíquota conjunta de PIS/COFINS fora do Simples Nacional (%). */
export const ALIQUOTA_REGIME: Record<Exclude<RegimeMonofasico, "simples">, number> = {
  presumido: 3.65,
  real: 9.25,
};

/** Participação de PIS/COFINS dentro do DAS, por anexo (%) — referência LC 123/2006. */
export const PARCELA_DAS_ANEXOS = [
  { label: "Anexo I — Comércio", valor: 15.5 },
  { label: "Anexo II — Indústria", valor: 14.05 },
  { label: "Anexo III — Serviços", valor: 15.68 },
];

export interface MonofasicoInput {
  segmento: SegmentoMonofasico;
  regime: RegimeMonofasico;
  /** Faturamento bruto mensal médio (R$). */
  faturamentoMensal: number;
  /** Participação da receita monofásica no faturamento (%). */
  participacaoMonofasicaPct: number;
  /** Simples: alíquota efetiva média do DAS (%). */
  aliquotaEfetivaDasPct: number;
  /** Simples: participação de PIS/COFINS dentro do DAS (%). */
  parcelaPisCofinsPct: number;
  /** Meses retroativos considerados (máximo 60). */
  mesesRetroativos: number;
  /** Taxa de correção do indébito — Selic acumulada (% ao ano). */
  selicAaPct: number;
  /** Honorário de êxito sobre o valor recuperado (%). */
  honorarioExitoPct: number;
}

export interface AnoRecuperacao {
  rotulo: string;
  meses: number;
  principal: number;
  correcao: number;
  total: number;
}

export interface ResultadoMonofasico {
  premissas: {
    aliquotaEfetivaPisCofinsPct: number;
    participacaoMonofasicaPct: number;
    mesesRetroativos: number;
    selicAaPct: number;
  };
  receitaMonofasicaMensal: number;
  /** Tributo pago a maior por mês (R$). */
  pagoAMaiorMensal: number;
  principalPeriodo: number;
  correcaoSelic: number;
  totalRecuperavel: number;
  honorario: number;
  liquidoCliente: number;
  /** Economia recorrente daqui para a frente. */
  economiaMensal: number;
  economiaAnual: number;
  /** Ganho total no primeiro ano: recuperado + economia dos 12 meses seguintes. */
  ganhoPrimeiroAno: number;
  porAno: AnoRecuperacao[];
  leitura: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const naoNeg = (v: unknown) => Math.max(0, Number(v) || 0);
const limitePct = (v: unknown) => Math.min(100, naoNeg(v));

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Alíquota efetiva de PIS/COFINS incidente sobre a receita, conforme o regime (%). */
export function aliquotaEfetiva(input: MonofasicoInput): number {
  if (input.regime === "simples") {
    return (naoNeg(input.aliquotaEfetivaDasPct) * limitePct(input.parcelaPisCofinsPct)) / 100;
  }
  return ALIQUOTA_REGIME[input.regime];
}

export function calcularMonofasico(input: MonofasicoInput): ResultadoMonofasico {
  const faturamento = naoNeg(input.faturamentoMensal);
  const participacao = limitePct(input.participacaoMonofasicaPct);
  const meses = Math.min(PRESCRICAO_MESES, Math.max(0, Math.round(naoNeg(input.mesesRetroativos))));
  const aliq = aliquotaEfetiva(input);
  const selicMensal = naoNeg(input.selicAaPct) / 100 / 12;

  const receitaMonofasica = (faturamento * participacao) / 100;
  const pagoAMaiorMensal = (receitaMonofasica * aliq) / 100;

  let principal = 0;
  let correcao = 0;
  const porAno: AnoRecuperacao[] = [];
  let bucketPrincipal = 0;
  let bucketCorrecao = 0;
  let bucketMeses = 0;
  let faixa = 1;

  // Mês 1 = mais antigo do período (corrige por mais tempo).
  for (let i = meses; i >= 1; i -= 1) {
    const corr = pagoAMaiorMensal * selicMensal * i;
    principal += pagoAMaiorMensal;
    correcao += corr;
    bucketPrincipal += pagoAMaiorMensal;
    bucketCorrecao += corr;
    bucketMeses += 1;
    if (bucketMeses === 12 || i === 1) {
      porAno.push({
        rotulo: `Período ${faixa} (meses ${(faixa - 1) * 12 + 1}–${(faixa - 1) * 12 + bucketMeses})`,
        meses: bucketMeses,
        principal: round2(bucketPrincipal),
        correcao: round2(bucketCorrecao),
        total: round2(bucketPrincipal + bucketCorrecao),
      });
      faixa += 1;
      bucketPrincipal = 0;
      bucketCorrecao = 0;
      bucketMeses = 0;
    }
  }

  const total = principal + correcao;
  const honorario = (total * limitePct(input.honorarioExitoPct)) / 100;
  const economiaAnual = pagoAMaiorMensal * 12;

  const leitura =
    faturamento <= 0 || participacao <= 0
      ? "Informe o faturamento e a participação de produtos monofásicos para ver a estimativa."
      : `Com ${participacao.toFixed(0)}% da receita em produtos monofásicos, a empresa estaria recolhendo cerca de ${fmt(pagoAMaiorMensal)} por mês de PIS/COFINS sobre receitas de alíquota zero. Em ${meses} meses isso representa ${fmt(total)} já com correção pela Selic, além de ${fmt(economiaAnual)} por ano de economia daqui para a frente.`;

  return {
    premissas: {
      aliquotaEfetivaPisCofinsPct: round2(aliq),
      participacaoMonofasicaPct: participacao,
      mesesRetroativos: meses,
      selicAaPct: naoNeg(input.selicAaPct),
    },
    receitaMonofasicaMensal: round2(receitaMonofasica),
    pagoAMaiorMensal: round2(pagoAMaiorMensal),
    principalPeriodo: round2(principal),
    correcaoSelic: round2(correcao),
    totalRecuperavel: round2(total),
    honorario: round2(honorario),
    liquidoCliente: round2(total - honorario),
    economiaMensal: round2(pagoAMaiorMensal),
    economiaAnual: round2(economiaAnual),
    ganhoPrimeiroAno: round2(total - honorario + economiaAnual),
    porAno,
    leitura,
  };
}

/** Etapas do serviço de recuperação apresentadas ao cliente. */
export const FASES_MONOFASICO = [
  {
    titulo: "Fase 1 — Levantamento e prova",
    descricao:
      "Leitura dos XMLs de venda dos últimos 60 meses, classificação item a item por NCM e confronto com a tabela oficial de produtos monofásicos, EFD-Contribuições e PGDAS-D.",
  },
  {
    titulo: "Fase 2 — Retificação e habilitação do crédito",
    descricao:
      "Retificação das obrigações acessórias do período, apuração do indébito corrigido pela Selic e formalização do pedido de restituição ou da declaração de compensação.",
  },
  {
    titulo: "Fase 3 — Compensação e ajuste prospectivo",
    descricao:
      "Acompanhamento da homologação, uso do crédito em compensações e ajuste da segregação de receitas para parar a perda mensal daqui para a frente.",
  },
] as const;
