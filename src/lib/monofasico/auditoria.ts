/**
 * Auditoria real de PIS/COFINS monofásico a partir dos XMLs de venda
 * (NF-e modelo 55 e NFC-e modelo 65).
 *
 * A lógica é pura: recebe os itens lidos das notas e o catálogo de NCMs
 * monofásicos (espelho próprio da Tabela 4.3.10 da EFD-Contribuições) e
 * devolve a classificação item a item, com o indébito estimado.
 *
 * É diagnóstico, não conclusão automática de direito creditório: a segregação
 * definitiva depende da escrituração, da ausência de compensações anteriores e
 * da homologação pela Receita Federal.
 */

import { ALIQUOTA_REGIME, type RegimeMonofasico } from "@/lib/monofasico/calculo";

export interface CatalogoNcmMonofasico {
  ncmPrefixo: string;
  descricao: string;
  grupo: string;
  cstEsperado: string;
  cstAlternativos: string[];
  baseLegal: string;
  observacao: string | null;
}

export type ClassificacaoMonofasica =
  | "possivel_indebito"
  | "monofasico_correto"
  | "nao_monofasico"
  | "sem_ncm";

export const CLASSIFICACAO_LABELS: Record<ClassificacaoMonofasica, string> = {
  possivel_indebito: "Possível indébito",
  monofasico_correto: "Monofásico já correto",
  nao_monofasico: "Fora do monofásico",
  sem_ncm: "Sem NCM na nota",
};

/** CSTs de PIS/COFINS que representam saída sem tributação (monofásico correto). */
export const CST_NAO_TRIBUTADOS = ["04", "05", "06", "07", "08", "09"];

export interface ItemAuditoria {
  arquivo: string;
  chave: string | null;
  modelo: string | null;
  numero: string | null;
  dataEmissao: string | null;
  ncm: string | null;
  cfop: string | null;
  descricao: string | null;
  valorItem: number;
  cstPis: string | null;
  cstCofins: string | null;
  valorPis: number;
  valorCofins: number;
}

export interface ItemClassificado extends ItemAuditoria {
  competencia: string | null;
  grupo: string | null;
  baseLegal: string | null;
  classificacao: ClassificacaoMonofasica;
  indebitoEstimado: number;
}

const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** Só CFOPs de saída (5xxx/6xxx/7xxx) entram na auditoria de receita. */
export const isSaida = (cfop: string | null) => Boolean(cfop && /^[567]/.test(cfop));

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Índice por prefixo de NCM, para busca hierárquica (8 → 2 dígitos). */
export function indexarCatalogo(
  linhas: CatalogoNcmMonofasico[],
): Map<string, CatalogoNcmMonofasico> {
  const map = new Map<string, CatalogoNcmMonofasico>();
  for (const linha of linhas) {
    const key = digits(linha.ncmPrefixo);
    if (key) map.set(key, linha);
  }
  return map;
}

/** Busca o prefixo mais específico que casa com o NCM do item. */
export function buscarNcm(
  ncm: string | null,
  index: Map<string, CatalogoNcmMonofasico>,
): CatalogoNcmMonofasico | null {
  const code = digits(ncm);
  if (code.length < 4) return null;
  for (let len = code.length; len >= 4; len -= 1) {
    const found = index.get(code.slice(0, len));
    if (found) return found;
  }
  return null;
}

export const competenciaDe = (iso: string | null): string | null =>
  iso ? iso.slice(0, 7) : null;

/** Alíquota efetiva de PIS/COFINS sobre a receita, conforme o regime (%). */
export function aliquotaAuditoria(
  regime: RegimeMonofasico,
  aliquotaEfetivaSimplesPct: number,
): number {
  if (regime === "simples") return Math.max(0, Number(aliquotaEfetivaSimplesPct) || 0);
  return ALIQUOTA_REGIME[regime];
}

export function classificarItem(
  item: ItemAuditoria,
  index: Map<string, CatalogoNcmMonofasico>,
  regime: RegimeMonofasico,
  aliquotaEfetivaSimplesPct: number,
): ItemClassificado {
  const base = {
    ...item,
    competencia: competenciaDe(item.dataEmissao),
    grupo: null as string | null,
    baseLegal: null as string | null,
    classificacao: "nao_monofasico" as ClassificacaoMonofasica,
    indebitoEstimado: 0,
  };

  if (!digits(item.ncm)) return { ...base, classificacao: "sem_ncm" };

  const catalogo = buscarNcm(item.ncm, index);
  if (!catalogo) return base;

  const cst = digits(item.cstPis) || digits(item.cstCofins);
  const tributadoPeloValor = item.valorPis + item.valorCofins > 0;
  const cstZerado = cst.length > 0 && CST_NAO_TRIBUTADOS.includes(cst.padStart(2, "0"));

  if (cstZerado && !tributadoPeloValor) {
    return {
      ...base,
      grupo: catalogo.grupo,
      baseLegal: catalogo.baseLegal,
      classificacao: "monofasico_correto",
    };
  }

  const aliq = aliquotaAuditoria(regime, aliquotaEfetivaSimplesPct);
  const porValor = item.valorPis + item.valorCofins;
  const indebito =
    regime === "simples" || porValor <= 0 ? (item.valorItem * aliq) / 100 : porValor;

  return {
    ...base,
    grupo: catalogo.grupo,
    baseLegal: catalogo.baseLegal,
    classificacao: "possivel_indebito",
    indebitoEstimado: round2(indebito),
  };
}

export interface LinhaAgregada {
  chave: string;
  rotulo: string;
  itens: number;
  receita: number;
  indebito: number;
}

export interface ResumoAuditoria {
  itens: number;
  notas: number;
  receitaTotal: number;
  receitaMonofasica: number;
  participacaoMonofasicaPct: number;
  indebitoTotal: number;
  itensIndebito: number;
  itensCorretos: number;
  itensSemNcm: number;
  competencias: LinhaAgregada[];
  grupos: LinhaAgregada[];
  ncms: LinhaAgregada[];
  periodo: { inicio: string | null; fim: string | null };
}

function agregar(
  itens: ItemClassificado[],
  chaveDe: (i: ItemClassificado) => string | null,
  rotuloDe: (i: ItemClassificado) => string,
): LinhaAgregada[] {
  const map = new Map<string, LinhaAgregada>();
  for (const item of itens) {
    const chave = chaveDe(item);
    if (!chave) continue;
    const linha = map.get(chave) ?? {
      chave,
      rotulo: rotuloDe(item),
      itens: 0,
      receita: 0,
      indebito: 0,
    };
    linha.itens += 1;
    linha.receita = round2(linha.receita + item.valorItem);
    linha.indebito = round2(linha.indebito + item.indebitoEstimado);
    map.set(chave, linha);
  }
  return [...map.values()];
}

export function resumirAuditoria(itens: ItemClassificado[]): ResumoAuditoria {
  const receitaTotal = round2(itens.reduce((s, i) => s + i.valorItem, 0));
  const monofasicos = itens.filter(
    (i) => i.classificacao === "possivel_indebito" || i.classificacao === "monofasico_correto",
  );
  const receitaMonofasica = round2(monofasicos.reduce((s, i) => s + i.valorItem, 0));
  const indebitoTotal = round2(itens.reduce((s, i) => s + i.indebitoEstimado, 0));
  const datas = itens.map((i) => i.dataEmissao).filter((d): d is string => Boolean(d)).sort();
  const chaves = new Set(itens.map((i) => i.chave ?? i.arquivo));

  return {
    itens: itens.length,
    notas: chaves.size,
    receitaTotal,
    receitaMonofasica,
    participacaoMonofasicaPct:
      receitaTotal > 0 ? round2((receitaMonofasica / receitaTotal) * 100) : 0,
    indebitoTotal,
    itensIndebito: itens.filter((i) => i.classificacao === "possivel_indebito").length,
    itensCorretos: itens.filter((i) => i.classificacao === "monofasico_correto").length,
    itensSemNcm: itens.filter((i) => i.classificacao === "sem_ncm").length,
    competencias: agregar(
      itens,
      (i) => i.competencia,
      (i) => i.competencia ?? "",
    ).sort((a, b) => a.chave.localeCompare(b.chave)),
    grupos: agregar(
      monofasicos,
      (i) => i.grupo,
      (i) => i.grupo ?? "",
    ).sort((a, b) => b.indebito - a.indebito),
    ncms: agregar(
      monofasicos,
      (i) => digits(i.ncm) || null,
      (i) => i.descricao ?? "",
    ).sort((a, b) => b.indebito - a.indebito),
    periodo: { inicio: datas[0] ?? null, fim: datas[datas.length - 1] ?? null },
  };
}

/** CSV para conferência com a contabilidade. */
export function auditoriaParaCsv(itens: ItemClassificado[]): string {
  const head = [
    "competencia",
    "chave",
    "modelo",
    "numero",
    "ncm",
    "cfop",
    "descricao",
    "valor_item",
    "cst_pis",
    "cst_cofins",
    "valor_pis",
    "valor_cofins",
    "grupo",
    "classificacao",
    "indebito_estimado",
  ];
  const linhas = itens.map((i) =>
    [
      i.competencia ?? "",
      i.chave ?? "",
      i.modelo ?? "",
      i.numero ?? "",
      i.ncm ?? "",
      i.cfop ?? "",
      (i.descricao ?? "").replace(/[;\n]/g, " "),
      i.valorItem.toFixed(2),
      i.cstPis ?? "",
      i.cstCofins ?? "",
      i.valorPis.toFixed(2),
      i.valorCofins.toFixed(2),
      i.grupo ?? "",
      CLASSIFICACAO_LABELS[i.classificacao],
      i.indebitoEstimado.toFixed(2),
    ].join(";"),
  );
  return [head.join(";"), ...linhas].join("\n");
}
