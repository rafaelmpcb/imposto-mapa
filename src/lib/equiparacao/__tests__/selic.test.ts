import { describe, expect, it } from "vitest";
import { indebitoSelicReal, selicAcumuladaPct } from "../calculo";

const tab = [["2024-01", 1], ["2024-02", 0.8], ["2024-03", 0.9], ["2024-04", 0.85]] as const;

describe("Selic real", () => {
  it("soma do mês seguinte ao pagamento até o anterior à referência, mais 1%", () => {
    expect(selicAcumuladaPct("2024-01", "2024-04", tab)).toBeCloseTo(0.8 + 0.9 + 1);
  });
  it("60 meses geram 20 trimestres encerrados", () => {
    const r = indebitoSelicReal(1000, 60, new Date(Date.UTC(2026, 9, 9)));
    expect(r.linhas).toHaveLength(20);
    expect(r.linhas.at(-1)?.trimestre).toBe("3º tri/2026");
    expect(r.nominal).toBe(20000);
    expect(r.atualizado).toBeGreaterThan(r.nominal);
  });
});
