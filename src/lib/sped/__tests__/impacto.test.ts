import { describe, expect, it } from "vitest";

import { impactoPorRegime, type BaseSpedAnual } from "@/lib/sped/impacto";

const base: BaseSpedAnual = {
  meses: 12,
  receita: 1_000_000,
  entradas: 400_000,
  icmsDebitos: 180_000,
  icmsCreditos: 72_000,
  icmsRecolhido: 108_000,
  ipiDevido: 0,
  pisCofinsRecolhido: 55_500,
  pisCofinsCreditos: 37_000,
  regimeDeclarado: "nao_cumulativo",
  saldoCredorIcms: 0,
  saldoCredorPisCofins: 0,
};

describe("impactoPorRegime", () => {
  const [real, presumido] = impactoPorRegime(base, 26.5);

  it("usa o PIS/Cofins declarado no SPED para o regime atual", () => {
    expect(real!.declarado).toBe(true);
    expect(real!.hoje.total).toBe(163_500);
  });

  it("estima o Presumido com PIS/Cofins cumulativo de 3,65% da receita", () => {
    expect(presumido!.declarado).toBe(false);
    expect(presumido!.hoje.pisCofins).toBe(36_500);
  });

  it("em 2033 sobra só IBS/CBS sobre o valor adicionado (receita − entradas)", () => {
    const a = real!.anos.find((x) => x.ano === 2033)!;
    expect(a.icms).toBe(0);
    expect(a.pisCofins).toBe(0);
    expect(a.ibsCbsLiquido).toBe(159_000);
  });

  it("em 2026 o IBS/CBS-teste não soma custo", () => {
    expect(real!.anos.find((x) => x.ano === 2026)!.ibsCbsLiquido).toBe(0);
  });
});

describe("baseAnual — expurgo de CFOPs sem crédito", () => {
  it("tira remessas, transferências e devoluções da base de crédito", async () => {
    const { baseAnual } = await import("@/lib/sped/impacto");
    const zero = { debitos: 0, ajustesDebitos: 0, estornosCreditos: 0, creditos: 0, ajustesCreditos: 0, estornosDebitos: 0, saldoCredorAnterior: 0, saldoApurado: 0, deducoes: 0, aRecolher: 0, saldoCredorTransportar: 0 };
    const b = baseAnual(
      [{ periodo_ini: "2025-01-01", resumo: { icms: zero, ipi: null, saidas: { valor: 1000, icms: 0 }, entradas: { valor: 1000, icms: 0 }, inventario: null,
        porCfop: [{ cfop: "1102", valor: 400, icms: 0 }, { cfop: "1949", valor: 300, icms: 0 }, { cfop: "1152", valor: 200, icms: 0 }, { cfop: "1202", valor: 100, icms: 0 }] } }],
      [],
    )!;
    expect(b.entradasComCredito).toBe(4800);
    expect(b.expurgos).toEqual({ remessas: 3600, transferencias: 2400, devolucoes: 1200 });
  });
});
