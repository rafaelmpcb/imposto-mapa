/**
 * Apuração do valor líquido de IBS/CBS a recolher no cenário pós-reforma.
 *
 * Líquido = débitos apurados nas vendas (serviços prestados + mercadorias vendidas)
 * menos os créditos apurados nas compras (serviços tomados + mercadorias adquiridas).
 *
 * Itens com classificação ambígua (fila de revisão do analista) NÃO entram em
 * nenhuma das somas — ficam contabilizados à parte, para que o resultado deixe
 * claro quanto ainda depende de decisão humana.
 */

export const ANO_APURACAO = 2026;

/** Alíquotas nominais do ano de transição, em pontos percentuais. */
export const ALIQUOTA_NOMINAL_PP: Record<number, { ibs: number; cbs: number }> = {
  2026: { ibs: 0.1, cbs: 0.9 },
};

export const round2 = (v: number) => Math.round(v * 100) / 100;

export type StatusApurado = string;

/** Item genérico de débito ou crédito já apurado. */
export interface ItemApurado {
  valorBase: number;
  valorTributo: number;
  status: StatusApurado;
}

export const PENDENTE_REVISAO = "ambiguo_revisao_pendente";

export interface BlocoApuracao {
  /** Soma dos tributos dos itens considerados. */
  total: number;
  /** Base (valor dos itens) considerada. */
  base: number;
  /** Quantidade de itens somados. */
  itens: number;
  /** Itens fora da soma por estarem na fila de revisão. */
  pendentes: number;
  /** Base dos itens pendentes de revisão. */
  basePendente: number;
  /** Itens sem valor apurado (sem dado, regime específico, imposto seletivo). */
  semValor: number;
  /** Verdadeiro quando o bloco foi estimado por alíquota nominal, sem detalhe item a item. */
  estimado?: boolean;
}

export function somar(itens: ItemApurado[], estimado = false): BlocoApuracao {
  const bloco: BlocoApuracao = {
    total: 0,
    base: 0,
    itens: 0,
    pendentes: 0,
    basePendente: 0,
    semValor: 0,
    estimado,
  };
  for (const i of itens) {
    if (i.status === PENDENTE_REVISAO) {
      bloco.pendentes += 1;
      bloco.basePendente = round2(bloco.basePendente + i.valorBase);
      continue;
    }
    bloco.itens += 1;
    bloco.base = round2(bloco.base + i.valorBase);
    bloco.total = round2(bloco.total + i.valorTributo);
    if (i.valorTributo === 0) bloco.semValor += 1;
  }
  return bloco;
}

/** Débito estimado de mercadorias vendidas, quando só existe o total da nota. */
export function debitoEstimadoMercadorias(
  valorTotal: number,
  ano: number = ANO_APURACAO,
): number {
  const a = ALIQUOTA_NOMINAL_PP[ano] ?? ALIQUOTA_NOMINAL_PP[ANO_APURACAO]!;
  return round2((valorTotal * (a.ibs + a.cbs)) / 100);
}

export interface ApuracaoLiquida {
  ano: number;
  debitoServicos: BlocoApuracao;
  debitoMercadorias: BlocoApuracao;
  creditoServicos: BlocoApuracao;
  creditoMercadorias: BlocoApuracao;
  /** Soma dos débitos considerados. */
  debitoTotal: number;
  /** Soma dos créditos considerados. */
  creditoTotal: number;
  /** Débito menos crédito; negativo significa saldo credor a transportar. */
  liquido: number;
  /** Itens pendentes de revisão em todos os blocos. */
  pendentesTotal: number;
  /** Verdadeiro quando algum bloco entrou por estimativa. */
  temEstimativa: boolean;
  /** Verdadeiro quando não há nenhum documento apurado. */
  vazio: boolean;
}

export function apurarLiquido(input: {
  ano?: number;
  debitoServicos: ItemApurado[];
  debitoMercadorias: ItemApurado[];
  creditoServicos: ItemApurado[];
  creditoMercadorias: ItemApurado[];
  /** Mercadorias vendidas entram por estimativa (só o total da nota). */
  mercadoriasEstimadas?: boolean;
}): ApuracaoLiquida {
  const ano = input.ano ?? ANO_APURACAO;
  const debitoServicos = somar(input.debitoServicos);
  const debitoMercadorias = somar(input.debitoMercadorias, input.mercadoriasEstimadas ?? false);
  const creditoServicos = somar(input.creditoServicos);
  const creditoMercadorias = somar(input.creditoMercadorias);

  const debitoTotal = round2(debitoServicos.total + debitoMercadorias.total);
  const creditoTotal = round2(creditoServicos.total + creditoMercadorias.total);
  const blocos = [debitoServicos, debitoMercadorias, creditoServicos, creditoMercadorias];

  return {
    ano,
    debitoServicos,
    debitoMercadorias,
    creditoServicos,
    creditoMercadorias,
    debitoTotal,
    creditoTotal,
    liquido: round2(debitoTotal - creditoTotal),
    pendentesTotal: blocos.reduce((acc, b) => acc + b.pendentes, 0),
    temEstimativa: blocos.some((b) => b.estimado && b.itens > 0),
    vazio: blocos.every((b) => b.itens === 0 && b.pendentes === 0),
  };
}
