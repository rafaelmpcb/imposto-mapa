import { describe, expect, it } from "vitest";

import { janelasDePressao, projetarFluxo } from "@/lib/fluxo/projecao";

const params = {
  prazoRecebimentoDias: 30,
  prazoPagamentoDias: 30,
  periodicidadeCreditoDias: 30,
};

describe("projetarFluxo", () => {
  const meses = projetarFluxo(
    [
      {
        ano: 2027,
        entradasAno: 1200,
        saidasFornecedoresAno: 600,
        despesasAno: 120,
        debitoAno: 240,
        creditoAno: 120,
      },
    ],
    params,
  );

  it("gera doze meses", () => {
    expect(meses).toHaveLength(12);
  });

  it("desloca entradas e saídas em um mês", () => {
    expect(meses[0]!.entradasClientes).toBe(0);
    expect(meses[1]!.entradasClientes).toBe(100);
    expect(meses[0]!.saidasFornecedores).toBe(0);
    expect(meses[1]!.saidasFornecedores).toBe(50);
  });

  it("débito é retido no mês da venda e crédito chega com defasagem", () => {
    expect(meses[0]!.debitoIbsCbsRetido).toBe(20);
    expect(meses[0]!.creditoIbsCbsDisponivel).toBe(0);
    expect(meses[0]!.debitoLiquidoRecolhido).toBe(20);
    expect(meses[1]!.creditoIbsCbsDisponivel).toBe(10);
    expect(meses[1]!.debitoLiquidoRecolhido).toBe(10);
  });

  it("acumula saldo credor quando o crédito supera o débito", () => {
    const comCredito = projetarFluxo(
      [
        {
          ano: 2027,
          entradasAno: 0,
          saidasFornecedoresAno: 0,
          despesasAno: 0,
          debitoAno: 120,
          creditoAno: 360,
        },
      ],
      { ...params, periodicidadeCreditoDias: 0 },
    );
    expect(comCredito[0]!.saldoCredorAcumulado).toBe(20);
    expect(comCredito[1]!.saldoCredorAcumulado).toBe(40);
    expect(comCredito[0]!.debitoLiquidoRecolhido).toBe(0);
  });
});

describe("janelasDePressao", () => {
  it("sinaliza apenas sequências de dois meses ou mais", () => {
    const meses = projetarFluxo(
      [
        {
          ano: 2027,
          entradasAno: 0,
          saidasFornecedoresAno: 1200,
          despesasAno: 0,
          debitoAno: 0,
          creditoAno: 0,
        },
      ],
      params,
    );
    const janelas = janelasDePressao(meses);
    expect(janelas).toHaveLength(1);
    expect(janelas[0]!.inicio.mes).toBe(2);
  });
});
