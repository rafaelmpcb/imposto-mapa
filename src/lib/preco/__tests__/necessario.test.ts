import { describe, expect, it } from "vitest";

import {
  aliquotaComReducao,
  calcularPrecoNecessarioItem,
  projetarPorAno,
  reducaoDoNbs,
} from "@/lib/preco/necessario";

describe("preço necessário", () => {
  it("preserva o valor desonerado depois do novo tributo", () => {
    const r = calcularPrecoNecessarioItem(1000, [180, 0, 16.5, 76], 0.265);
    expect(r.tributosAtuaisTotal).toBe(272.5);
    expect(r.valorDesonerado).toBe(727.5);
    expect(r.precoNecessario).toBe(920.29);
    expect(r.variacaoPrecoPct).toBeLessThan(0);
    expect(r.status).toBe("ok");
  });

  it("não deixa o valor desonerado ficar negativo", () => {
    const r = calcularPrecoNecessarioItem(100, [150], 0.265);
    expect(r.valorDesonerado).toBe(0);
    expect(r.status).toBe("valor_desonerado_invalido");
  });

  it("aplica a redução da tabela sobre a alíquota plena", () => {
    expect(aliquotaComReducao(26.5, 60)).toBeCloseTo(0.106, 6);
    expect(reducaoDoNbs(0.1, 0.9)).toBe(0);
    expect(reducaoDoNbs(0.04, 0.36)).toBeCloseTo(60, 6);
  });

  it("projeta o preço ano a ano pela fração da rampa", () => {
    const serie = projetarPorAno(1000, 800, 0.265, [
      { ano: 2027, fracao: 0.1 },
      { ano: 2033, fracao: 1 },
    ]);
    expect(serie[0]!.precoNecessarioAno).toBe(821.2);
    expect(serie[1]!.precoNecessarioAno).toBe(1012);
  });
});
