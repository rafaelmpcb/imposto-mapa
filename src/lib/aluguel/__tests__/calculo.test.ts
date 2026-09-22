import { describe, expect, it } from "vitest";

import { calcularContrato, type ContratoInput } from "../calculo";

const base: ContratoInput = {
  aluguelMensal: 10000,
  regimeLocador: "presumido",
  aproveitamentoCreditoPct: 100,
  ano: 2033,
  criterio: "liquido_locador",
};

describe("calculo de contratos de locação", () => {
  it("preserva a receita líquida do locador quando esse é o critério", () => {
    const res = calcularContrato(base);
    const atual = res.cenarios[0]!;
    const repactuado = res.cenarios[2]!;
    expect(repactuado.liquidoLocador).toBeCloseTo(atual.liquidoLocador, 1);
    expect(res.repactuacao.aluguelSugerido).toBeGreaterThan(atual.valorContrato);
  });

  it("preserva o custo efetivo do locatário quando esse é o critério", () => {
    const res = calcularContrato({ ...base, criterio: "custo_locatario" });
    const atual = res.cenarios[0]!;
    const repactuado = res.cenarios[2]!;
    expect(repactuado.custoEfetivoLocatario).toBeCloseTo(atual.custoEfetivoLocatario, 1);
  });

  it("não destaca IBS/CBS quando o locador é pessoa física fora do campo de incidência", () => {
    const res = calcularContrato({ ...base, regimeLocador: "pf_nao_contribuinte" });
    expect(res.aliquotaEfetivaPct).toBe(0);
    expect(res.cenarios[1]!.ibsCbs).toBe(0);
  });

  it("gera a série completa da transição", () => {
    const res = calcularContrato(base);
    expect(res.evolucao).toHaveLength(8);
    expect(res.evolucao.at(-1)?.ano).toBe(2033);
  });
});
