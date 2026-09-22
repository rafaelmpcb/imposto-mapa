import { describe, expect, it } from "vitest";

import { calcularMonofasico, type MonofasicoInput } from "@/lib/monofasico/calculo";

const base: MonofasicoInput = {
  segmento: "farmacia",
  regime: "presumido",
  faturamentoMensal: 100_000,
  participacaoMonofasicaPct: 50,
  aliquotaEfetivaDasPct: 0,
  parcelaPisCofinsPct: 0,
  mesesRetroativos: 60,
  selicAaPct: 0,
  honorarioExitoPct: 20,
};

describe("calcularMonofasico", () => {
  it("calcula o pago a maior no lucro presumido", () => {
    const r = calcularMonofasico(base);
    expect(r.receitaMonofasicaMensal).toBe(50_000);
    expect(r.pagoAMaiorMensal).toBeCloseTo(1825, 2);
    expect(r.principalPeriodo).toBeCloseTo(1825 * 60, 2);
    expect(r.correcaoSelic).toBe(0);
  });

  it("aplica honorário de êxito sobre o total corrigido", () => {
    const r = calcularMonofasico(base);
    expect(r.honorario).toBeCloseTo(r.totalRecuperavel * 0.2, 2);
    expect(r.liquidoCliente).toBeCloseTo(r.totalRecuperavel * 0.8, 2);
  });

  it("usa a parcela de PIS/COFINS do DAS no Simples Nacional", () => {
    const r = calcularMonofasico({
      ...base,
      regime: "simples",
      aliquotaEfetivaDasPct: 8,
      parcelaPisCofinsPct: 15.5,
    });
    expect(r.premissas.aliquotaEfetivaPisCofinsPct).toBeCloseTo(1.24, 2);
    expect(r.pagoAMaiorMensal).toBeCloseTo(620, 2);
  });

  it("limita o período a 60 meses e corrige pela Selic", () => {
    const r = calcularMonofasico({ ...base, mesesRetroativos: 120, selicAaPct: 12 });
    expect(r.premissas.mesesRetroativos).toBe(60);
    expect(r.correcaoSelic).toBeGreaterThan(0);
    expect(r.totalRecuperavel).toBeGreaterThan(r.principalPeriodo);
  });

  it("zera o resultado sem faturamento", () => {
    const r = calcularMonofasico({ ...base, faturamentoMensal: 0 });
    expect(r.totalRecuperavel).toBe(0);
    expect(r.leitura).toContain("Informe o faturamento");
  });
});
