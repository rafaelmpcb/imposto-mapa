/**
 * Monetização e transição de saldos credores acumulados (ICMS e PIS/COFINS).
 *
 * Módulo puro de apoio à decisão. Compara a inércia (recebimento do saldo de
 * ICMS em até 240 parcelas mensais corrigidas pelo IPCA, art. 134 do ADCT na
 * redação da EC 132/2023) com a monetização antecipada (cessão a terceiros com
 * deságio) e com a compensação do saldo de PIS/COFINS na transição para a CBS.
 *
 * Todos os números são ESTIMATIVAS. Nada aqui consulta banco de dados.
 */

export const PARCELAS_ICMS = 240;
/** Ano em que se inicia o ressarcimento dos saldos homologados de ICMS. */
export const ANO_INICIO_RESSARCIMENTO = 2033;
export const AVISO_SALDOS =
  "Estudo estimativo de viabilidade financeira. O aproveitamento efetivo depende de homologação do saldo pela SEFAZ/Receita Federal, da legislação estadual aplicável e da regulamentação da EC 132/2023.";

export interface SaldosInput {
  /** Saldo credor acumulado de ICMS (R$). */
  saldoIcms: number;
  /** Saldo credor acumulado de PIS/COFINS (R$). */
  saldoPisCofins: number;
  /** Custo de oportunidade do capital ao ano (%). */
  custoOportunidadeAaPct: number;
  /** Correção oficial projetada das parcelas — IPCA ao ano (%). */
  ipcaAaPct: number;
  /** Deságio praticado na cessão do crédito a terceiros (%). */
  desagioCessaoPct: number;
  /** Meses estimados para compensar o saldo de PIS/COFINS com a CBS. */
  mesesCompensacaoCbs: number;
  /** Ano-base da análise (para calcular a carência até o ressarcimento). */
  anoBase?: number;
}

export interface ParcelaSaldo {
  mes: number;
  ano: number;
  /** Parcela nominal recebida no mês (já corrigida pelo IPCA). */
  valorNominal: number;
  /** Valor presente dessa parcela. */
  valorPresente: number;
  acumuladoNominal: number;
  acumuladoPresente: number;
}

export interface ResultadoSaldos {
  saldoTotal: number;
  premissas: {
    custoOportunidadeAaPct: number;
    ipcaAaPct: number;
    desagioCessaoPct: number;
    mesesCompensacaoCbs: number;
    anoBase: number;
    mesesCarencia: number;
  };
  icms: {
    saldo: number;
    /** Soma nominal das 240 parcelas corrigidas. */
    recebimentoNominal: number;
    /** Valor presente do fluxo de 240 parcelas. */
    vplInercia: number;
    /** Perda financeira por esperar o fluxo oficial. */
    perdaInercia: number;
    perdaInerciaPct: number;
    /** Caixa imediato ao ceder o crédito com o deságio informado. */
    caixaCessao: number;
    /** Ganho (ou perda) da cessão frente ao valor presente da inércia. */
    ganhoCessao: number;
    /** Deságio máximo que ainda empata com a inércia (%). */
    desagioEquilibrioPct: number;
    parcelas: ParcelaSaldo[];
  };
  pisCofins: {
    saldo: number;
    mesesCompensacao: number;
    vplCompensacao: number;
    perdaCompensacao: number;
    caixaCessao: number;
    ganhoCessao: number;
  };
  totais: {
    vplInercia: number;
    caixaAcaoAtiva: number;
    ganhoAcaoAtiva: number;
    perdaTotalInercia: number;
  };
  recomendacao: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const naoNegativo = (v: unknown) => Math.max(0, Number(v) || 0);
const pct = (v: unknown) => Math.max(0, Number(v) || 0) / 100;

const taxaMensal = (aaPct: number) => Math.pow(1 + pct(aaPct), 1 / 12) - 1;

/** Fluxo das 240 parcelas de ICMS, corrigidas pelo IPCA e trazidas a valor presente. */
export function fluxoIcms(input: SaldosInput): ParcelaSaldo[] {
  const saldo = naoNegativo(input.saldoIcms);
  const anoBase = input.anoBase ?? new Date().getUTCFullYear();
  const mesesCarencia = Math.max(0, (ANO_INICIO_RESSARCIMENTO - anoBase) * 12);
  const iM = taxaMensal(input.ipcaAaPct);
  const dM = taxaMensal(input.custoOportunidadeAaPct);
  const parcelaBase = saldo / PARCELAS_ICMS;

  const linhas: ParcelaSaldo[] = [];
  let accNom = 0;
  let accVp = 0;

  for (let i = 1; i <= PARCELAS_ICMS; i += 1) {
    const mes = mesesCarencia + i;
    const valorNominal = parcelaBase * Math.pow(1 + iM, mes);
    const valorPresente = valorNominal / Math.pow(1 + dM, mes);
    accNom += valorNominal;
    accVp += valorPresente;
    linhas.push({
      mes,
      ano: anoBase + Math.floor((mes - 1) / 12),
      valorNominal: round2(valorNominal),
      valorPresente: round2(valorPresente),
      acumuladoNominal: round2(accNom),
      acumuladoPresente: round2(accVp),
    });
  }

  return linhas;
}

export function calcularSaldos(input: SaldosInput): ResultadoSaldos {
  const anoBase = input.anoBase ?? new Date().getUTCFullYear();
  const mesesCarencia = Math.max(0, (ANO_INICIO_RESSARCIMENTO - anoBase) * 12);
  const saldoIcms = naoNegativo(input.saldoIcms);
  const saldoPis = naoNegativo(input.saldoPisCofins);
  const desagio = Math.min(1, pct(input.desagioCessaoPct));
  const dM = taxaMensal(input.custoOportunidadeAaPct);

  const parcelas = fluxoIcms(input);
  const recebimentoNominal = parcelas.reduce((s, p) => s + p.valorNominal, 0);
  const vplIcms = parcelas.reduce((s, p) => s + p.valorPresente, 0);
  const caixaCessaoIcms = saldoIcms * (1 - desagio);
  const desagioEquilibrio = saldoIcms > 0 ? (1 - vplIcms / saldoIcms) * 100 : 0;

  // PIS/COFINS: compensação linear com a CBS ao longo do prazo estimado.
  const meses = Math.max(1, Math.round(Number(input.mesesCompensacaoCbs) || 1));
  const parcelaPis = saldoPis / meses;
  let vplPis = 0;
  for (let m = 1; m <= meses; m += 1) vplPis += parcelaPis / Math.pow(1 + dM, m);
  const caixaCessaoPis = saldoPis * (1 - desagio);

  const saldoTotal = saldoIcms + saldoPis;
  const vplInerciaTotal = vplIcms + vplPis;
  const caixaAcaoAtiva = caixaCessaoIcms + vplPis;
  const ganhoAcaoAtiva = caixaAcaoAtiva - vplInerciaTotal;

  const recomendacao =
    saldoTotal <= 0
      ? "Informe os saldos credores acumulados para ver a comparação."
      : caixaCessaoIcms > vplIcms
        ? `Esperar o fluxo oficial reduz o saldo de ICMS de ${fmt(saldoIcms)} para ${fmt(vplIcms)} a valor presente. Mesmo com deságio de ${(desagio * 100).toFixed(1)}%, a monetização antecipada gera ${fmt(caixaCessaoIcms - vplIcms)} a mais em valor real.`
        : `Com deságio de ${(desagio * 100).toFixed(1)}%, a cessão fica abaixo do valor presente da inércia. O deságio máximo que ainda compensa é de aproximadamente ${desagioEquilibrio.toFixed(1)}%.`;

  return {
    saldoTotal: round2(saldoTotal),
    premissas: {
      custoOportunidadeAaPct: Number(input.custoOportunidadeAaPct) || 0,
      ipcaAaPct: Number(input.ipcaAaPct) || 0,
      desagioCessaoPct: Number(input.desagioCessaoPct) || 0,
      mesesCompensacaoCbs: meses,
      anoBase,
      mesesCarencia,
    },
    icms: {
      saldo: round2(saldoIcms),
      recebimentoNominal: round2(recebimentoNominal),
      vplInercia: round2(vplIcms),
      perdaInercia: round2(saldoIcms - vplIcms),
      perdaInerciaPct: saldoIcms > 0 ? round2(((saldoIcms - vplIcms) / saldoIcms) * 100) : 0,
      caixaCessao: round2(caixaCessaoIcms),
      ganhoCessao: round2(caixaCessaoIcms - vplIcms),
      desagioEquilibrioPct: round2(desagioEquilibrio),
      parcelas,
    },
    pisCofins: {
      saldo: round2(saldoPis),
      mesesCompensacao: meses,
      vplCompensacao: round2(vplPis),
      perdaCompensacao: round2(saldoPis - vplPis),
      caixaCessao: round2(caixaCessaoPis),
      ganhoCessao: round2(caixaCessaoPis - vplPis),
    },
    totais: {
      vplInercia: round2(vplInerciaTotal),
      caixaAcaoAtiva: round2(caixaAcaoAtiva),
      ganhoAcaoAtiva: round2(ganhoAcaoAtiva),
      perdaTotalInercia: round2(saldoTotal - vplInerciaTotal),
    },
    recomendacao,
  };
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Fases do projeto de monetização entregues ao cliente. */
export const FASES_MONETIZACAO = [
  {
    titulo: "Fase 1 — Auditoria e validação",
    descricao:
      "Levantamento e conferência dos saldos escriturados (SPED Fiscal e EFD-Contribuições), identificação da origem dos créditos e avaliação de risco de glosa.",
  },
  {
    titulo: "Fase 2 — Homologação",
    descricao:
      "Protocolo e acompanhamento do pedido de apropriação/homologação junto à SEFAZ estadual e dos pedidos de ressarcimento ou compensação na Receita Federal.",
  },
  {
    titulo: "Fase 3 — Monetização",
    descricao:
      "Estruturação da compensação acelerada, do uso em aquisições ou do contrato de cessão do crédito a terceiros, com a devida proteção jurídica das partes.",
  },
] as const;
