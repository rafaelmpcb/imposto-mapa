import { describe, expect, it } from "vitest";

import { calcularCapex, fluxoMensal, type CapexInput } from "@/lib/capex/calculo";

const base: CapexInput = {
  valorInvestimento: 1_000_000,
  tipoAtivo: "maquinas",
  regime: "real",
  icmsPct: 18,
  ipiPct: 5,
  fatorCiapPct: 100,
  custoOportunidadeAaPct: 12,
  ano: 2033,
};

describe("capex", () => {
  it("credita IBS/CBS integral e imediato em 2033", () => {
    const fluxo = fluxoMensal(base, 2033);
    expect(fluxo).toHaveLength(48);
    expect(fluxo[0]!.creditoIbsCbs).toBeCloseTo(265_000, 0);
    // ICMS extinto em 2033
    expect(fluxo[0]!.creditoIcms).toBe(0);
  });

  it("dilui o ICMS em 48 parcelas iguais nas aquisições de 2026", () => {
    const fluxo = fluxoMensal(base, 2026);
    expect(fluxo[0]!.creditoIcms).toBeCloseTo(180_000 / 48, 2);
    expect(fluxo[47]!.creditoIcms).toBeCloseTo(180_000 / 48, 2);
  });

  it("não gera crédito no Simples Nacional", () => {
    const r = calcularCapex({ ...base, regime: "simples" });
    expect(r.anoSelecionado.creditoTotal).toBe(0);
  });

  it("valor presente é menor que o crédito nominal quando há diluição", () => {
    const r = calcularCapex({ ...base, ano: 2026 });
    expect(r.anoSelecionado.vpl).toBeLessThan(r.anoSelecionado.creditoTotal);
    expect(r.anoSelecionado.perdaDiluicao).toBeGreaterThan(0);
  });
});
