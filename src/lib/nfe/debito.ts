/**
 * Débito de IBS/CBS por item de nota de venda (mercadoria).
 * Espelha a lógica de crédito das notas de compra: quando o XML já traz o bloco
 * IBSCBS, os valores vêm prontos da nota; quando não traz, o débito é apurado
 * pela alíquota nominal do ano, reduzida conforme a tabela de exceções por NCM.
 */

import {
  aliquotaNominal,
  creditoPorNcm,
  round2,
  ANO_VIGENTE_CREDITO,
  FONTE_GERAL,
  FONTE_MULTI_IGUAL,
  FONTE_UNICO,
  type ItemStatus,
  type NcmExcecao,
  type OpcaoCandidata,
} from "@/lib/nfe/credito";

export const FONTE_XML_VENDA = "IBSCBS do XML (venda)";

export const FONTE_VENDA_GERAL = FONTE_GERAL;
export const FONTE_VENDA_UNICO = FONTE_UNICO;
export const FONTE_VENDA_MULTI_IGUAL = FONTE_MULTI_IGUAL;

export interface DebitoCalculado {
  cclasstrib: string | null;
  baseCalculo: number;
  debito: number;
  fonte: string;
  status: ItemStatus;
  opcoes: OpcaoCandidata[];
}

/**
 * Débito de um item de venda sem bloco IBSCBS, usando a mesma tabela de
 * exceções por NCM já importada pelo fluxo de compras.
 */
export function debitoPorNcm(
  valorItem: number,
  descricao: string | null,
  linhas: NcmExcecao[],
  ano: number = ANO_VIGENTE_CREDITO,
): DebitoCalculado {
  const calc = creditoPorNcm(valorItem, descricao, linhas, ano);
  return {
    cclasstrib: calc.cclasstrib,
    baseCalculo: calc.baseCalculo,
    debito: calc.credito,
    fonte: calc.fonte,
    status: calc.status,
    opcoes: calc.opcoes,
  };
}

/** Débito a partir da redução escolhida manualmente pelo analista. */
export function debitoComReducao(
  valorItem: number,
  reducaoPct: number,
  ano: number = ANO_VIGENTE_CREDITO,
): number {
  const nominal = aliquotaNominal(ano);
  const total = nominal.cbs + nominal.ibsUf + nominal.ibsMun;
  return round2(valorItem * total * (1 - reducaoPct / 100));
}
