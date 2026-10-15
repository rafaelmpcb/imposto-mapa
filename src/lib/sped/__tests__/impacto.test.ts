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
