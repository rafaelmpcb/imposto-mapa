import { describe, expect, it } from "vitest";

import { ircsPorAno, montarDre, type DreInsumos } from "@/lib/dre/calculo";

const insumos: DreInsumos = {
  receitaBrutaAtual: 1000,
  receitaBrutaDesonerada: 900,
  tributosAtuaisVendas: 100,
  debitoIbsCbsPleno: 200,
  custoCompras: 500,
  creditoIbsCbsPleno: 80,
};

describe("montarDre", () => {
  const anos = [
    { ano: 2026, fracao: 0 },
    { ano: 2033, fracao: 1 },
  ];
  const ircs = ircsPorAno([{ ano: 2026, atual: 30, projetado: 40 }]);
  const linhas = montarDre({ insumos, anos, despesasPorAno: { 2026: 100, 2033: 100 }, ircs });

  const achar = (ano: number, cenario: string) =>
    linhas.find((l) => l.ano === ano && l.cenario === cenario)!;

  it("em 2026 (fração zero) os dois cenários coincidem", () => {
    expect(achar(2026, "projetado").receitaBruta).toBe(achar(2026, "atual").receitaBruta);
    expect(achar(2026, "projetado").custo).toBe(500);
  });

  it("em regime pleno usa base desonerada, débito IBS/CBS e custo com crédito", () => {
    const l = achar(2033, "projetado");
    expect(l.receitaBruta).toBe(900);
    expect(l.deducoes).toBe(200);
    expect(l.receitaLiquida).toBe(700);
    expect(l.custo).toBe(420);
    expect(l.lucroBruto).toBe(280);
    expect(l.resultadoAntesIrcs).toBe(180);
  });

  it("repete o IR/CS do marco anterior e sinaliza a origem", () => {
    expect(achar(2033, "atual").ircs).toBe(30);
    expect(achar(2033, "atual").ircsOrigem).toBe("marco_anterior");
    expect(achar(2026, "atual").ircsOrigem).toBe("motor_regime");
  });

  it("sem simulação o resultado líquido fica indisponível", () => {
    const semIrcs = montarDre({
      insumos,
      anos,
      despesasPorAno: {},
      ircs: () => ({ valor: null, origem: "indisponivel" }),
    });
    expect(semIrcs[0]!.resultadoLiquido).toBeNull();
  });
});
