/**
 * Crédito de IBS/CBS por serviço tomado (NFS-e).
 * Quando o próprio documento já traz a classificação tributária (cClassTrib e
 * valores de IBS/CBS), os valores vêm prontos da nota. Quando não traz, o
 * crédito é estimado pela tabela de exceções por NBS (Anexo VIII v1.01.00).
 */

export type ServicoItemStatus =
  | "ok"
  | "ambiguo_revisao_pendente"
  | "regime_especifico"
  | "sem_dado";

export interface NbsExcecao {
  nbs: string;
  item_nbs: string;
  descricao_nbs: string;
  cclasstrib: string | null;
  grupo_cclasstrib: string | null;
  nome_cclasstrib: string;
  aliquota_ibs_2026: number;
  aliquota_cbs_2026: number;
  regime_especifico_sem_aliquota_simples: boolean;
  n_cclasstrib_por_nbs: number;
  requer_revisao_humana: boolean;
}

export interface OpcaoServico {
  cclasstrib: string | null;
  nome_cclasstrib: string;
  grupo_cclasstrib: string | null;
  aliquota_ibs_2026: number;
  aliquota_cbs_2026: number;
}

/** Alíquotas nominais do ano de transição, em pontos percentuais. */
export const ALIQUOTAS_NOMINAIS_NBS: Record<number, { ibs: number; cbs: number }> = {
  2026: { ibs: 0.1, cbs: 0.9 },
};

export const ANO_VIGENTE_NBS = 2026;

export const FONTE_DOCUMENTO = "IBSCBS da NFS-e";
export const FONTE_GERAL_NBS = "tabela de exceções — regime geral (sem exceção aplicável)";
export const FONTE_UNICO_NBS = "tabela de exceções — NBS único";
export const FONTE_TABELA_NBS =
  "Classificação de exceções por NBS: Anexo VIII v1.01.00 (gov.br/nfse), conferido contra o simulador oficial da reforma.";

export const round2 = (v: number) => Math.round(v * 100) / 100;

export interface CreditoServicoCalculado {
  cclasstrib: string | null;
  baseCalculo: number;
  credito: number;
  fonte: string;
  status: ServicoItemStatus;
  opcoes: OpcaoServico[];
}

const asOpcao = (l: NbsExcecao): OpcaoServico => ({
  cclasstrib: l.cclasstrib,
  nome_cclasstrib: l.nome_cclasstrib,
  grupo_cclasstrib: l.grupo_cclasstrib,
  aliquota_ibs_2026: Number(l.aliquota_ibs_2026),
  aliquota_cbs_2026: Number(l.aliquota_cbs_2026),
});

/** Crédito a partir de alíquotas em pontos percentuais. */
export function creditoPorAliquotas(valor: number, ibsPct: number, cbsPct: number): number {
  return round2((valor * (Number(ibsPct) + Number(cbsPct))) / 100);
}

/** Calcula o crédito de um serviço sem classificação no documento. */
export function creditoPorNbs(
  valorServico: number,
  linhas: NbsExcecao[],
  ano: number = ANO_VIGENTE_NBS,
): CreditoServicoCalculado {
  const nominal = ALIQUOTAS_NOMINAIS_NBS[ano] ?? ALIQUOTAS_NOMINAIS_NBS[ANO_VIGENTE_NBS]!;

  if (linhas.length === 0) {
    return {
      cclasstrib: null,
      baseCalculo: valorServico,
      credito: creditoPorAliquotas(valorServico, nominal.ibs, nominal.cbs),
      fonte: FONTE_GERAL_NBS,
      status: "ok",
      opcoes: [],
    };
  }

  if (linhas.some((l) => l.regime_especifico_sem_aliquota_simples)) {
    return {
      cclasstrib: linhas[0]!.cclasstrib,
      baseCalculo: valorServico,
      credito: 0,
      fonte: "regime específico — não tratado nesta versão",
      status: "regime_especifico",
      opcoes: [],
    };
  }

  if (linhas.length > 1 || linhas.some((l) => l.requer_revisao_humana)) {
    if (linhas.length > 1) {
      return {
        cclasstrib: null,
        baseCalculo: valorServico,
        credito: 0,
        fonte: "classificação tributária ambígua — requer revisão do analista",
        status: "ambiguo_revisao_pendente",
        opcoes: linhas.map(asOpcao),
      };
    }
  }

  const linha = linhas[0]!;
  return {
    cclasstrib: linha.cclasstrib,
    baseCalculo: valorServico,
    credito: creditoPorAliquotas(valorServico, linha.aliquota_ibs_2026, linha.aliquota_cbs_2026),
    fonte: FONTE_UNICO_NBS,
    status: "ok",
    opcoes: [],
  };
}
