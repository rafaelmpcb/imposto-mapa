import { describe, expect, it } from "vitest";

import { calcularEquiparacao, classificarReceita, tributosTrimestre } from "../calculo";

describe("equiparação hospitalar", () => {
  it("sem equiparação usa presunção de 32% para IRPJ e CSLL", () => {
    const t = tributosTrimestre(300_000, 1, false);
    expect(t.baseIrpj).toBeCloseTo(96_000);
    expect(t.baseCsll).toBeCloseTo(96_000);
    // 15% de 96.000 + 10% de 36.000 (excedente de 60.000)
    expect(t.irpj).toBeCloseTo(18_000);
    expect(t.csll).toBeCloseTo(8_640);
  });

  it("procedimentos usam 8% (IRPJ) e 12% (CSLL)", () => {
    const t = tributosTrimestre(300_000, 1, true);
    expect(t.baseIrpj).toBeCloseTo(24_000);
    expect(t.baseCsll).toBeCloseTo(36_000);
    expect(t.irpj).toBeCloseTo(3_600);
  });

  it("consultas continuam em 32% na segregação", () => {
    const t = tributosTrimestre(300_000, 0.5, true);
    expect(t.baseIrpj).toBeCloseTo(150_000 * 0.08 + 150_000 * 0.32);
  });

  it("indébito limitado a 60 meses", () => {
    const r = calcularEquiparacao({
      receitaMensal: 100_000, fracaoProcedimentos: 1, mesesRetroativos: 90, selicAcumuladaPct: 0, exitoPct: 20,
    });
    expect(r.meses).toBe(60);
    expect(r.indebitoNominal).toBeCloseTo(r.economiaMensal * 60);
    expect(r.honorariosExito).toBeCloseTo(r.indebitoAtualizado * 0.2);
  });

  it("classifica consulta e exame", () => {
    expect(classificarReceita("Consulta médica eletiva", null)).toBe("consulta");
    expect(classificarReceita("Ultrassonografia abdominal", null)).toBe("procedimento");
    expect(classificarReceita("Serviços diversos", "04.02")).toBe("procedimento");
    expect(classificarReceita("Serviços diversos", "04.01")).toBe("revisar");
  });
});
