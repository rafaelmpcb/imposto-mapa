import { describe, expect, it } from "vitest";

import {
  calcularContrato,
  minutaClausula,
  minutaNotificacao,
  type ContratoInput,
} from "@/lib/contratos/calculo";

const base: ContratoInput = {
  precoMensalAtual: 10000,
  regimePrestador: "presumido",
  perfilContratante: "regular",
  custoDiretoPct: 50,
  creditoInsumosPct: 0,
  ano: 2033,
  cenario: "margem_prestador",
};

describe("reequilíbrio de contratos", () => {
  it("preserva a margem do prestador no cenário A", () => {
    const r = calcularContrato(base);
    const a = r.cenarios.find((c) => c.id === "margem_prestador")!;
    expect(a.detalhe.margemPrestador).toBeCloseTo(r.atual.margemPrestador, 1);
    expect(a.precoSugerido).toBeGreaterThan(r.atual.precoContrato);
  });

  it("preserva o custo líquido do contratante no cenário B", () => {
    const r = calcularContrato(base);
    const b = r.cenarios.find((c) => c.id === "custo_contratante")!;
    expect(b.detalhe.custoLiquidoContratante).toBeCloseTo(r.atual.custoLiquidoContratante, 1);
  });

  it("coloca o equilíbrio entre os dois cenários", () => {
    const r = calcularContrato(base);
    const [a, b, c] = ["margem_prestador", "custo_contratante", "equilibrio"].map(
      (id) => r.cenarios.find((x) => x.id === id)!.precoSugerido,
    ) as [number, number, number];
    expect(c).toBeCloseTo((a + b) / 2, 0);
  });

  it("não gera crédito ao contratante fora do regime regular", () => {
    const r = calcularContrato({ ...base, perfilContratante: "consumidor_final" });
    expect(r.cenarios[0]!.detalhe.creditoContratante).toBe(0);
    expect(r.avisos.join(" ")).toContain("não recupera");
  });

  it("cobre toda a rampa de transição", () => {
    const r = calcularContrato(base);
    expect(r.evolucao).toHaveLength(8);
    expect(r.evolucao[0]!.ano).toBe(2026);
    expect(r.evolucao.at(-1)!.ano).toBe(2033);
  });

  it("classifica o semáforo pelo tamanho da variação", () => {
    const leve = calcularContrato({ ...base, ano: 2026, substituidaPct: 0, mantidaPct: 0 });
    expect(leve.semaforo).toBe("baixo");
    const pesado = calcularContrato({
      ...base,
      ano: 2033,
      substituidaPct: 0,
      mantidaPct: 0,
      custoDiretoPct: 0,
    });
    expect(pesado.semaforo).toBe("alto");
  });

  it("gera minutas com os valores do cenário escolhido", () => {
    const r = calcularContrato(base);
    expect(minutaClausula(r, "Contrato de TI")).toContain("Contrato de TI");
    expect(minutaNotificacao(r, "Contrato de TI", "Alfa Ltda")).toContain("Alfa Ltda");
  });
});
