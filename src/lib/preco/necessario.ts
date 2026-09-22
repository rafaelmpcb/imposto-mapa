/**
 * Preço necessário nas vendas (Pilar 2).
 *
 * Responde "quanto seria necessário cobrar para não perder nada com a reforma?":
 * parte do valor desonerado de hoje (preço menos tributos atuais) e devolve o
 * preço que preserva exatamente esse valor líquido depois do IBS/CBS.
 *
 * Não é recomendação de preço — é o piso técnico de preservação de margem.
 */

export const ALIQUOTA_PLENA_PADRAO_PCT = 26.5;

/** Curva de rampa ESTIMADA da transição (editável por Caso). */
export const CRONOGRAMA_PADRAO: { ano: number; fracao: number }[] = [
  { ano: 2027, fracao: 0.1 },
  { ano: 2028, fracao: 0.2 },
  { ano: 2029, fracao: 0.4 },
  { ano: 2030, fracao: 0.6 },
  { ano: 2031, fracao: 0.8 },
  { ano: 2032, fracao: 0.9 },
  { ano: 2033, fracao: 1 },
];

export const AVISO_DECISAO_COMERCIAL =
  "O percentual calculado responde \u201cquanto seria necess\u00e1rio para n\u00e3o perder nada?\u201d. A decis\u00e3o comercial de pre\u00e7o vem depois.";

export const NOTA_RAMPA =
  "A curva de transi\u00e7\u00e3o ano a ano \u00e9 uma estimativa de rampa, edit\u00e1vel por Caso, at\u00e9 haver cronograma oficial da LC 214/2025 carregado no sistema.";

export const FONTE_ALIQUOTA_PLENA =
  "Al\u00edquota plena de refer\u00eancia do regime pleno (par\u00e2metro do Caso), reduzida pela tabela de exce\u00e7\u00f5es por NCM (buscadorncm.com.br / RFB-Serpro) ou por NBS (Anexo VIII v1.01.00, gov.br/nfse).";

export type StatusPreco = "ok" | "valor_desonerado_invalido";

export interface PrecoCalculado {
  tributosAtuaisTotal: number;
  valorDesonerado: number;
  aliquotaPlenaAplicada: number;
  precoNecessario: number;
  variacaoPrecoPct: number;
  status: StatusPreco;
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Alíquota efetiva do item = plena do Caso reduzida pelo percentual da tabela. */
export const aliquotaComReducao = (plenaPct: number, reducaoPct: number): number =>
  (Number(plenaPct) / 100) * (1 - Number(reducaoPct) / 100);

/**
 * Redução equivalente de um serviço, deduzida das alíquotas de 2026 da tabela
 * por NBS frente à alíquota nominal do ano (1,0%).
 */
export const reducaoDoNbs = (ibs2026: number, cbs2026: number): number => {
  const nominal = 1;
  const soma = Number(ibs2026) + Number(cbs2026);
  if (!Number.isFinite(soma) || soma <= 0) return 100;
  return Math.max(0, Math.min(100, (1 - soma / nominal) * 100));
};

export function calcularPrecoNecessarioItem(
  valorItem: number,
  tributosAtuais: number[],
  aliquotaPlenaItem: number,
): PrecoCalculado {
  const valor = Number.isFinite(valorItem) ? Number(valorItem) : 0;
  const tributos = tributosAtuais.reduce(
    (acc, v) => acc + (Number.isFinite(Number(v)) ? Number(v) : 0),
    0,
  );
  const desonerado = Math.max(valor - tributos, 0);
  const preco = round2(desonerado * (1 + aliquotaPlenaItem));
  const variacao = valor > 0 ? (preco - valor) / valor : 0;
  return {
    tributosAtuaisTotal: round2(tributos),
    valorDesonerado: round2(desonerado),
    aliquotaPlenaAplicada: aliquotaPlenaItem,
    precoNecessario: preco,
    variacaoPrecoPct: Math.round(variacao * 1000000) / 1000000,
    status: valor <= 0 || desonerado <= 0 ? "valor_desonerado_invalido" : "ok",
  };
}

/** Série do preço necessário por ano da transição. */
export function projetarPorAno(
  valorItem: number,
  valorDesonerado: number,
  aliquotaPlenaItem: number,
  cronograma: { ano: number; fracao: number }[],
): { ano: number; precoNecessarioAno: number; variacaoPctAno: number }[] {
  return cronograma.map(({ ano, fracao }) => {
    const preco = round2(valorDesonerado * (1 + aliquotaPlenaItem * Number(fracao)));
    return {
      ano,
      precoNecessarioAno: preco,
      variacaoPctAno:
        valorItem > 0 ? Math.round(((preco - valorItem) / valorItem) * 1000000) / 1000000 : 0,
    };
  });
}

export type PerfilCliente = "regular" | "simples" | "nao_classificado";

export const LEITURA_PERFIL: Record<PerfilCliente, string> = {
  regular:
    "Cliente em regime regular: toma cr\u00e9dito do IBS/CBS destacado, ent\u00e3o o aumento nominal tende a ser absorvido via cr\u00e9dito \u2014 argumento comercial para sustentar o reajuste.",
  simples:
    "Cliente no Simples Nacional (ou consumidor final): normalmente n\u00e3o recupera o IBS/CBS como cr\u00e9dito \u2014 o aumento tende a ser sentido de forma integral. Avaliar cl\u00e1usula contratual de revis\u00e3o de pre\u00e7o vinculada \u00e0 reforma.",
  nao_classificado:
    "Sem classifica\u00e7\u00e3o de regime dispon\u00edvel: o pre\u00e7o necess\u00e1rio n\u00e3o depende do regime do cliente, mas a leitura de absor\u00e7\u00e3o via cr\u00e9dito n\u00e3o p\u00f4de ser feita.",
};
