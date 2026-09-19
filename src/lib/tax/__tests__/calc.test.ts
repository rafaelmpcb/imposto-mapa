import { describe, expect, it } from "vitest";

import {
  compareRegimes,
  DEFAULT_PROFIT_MARGIN,
  defaultInput,
  effectiveRate,
  inferSimplesAnexo,
  needsBenefitValidation,
  simulate,
  type SimulationInput,
} from "../calc";
import { REFERENCE_RATE } from "../constants";

const company = (over: Partial<SimulationInput> = {}): SimulationInput => ({
  ...defaultInput(),
  taxpayerType: "presumido",
  activityId: "servicos_gerais",
  uf: "SP",
  revenue: 100000,
  payroll: 20000,
  ...over,
});

describe("Pessoa Física (CLT)", () => {
  it("cobra INSS e IRPF no cenário atual", () => {
    const r = simulate({ ...defaultInput(), taxpayerType: "pf", salary: 8000 }, 2027);
    expect(r.base).toBe(8000);
    expect(r.current.total).toBeGreaterThan(0);
    expect(r.current.lines.map((l) => l.label)).toContain("INSS");
  });

  it("zera o IRPF até R$ 5.000 a partir de 2027", () => {
    const r = simulate({ ...defaultInput(), taxpayerType: "pf", salary: 5000 }, 2027);
    const irpf = r.reform.lines.find((l) => l.label.startsWith("IRPF"));
    expect(irpf).toBeUndefined();
    expect(r.reform.total).toBeLessThan(r.current.total);
  });

  it("mantém a regra antiga em 2026", () => {
    const r = simulate({ ...defaultInput(), taxpayerType: "pf", salary: 5000 }, 2026);
    expect(r.reform.total).toBeCloseTo(r.current.total, 6);
  });

  it("avisa que o IRPF vem de outra lei quando há diferença", () => {
    const r = simulate({ ...defaultInput(), taxpayerType: "pf", salary: 6000 }, 2027);
    expect(r.notes.join(" ")).toContain("Lei 15.270/2025");
  });
});

describe("MEI", () => {
  it("mantém o DAS fixo nos dois cenários", () => {
    const r = simulate({ ...defaultInput(), taxpayerType: "mei", revenue: 8000 }, 2033);
    expect(r.current.total).toBeCloseTo(r.reform.total, 6);
  });
});

describe("Benefícios de atividade", () => {
  it("exige validação societária só para as reduções de 30% (Art. 127)", () => {
    expect(needsBenefitValidation(company({ activityId: "advocacia" }))).toBe(true);
    expect(needsBenefitValidation(company({ activityId: "contabilidade" }))).toBe(true);
    expect(needsBenefitValidation(company({ activityId: "engenharia" }))).toBe(true);
  });

  it("aplica automaticamente as reduções de 60% (Art. 125)", () => {
    for (const id of ["saude", "educacao", "cultura", "agro"]) {
      const input = company({ activityId: id });
      expect(needsBenefitValidation(input)).toBe(false);
      expect(effectiveRate(input).applied).toBe(true);
      expect(effectiveRate(input).rate).toBeCloseTo(REFERENCE_RATE * 0.4, 8);
    }
  });

  it("reduz 30% na advocacia quando a composição societária é confirmada", () => {
    const input = company({ activityId: "advocacia", benefitConfirmed: true });
    expect(effectiveRate(input).rate).toBeCloseTo(REFERENCE_RATE * 0.7, 8);
  });

  it("perde o benefício quando a composição societária não atende", () => {
    const input = company({ activityId: "advocacia", benefitConfirmed: false });
    const e = effectiveRate(input);
    expect(e.applied).toBe(false);
    expect(e.lost).toBe(true);
    expect(e.rate).toBeCloseTo(REFERENCE_RATE, 8);
  });

  it("não reduz nada em atividade sem benefício", () => {
    expect(effectiveRate(company({ activityId: "varejo" })).rate).toBeCloseTo(REFERENCE_RATE, 8);
  });
});

describe("Transição por ano (Lucro Presumido)", () => {
  const input = company();

  it("2026 mantém PIS/COFINS e ISS", () => {
    const labels = simulate(input, 2026).reform.lines.map((l) => l.label).join(" | ");
    expect(labels).toContain("PIS");
    expect(labels).toContain("COFINS");
    expect(labels).toContain("ISS");
    expect(labels).not.toContain("IBS + CBS");
  });

  it("2027 substitui PIS/COFINS pela CBS e mantém o ISS", () => {
    const labels = simulate(input, 2027).reform.lines.map((l) => l.label).join(" | ");
    expect(labels).toContain("IBS + CBS");
    expect(labels).toContain("ISS");
    expect(labels).not.toMatch(/^PIS/);
  });

  it("2033 tem apenas IBS/CBS no consumo", () => {
    const labels = simulate(input, 2033).reform.lines.map((l) => l.label).join(" | ");
    expect(labels).toContain("IBS + CBS");
    expect(labels).not.toContain("ISS");
    expect(labels).not.toContain("COFINS");
  });

  it("em 2026 o impacto é praticamente neutro", () => {
    const r = simulate(input, 2026);
    expect(Math.abs(r.reform.total - r.current.total)).toBeLessThan(r.current.total * 0.02);
  });
});

describe("Estrutura do cálculo empresarial", () => {
  it("carga é o total dividido pelo faturamento", () => {
    const r = simulate(company({ revenue: 200000 }), 2033);
    expect(r.reform.rate).toBeCloseTo(r.reform.total / 200000, 8);
  });

  it("créditos de compras reduzem o IBS/CBS em 2033", () => {
    const semCredito = simulate(company({ purchases: 0 }), 2033).reform.total;
    const comCredito = simulate(company({ purchases: 40000 }), 2033).reform.total;
    expect(comCredito).toBeLessThan(semCredito);
  });

  it("CPP acompanha a folha informada", () => {
    const a = simulate(company({ payroll: 10000 }), 2027).reform.total;
    const b = simulate(company({ payroll: 20000 }), 2027).reform.total;
    expect(b - a).toBeCloseTo(2000, 6);
  });
});

describe("Simples Nacional", () => {
  it("permanece inalterado antes de 2033", () => {
    const r = simulate(company({ taxpayerType: "simples", simplesAnexo: "III" }), 2027);
    expect(r.reform.total).toBeCloseTo(r.current.total, 6);
  });

  it("calcula IBS/CBS apenas na hipótese de saída para o regime regular em 2033", () => {
    const r = simulate(company({ taxpayerType: "simples" }), 2033);
    expect(r.reform.lines[0]?.label).toContain("IBS + CBS");
    expect(r.notes.join(" ")).toContain("exclusivamente a hipótese de saída do Simples");
    expect(r.notes.join(" ")).toContain("não exibir um valor estimado");
  });

  it("mantém IRPJ, CSLL e CPP no cenário de 2033", () => {
    const r = simulate(company({ taxpayerType: "simples", payroll: 20000 }), 2033);
    const labels = r.reform.lines.map((l) => l.label).join(" | ");
    expect(labels).toContain("IRPJ");
    expect(labels).toContain("CSLL");
    expect(labels).toContain("CPP");
    const ibsCbs = r.reform.lines.find((l) => l.label.includes("IBS + CBS"))!.value;
    expect(r.reform.total).toBeGreaterThan(ibsCbs);
  });


  it("anexo V é mais caro que o anexo I no mesmo faturamento", () => {
    const i = simulate(company({ taxpayerType: "simples", simplesAnexo: "I" }), 2026).current.total;
    const v = simulate(company({ taxpayerType: "simples", simplesAnexo: "V" }), 2026).current.total;
    expect(v).toBeGreaterThan(i);
  });
});

describe("Comparação entre regimes", () => {
  it("retorna os três regimes e marca o atual e o mais vantajoso", () => {
    const items = compareRegimes(company({ taxpayerType: "presumido" }), 2033);
    expect(items.map((i) => i.regime)).toEqual(["simples", "presumido", "real"]);
    expect(items.filter((i) => i.isCurrent)).toHaveLength(1);
    expect(items.find((i) => i.isCurrent)?.regime).toBe("presumido");
    expect(items.filter((i) => i.isBest).length).toBeGreaterThanOrEqual(1);
    const totals = items.flatMap((item) => item.total === null ? [] : [item.total]);
    const min = Math.min(...totals);
    expect(items.find((i) => i.isBest)?.total).toBeCloseTo(min, 6);
  });

  it("não estima a permanência no Simples em 2033 nem a marca como mais vantajosa", () => {
    const simples = compareRegimes(company({ taxpayerType: "simples" }), 2033).find(
      (item) => item.regime === "simples",
    );
    expect(simples?.label).toBe("Permanecer no Simples em 2033");
    expect(simples?.isAvailable).toBe(false);
    expect(simples?.total).toBeNull();
    expect(simples?.rate).toBeNull();
    expect(simples?.lines).toEqual([]);
    expect(simples?.isBest).toBe(false);
  });

  it("estima o anexo do Simples e a margem do Lucro Real quando não são o regime atual", () => {
    const items = compareRegimes(company({ taxpayerType: "presumido" }), 2027);
    expect(items.find((i) => i.regime === "simples")?.estimateNote).toContain("Anexo");
    expect(items.find((i) => i.regime === "real")?.estimateNote).toContain(
      String(DEFAULT_PROFIT_MARGIN),
    );
    expect(items.find((i) => i.regime === "presumido")?.estimateNote).toBeUndefined();
  });

  it("infere o anexo a partir da atividade", () => {
    expect(inferSimplesAnexo("varejo")).toBe("I");
    expect(inferSimplesAnexo("industria")).toBe("II");
    expect(inferSimplesAnexo("advocacia")).toBe("IV");
    expect(inferSimplesAnexo("saude")).toBe("III");
  });

  it("cada item traz o detalhamento tributo a tributo", () => {
    for (const item of compareRegimes(company(), 2027)) {
      expect(item.lines.length).toBeGreaterThan(0);
    }
  });
});
