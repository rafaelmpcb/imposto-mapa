/**
 * Impacto REAL por regime a partir do SPED: parte do que foi efetivamente
 * escriturado (débitos, créditos, recolhimentos e saldos) e projeta 2026–2033
 * com a transição gradual. Só tributos sobre o consumo (IRPJ/CSLL fora).
 */
import { ALIQUOTA_PLENA_PADRAO_PCT, ANOS_DISPONIVEIS, fracaoDoAno } from "@/lib/contratos/calculo";
import { remanescenteFederal, remanescenteSubnacional } from "@/lib/preco/necessario";
import type { SpedContribResumo, SpedIcmsResumo } from "@/lib/sped/parse";

export type RegimeComparado = "real" | "presumido";

export interface BaseSpedAnual {
  meses: number;
  receita: number;
  entradas: number;
  icmsDebitos: number;
  icmsCreditos: number;
  icmsRecolhido: number;
  ipiDevido: number;
  pisCofinsRecolhido: number;
  pisCofinsCreditos: number;
  regimeDeclarado: SpedContribResumo["regime"];
  saldoCredorIcms: number;
  saldoCredorPisCofins: number;
}

export interface LinhaRegimeAno {
  ano: number;
  debitoIbsCbs: number;
  creditoIbsCbs: number;
  ibsCbsLiquido: number;
  icms: number;
  ipi: number;
  pisCofins: number;
  total: number;
  variacaoVsHoje: number;
}

export interface ImpactoRegime {
  regime: RegimeComparado;
  declarado: boolean;
  hoje: { icms: number; ipi: number; pisCofins: number; total: number; creditosAproveitados: number };
  anos: LinhaRegimeAno[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const PIS_COFINS_NC = 0.0925;
const PIS_COFINS_CUM = 0.0365;

/** Soma os meses do SPED e anualiza (×12/meses). Saldos = último mês. */
export function baseAnual(
  icms: { periodo_ini: string; resumo: SpedIcmsResumo }[],
  contrib: { periodo_ini: string; resumo: SpedContribResumo }[],
): BaseSpedAnual | null {
  const meses = Math.max(icms.length, contrib.length);
  if (meses === 0) return null;
  const k = (n: number) => (n === 0 ? 0 : 12 / n);
  const fi = k(icms.length);
  const fc = k(contrib.length);
  const soma = <T,>(l: T[], f: (x: T) => number) => l.reduce((a, x) => a + f(x), 0);
  const ord = <T extends { periodo_ini: string }>(l: T[]) => [...l].sort((a, b) => a.periodo_ini.localeCompare(b.periodo_ini));
  const ultIcms = ord(icms).at(-1)?.resumo;
  const ultContrib = ord(contrib).at(-1)?.resumo;

  const receitaContrib = soma(contrib, (c) => c.resumo.receitaBruta) * fc;
  const saidasIcms = soma(icms, (c) => c.resumo.saidas.valor) * fi;
  return {
    meses,
    receita: r2(receitaContrib > 0 ? receitaContrib : saidasIcms),
    entradas: r2(soma(icms, (c) => c.resumo.entradas.valor) * fi),
    icmsDebitos: r2(soma(icms, (c) => c.resumo.icms.debitos) * fi),
    icmsCreditos: r2(soma(icms, (c) => c.resumo.icms.creditos) * fi),
    icmsRecolhido: r2(soma(icms, (c) => c.resumo.icms.aRecolher) * fi),
    ipiDevido: r2(soma(icms, (c) => c.resumo.ipi?.saldoDevedor ?? 0) * fi),
    pisCofinsRecolhido: r2(soma(contrib, (c) => c.resumo.pis.totalARecolher + c.resumo.cofins.totalARecolher) * fc),
    pisCofinsCreditos: r2(soma(contrib, (c) => c.resumo.pis.creditosApurados + c.resumo.cofins.creditosApurados) * fc),
    regimeDeclarado: ultContrib?.regime ?? null,
    saldoCredorIcms: r2(ultIcms?.icms.saldoCredorTransportar ?? 0),
    saldoCredorPisCofins: r2((ultContrib?.pis.saldoCredorFinal ?? 0) + (ultContrib?.cofins.saldoCredorFinal ?? 0)),
  };
}

/** PIS/Cofins de hoje no regime: o declarado no SPED ou a estimativa do outro regime. */
function pisCofinsHoje(b: BaseSpedAnual, regime: RegimeComparado): { valor: number; creditos: number; declarado: boolean } {
  const declaradoReal = b.regimeDeclarado === "nao_cumulativo" || b.regimeDeclarado === "misto";
  const declaradoPresumido = b.regimeDeclarado === "cumulativo";
  if (b.pisCofinsRecolhido > 0 || b.pisCofinsCreditos > 0) {
    if ((regime === "real" && declaradoReal) || (regime === "presumido" && declaradoPresumido))
      return { valor: b.pisCofinsRecolhido, creditos: b.pisCofinsCreditos, declarado: true };
  }
  if (regime === "presumido") return { valor: r2(b.receita * PIS_COFINS_CUM), creditos: 0, declarado: false };
  const creditos = r2(b.entradas * PIS_COFINS_NC);
  return { valor: r2(Math.max(0, b.receita * PIS_COFINS_NC - creditos)), creditos, declarado: false };
}

export function impactoPorRegime(b: BaseSpedAnual, aliquotaPlenaPct = ALIQUOTA_PLENA_PADRAO_PCT): ImpactoRegime[] {
  return (["real", "presumido"] as RegimeComparado[]).map((regime) => {
    const pc = pisCofinsHoje(b, regime);
    const hojeTotal = r2(b.icmsRecolhido + b.ipiDevido + pc.valor);
    const anos = ANOS_DISPONIVEIS.map((ano): LinhaRegimeAno => {
      const aliq = (aliquotaPlenaPct / 100) * fracaoDoAno(ano);
      const debito = b.receita * aliq;
      // Na reforma, Real e Presumido têm não cumulatividade plena: crédito sobre as entradas.
      const credito = b.entradas * aliq;
      const liquido = Math.max(0, debito - credito);
      const icms = b.icmsRecolhido * remanescenteSubnacional(ano);
      const ipi = b.ipiDevido * remanescenteFederal(ano);
      const pisCofins = pc.valor * remanescenteFederal(ano);
      // 2026: a alíquota-teste de IBS/CBS é compensável com PIS/Cofins (sem custo adicional).
      const ibsCbs = ano <= 2026 ? 0 : liquido;
      const total = icms + ipi + pisCofins + ibsCbs;
      return {
        ano,
        debitoIbsCbs: r2(debito),
        creditoIbsCbs: r2(credito),
        ibsCbsLiquido: r2(ibsCbs),
        icms: r2(icms),
        ipi: r2(ipi),
        pisCofins: r2(pisCofins),
        total: r2(total),
        variacaoVsHoje: r2(total - hojeTotal),
      };
    });
    return {
      regime,
      declarado: pc.declarado,
      hoje: {
        icms: b.icmsRecolhido,
        ipi: b.ipiDevido,
        pisCofins: pc.valor,
        total: hojeTotal,
        creditosAproveitados: r2(b.icmsCreditos + pc.creditos),
      },
      anos,
    };
  });
}
