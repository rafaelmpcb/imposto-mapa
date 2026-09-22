import { describe, expect, it } from "vitest";

import { apurarLiquido, debitoEstimadoMercadorias } from "@/lib/apuracao/liquido";

const ok = (base: number, tributo: number) => ({
  valorBase: base,
  valorTributo: tributo,
  status: "ok",
});
const pendente = (base: number) => ({
  valorBase: base,
  valorTributo: 0,
  status: "ambiguo_revisao_pendente",
});

describe("apurarLiquido", () => {
  it("soma débitos e créditos das quatro origens", () => {
    const r = apurarLiquido({
      debitoServicos: [ok(1000, 10)],
      debitoMercadorias: [ok(2000, 20)],
      creditoServicos: [ok(500, 5)],
      creditoMercadorias: [ok(300, 3)],
    });
    expect(r.debitoTotal).toBe(30);
    expect(r.creditoTotal).toBe(8);
    expect(r.liquido).toBe(22);
    expect(r.vazio).toBe(false);
  });

  it("deixa itens pendentes de revisão fora das somas", () => {
    const r = apurarLiquido({
      debitoServicos: [ok(1000, 10), pendente(5000)],
      debitoMercadorias: [],
      creditoServicos: [pendente(800)],
      creditoMercadorias: [ok(300, 3)],
    });
    expect(r.debitoTotal).toBe(10);
    expect(r.creditoTotal).toBe(3);
    expect(r.liquido).toBe(7);
    expect(r.pendentesTotal).toBe(2);
    expect(r.debitoServicos.basePendente).toBe(5000);
  });

  it("indica saldo credor quando o crédito supera o débito", () => {
    const r = apurarLiquido({
      debitoServicos: [ok(100, 1)],
      debitoMercadorias: [],
      creditoServicos: [],
      creditoMercadorias: [ok(1000, 10)],
    });
    expect(r.liquido).toBe(-9);
  });

  it("marca ausência de documentos", () => {
    const r = apurarLiquido({
      debitoServicos: [],
      debitoMercadorias: [],
      creditoServicos: [],
      creditoMercadorias: [],
    });
    expect(r.vazio).toBe(true);
    expect(r.liquido).toBe(0);
  });

  it("estima o débito de mercadorias pela alíquota nominal de 2026", () => {
    expect(debitoEstimadoMercadorias(10_000)).toBe(100);
  });
});
