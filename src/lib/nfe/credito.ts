/**
 * Crédito de IBS/CBS por item de nota de compra.
 * Quando o XML já traz o bloco IBSCBS, os valores vêm prontos da nota.
 * Quando não traz, o crédito é estimado pela alíquota nominal do ano,
 * reduzida conforme a tabela de exceções por NCM (LC 214/2025).
 */

export type ItemStatus = "ok" | "ambiguo_revisao_pendente" | "imposto_seletivo" | "sem_dado";

export interface NcmExcecao {
  ncm: string;
  anexo: string;
  anexo_desc: string;
  cclasstrib: string | null;
  reducao_pct: number;
  imposto_seletivo: boolean;
  n_classificacoes_ncm: number;
  requer_revisao_humana: boolean;
}

export interface OpcaoCandidata {
  anexo: string;
  anexo_desc?: string;
  cclasstrib: string | null;
  reducao_pct: number;
  sugerida?: boolean;
}

/** Alíquotas nominais por ano de transição (fração sobre o valor do item). */
export const ALIQUOTAS_NOMINAIS: Record<number, { cbs: number; ibsUf: number; ibsMun: number }> = {
  2026: { cbs: 0.009, ibsUf: 0.001, ibsMun: 0 },
};

export const ANO_VIGENTE_CREDITO = 2026;

export function aliquotaNominal(ano: number = ANO_VIGENTE_CREDITO) {
  return ALIQUOTAS_NOMINAIS[ano] ?? ALIQUOTAS_NOMINAIS[ANO_VIGENTE_CREDITO]!;
}

export const FONTE_XML = "IBSCBS do XML";
export const FONTE_GERAL = "tabela de exceções — regime geral (sem exceção aplicável)";
export const FONTE_UNICO = "tabela de exceções — NCM único";
export const FONTE_MULTI_IGUAL = "tabela de exceções — múltiplos anexos, mesmo percentual";
export const FONTE_TABELA =
  "Classificação de exceções por NCM: buscadorncm.com.br, conferida contra a Calculadora de Tributos oficial da RFB/Serpro (base V0057).";

const INSUMO_KEYWORDS = [
  "semente",
  "muda",
  "ração",
  "racao",
  "adubo",
  "fertilizante",
  "defensivo",
  "corretivo de solo",
  "insumo agropecuário",
  "insumo agropecuario",
  "matriz e reprodutor",
];

const ALIMENTO_KEYWORDS = [
  "pacote",
  "embalado",
  "tipo 1",
  "parboilizado",
  "beneficiado",
  "polido",
  "alimento",
  "consumo humano",
  "kg ",
  "1kg",
  "5kg",
];

/** Triagem simples por descrição: só sugere, nunca aplica sozinha. */
export function triagemDescricao(descricao: string | null): "insumo" | "alimento" | null {
  const d = (descricao ?? "").toLowerCase();
  if (!d) return null;
  if (INSUMO_KEYWORDS.some((k) => d.includes(k))) return "insumo";
  if (ALIMENTO_KEYWORDS.some((k) => d.includes(k))) return "alimento";
  return null;
}

export interface CreditoCalculado {
  cclasstrib: string | null;
  baseCalculo: number;
  credito: number;
  fonte: string;
  status: ItemStatus;
  opcoes: OpcaoCandidata[];
}

/** Calcula o crédito de um item sem bloco IBSCBS, usando a tabela de exceções. */
export function creditoPorNcm(
  valorItem: number,
  descricao: string | null,
  linhas: NcmExcecao[],
  ano: number = ANO_VIGENTE_CREDITO,
): CreditoCalculado {
  const nominal = aliquotaNominal(ano);
  const total = nominal.cbs + nominal.ibsUf + nominal.ibsMun;

  if (linhas.length === 0) {
    return {
      cclasstrib: null,
      baseCalculo: valorItem,
      credito: round2(valorItem * total),
      fonte: FONTE_GERAL,
      status: "ok",
      opcoes: [],
    };
  }

  if (linhas.some((l) => l.imposto_seletivo)) {
    return {
      cclasstrib: linhas[0]!.cclasstrib,
      baseCalculo: valorItem,
      credito: 0,
      fonte: "sujeito a Imposto Seletivo — não tratado nesta versão",
      status: "imposto_seletivo",
      opcoes: [],
    };
  }

  const percentuais = [...new Set(linhas.map((l) => Number(l.reducao_pct)))];

  if (percentuais.length > 1) {
    const triagem = triagemDescricao(descricao);
    const opcoes: OpcaoCandidata[] = linhas.map((l) => ({
      anexo: l.anexo,
      anexo_desc: l.anexo_desc,
      cclasstrib: l.cclasstrib,
      reducao_pct: Number(l.reducao_pct),
      sugerida:
        triagem === "insumo"
          ? /agropecu|insumo/i.test(l.anexo_desc)
          : triagem === "alimento"
            ? /aliment|cesta|consumo humano/i.test(l.anexo_desc)
            : false,
    }));
    return {
      cclasstrib: null,
      baseCalculo: valorItem,
      credito: 0,
      fonte: "classificação tributária ambígua — requer revisão do analista",
      status: "ambiguo_revisao_pendente",
      opcoes,
    };
  }

  const reducao = percentuais[0] ?? 0;
  const fator = 1 - reducao / 100;
  return {
    cclasstrib: linhas[0]!.cclasstrib,
    baseCalculo: valorItem,
    credito: round2(valorItem * total * fator),
    fonte: linhas.length === 1 ? FONTE_UNICO : FONTE_MULTI_IGUAL,
    status: "ok",
    opcoes:
      linhas.length === 1
        ? []
        : linhas.map((l) => ({
            anexo: l.anexo,
            anexo_desc: l.anexo_desc,
            cclasstrib: l.cclasstrib,
            reducao_pct: Number(l.reducao_pct),
          })),
  };
}

/** Crédito a partir da redução escolhida manualmente pelo analista. */
export function creditoComReducao(
  valorItem: number,
  reducaoPct: number,
  ano: number = ANO_VIGENTE_CREDITO,
): number {
  const nominal = aliquotaNominal(ano);
  const total = nominal.cbs + nominal.ibsUf + nominal.ibsMun;
  return round2(valorItem * total * (1 - reducaoPct / 100));
}

export const round2 = (v: number) => Math.round(v * 100) / 100;
