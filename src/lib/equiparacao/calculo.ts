/**
 * Equiparação hospitalar (Lei 9.249/95, art. 15, §1º, III, "a" e art. 20; Tema 217/STJ).
 * Lucro Presumido: procedimentos hospitalares usam presunção de 8% (IRPJ) e 12% (CSLL);
 * consultas simples continuam em 32%. Cálculo trimestral, com adicional de 10% do IRPJ
 * sobre a base que exceder R$ 60.000 no trimestre.
 */

export const PRESUNCAO = {
  servicos: 0.32,
  irpjHospitalar: 0.08,
  csllHospitalar: 0.12,
} as const;
export const IRPJ_ALIQ = 0.15;
export const IRPJ_ADICIONAL = 0.1;
export const LIMITE_ADICIONAL_TRI = 60_000;
export const CSLL_ALIQ = 0.09;
export const MESES_PRESCRICAO = 60;

export const AVISO_EQUIPARACAO =
  "Estimativa para fins de captação. Não substitui diagnóstico fiscal completo nem análise documental da elegibilidade (sociedade empresária, normas da Anvisa e segregação das receitas).";

export interface EquiparacaoInput {
  receitaMensal: number;
  /** Fração da receita que é procedimento hospitalar (0 a 1). */
  fracaoProcedimentos: number;
  /** Meses já recolhidos no Lucro Presumido sem a equiparação (limitado a 60). */
  mesesRetroativos: number;
  /** Selic acumulada aplicada ao indébito, em % (estimativa média do período). */
  selicAcumuladaPct: number;
  /** Honorários de êxito sobre o indébito, em %. */
  exitoPct: number;
}

export interface TributosTri {
  baseIrpj: number;
  baseCsll: number;
  irpj: number;
  csll: number;
  total: number;
}

export function tributosTrimestre(receitaTri: number, fracaoProc: number, equiparado: boolean): TributosTri {
  const p = equiparado ? Math.min(1, Math.max(0, fracaoProc)) : 0;
  const baseIrpj = receitaTri * (p * PRESUNCAO.irpjHospitalar + (1 - p) * PRESUNCAO.servicos);
  const baseCsll = receitaTri * (p * PRESUNCAO.csllHospitalar + (1 - p) * PRESUNCAO.servicos);
  const irpj = baseIrpj * IRPJ_ALIQ + Math.max(0, baseIrpj - LIMITE_ADICIONAL_TRI) * IRPJ_ADICIONAL;
  const csll = baseCsll * CSLL_ALIQ;
  return { baseIrpj, baseCsll, irpj, csll, total: irpj + csll };
}

export function calcularEquiparacao(i: EquiparacaoInput) {
  const receitaTri = Math.max(0, i.receitaMensal) * 3;
  const atual = tributosTrimestre(receitaTri, i.fracaoProcedimentos, false);
  const equiparado = tributosTrimestre(receitaTri, i.fracaoProcedimentos, true);
  const economiaTri = atual.total - equiparado.total;
  const economiaMensal = economiaTri / 3;
  const meses = Math.min(MESES_PRESCRICAO, Math.max(0, Math.round(i.mesesRetroativos)));
  const indebitoNominal = economiaMensal * meses;
  const indebitoAtualizado = indebitoNominal * (1 + Math.max(0, i.selicAcumuladaPct) / 100);
  return {
    atual,
    equiparado,
    economiaMensal,
    economiaAnual: economiaTri * 4,
    meses,
    indebitoNominal,
    indebitoAtualizado,
    honorariosExito: indebitoAtualizado * (Math.max(0, i.exitoPct) / 100),
  };
}

/* ---------------- Segregação automática das receitas ---------------- */

export type CategoriaReceita = "procedimento" | "consulta" | "revisar";

const PROC =
  /exame|ultrass|ultra-s|tomogra|resson|raio.?x|radiolog|radioter|quimio|endoscop|colonoscop|cirurg|procediment|bi[oó]psia|infiltra|laborat|an[aá]lises? cl[ií]nicas|patolog|hemograma|ecocardio|eletrocardio|eletroencef|holter|mapa\b|mamogra|densitometr|terapia|fisioter|interna[cç]|anestes|hemodi[aá]lise|di[aá]lise|doppler|cateter|vacina|sutura|curativo|pequena cirurgia|oftalmo.*(laser|exame)|campimetria|audiometria|espirometria/i;
const CONS = /consulta|retorno|teleconsulta|atendimento ambulatorial|avalia[cç][aã]o m[eé]dica/i;
/** Itens da LC 116 típicos de diagnóstico/terapia (4.02) e laboratórios. */
const LC_PROC = /^0?4\.?0?2/;

export function classificarReceita(descricao: string | null, codigo: string | null): CategoriaReceita {
  const d = (descricao ?? "").trim();
  if (d && CONS.test(d) && !PROC.test(d)) return "consulta";
  if (d && PROC.test(d)) return "procedimento";
  if (codigo && LC_PROC.test(codigo.replace(/\s/g, ""))) return "procedimento";
  return "revisar";
}

export interface LinhaReceita {
  id: string;
  descricao: string;
  valor: number;
  data: string | null;
  categoria: CategoriaReceita;
}

export function resumirSegregacao(linhas: LinhaReceita[]) {
  const soma = (c: CategoriaReceita) =>
    linhas.filter((l) => l.categoria === c).reduce((s, l) => s + l.valor, 0);
  const procedimento = soma("procedimento");
  const consulta = soma("consulta");
  const revisar = soma("revisar");
  const classificado = procedimento + consulta;
  const meses = new Set(linhas.map((l) => l.data?.slice(0, 7)).filter(Boolean)).size;
  const total = procedimento + consulta + revisar;
  return {
    procedimento,
    consulta,
    revisar,
    total,
    meses,
    fracaoProcedimentos: classificado > 0 ? procedimento / classificado : 0,
    receitaMensalMedia: meses > 0 ? total / meses : 0,
  };
}

/* ---------------- Indébito com Selic real (trimestre a trimestre) ---------------- */

import { SELIC_MENSAL } from "./selic";

const ym = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

/**
 * Selic acumulada (Lei 9.250/95, art. 39, §4º): soma das taxas mensais do mês seguinte
 * ao pagamento até o mês anterior ao da restituição/compensação, mais 1% no mês corrente.
 */
export function selicAcumuladaPct(pagamentoYm: string, referenciaYm: string, tabela = SELIC_MENSAL): number {
  let soma = 0;
  for (const [m, v] of tabela) if (m > pagamentoYm && m < referenciaYm) soma += v;
  return soma + 1;
}

export interface TrimestreIndebito {
  trimestre: string;
  pagamento: string;
  nominal: number;
  selicPct: number;
  atualizado: number;
}

/**
 * Distribui a economia trimestral nos trimestres já encerrados dentro do período
 * (até 60 meses). IRPJ/CSLL do trimestre são pagos no mês seguinte ao encerramento.
 */
export function indebitoSelicReal(
  economiaTri: number,
  meses: number,
  referencia: Date,
  tabela: ReadonlyArray<readonly [string, number]> = SELIC_MENSAL,
) {
  const refAno = referencia.getUTCFullYear();
  const refMes = referencia.getUTCMonth() + 1;
  const refYm = ym(refAno, refMes);
  const nTri = Math.floor(Math.min(MESES_PRESCRICAO, Math.max(0, meses)) / 3);
  // Último trimestre encerrado antes do mês de referência.
  let q = Math.floor((refMes - 1) / 3); // trimestres completos no ano corrente
  let ano = refAno;
  if (q === 0) { q = 4; ano -= 1; }
  const linhas: TrimestreIndebito[] = [];
  for (let i = 0; i < nTri; i++) {
    const fimMes = q * 3;
    const pagAno = fimMes === 12 ? ano + 1 : ano;
    const pagMes = fimMes === 12 ? 1 : fimMes + 1;
    const pagYm = ym(pagAno, pagMes);
    const selicPct = pagYm < refYm ? selicAcumuladaPct(pagYm, refYm, tabela) : 0;
    const nominal = Math.max(0, economiaTri);
    linhas.unshift({ trimestre: `${q}º tri/${ano}`, pagamento: pagYm, nominal, selicPct, atualizado: nominal * (1 + selicPct / 100) });
    q -= 1;
    if (q === 0) { q = 4; ano -= 1; }
  }
  const nominal = linhas.reduce((s, l) => s + l.nominal, 0);
  const atualizado = linhas.reduce((s, l) => s + l.atualizado, 0);
  return { linhas, nominal, atualizado, selicMediaPct: nominal > 0 ? (atualizado / nominal - 1) * 100 : 0, referencia: refYm };
}
