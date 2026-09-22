import { describe, expect, it } from "vitest";

import { PARCELAS_ICMS, calcularSaldos, fluxoIcms } from "../calculo";

const base = {
  saldoIcms: 1_000_000,
  saldoPisCofins: 200_000,
  custoOportunidadeAaPct: 12,
  ipcaAaPct: 4,
  desagioCessaoPct: 30,
  mesesCompensacaoCbs: 24,
  anoBase: 2026,
};

describe("saldos credores", () => {
  it("gera 240 parcelas de ICMS", () => {
    expect(fluxoIcms(base)).toHaveLength(PARCELAS_ICMS);
  });

  it("o valor presente da inércia é menor que o saldo nominal", () => {
    const r = calcularSaldos(base);
    expect(r.icms.vplInercia).toBeLessThan(r.icms.saldo);
    expect(r.icms.perdaInercia).toBeGreaterThan(0);
  });

  it("a cessão com 30% de deságio supera a espera de 20 anos", () => {
    const r = calcularSaldos(base);
    expect(r.icms.caixaCessao).toBeGreaterThan(r.icms.vplInercia);
    expect(r.icms.ganhoCessao).toBeGreaterThan(0);
  });

  it("zera com saldos vazios", () => {
    const r = calcularSaldos({ ...base, saldoIcms: 0, saldoPisCofins: 0 });
    expect(r.saldoTotal).toBe(0);
    expect(r.totais.ganhoAcaoAtiva).toBe(0);
  });

  it("PIS/COFINS perde menos valor por ter prazo curto", () => {
    const r = calcularSaldos(base);
    expect(r.pisCofins.perdaCompensacao).toBeLessThan(r.pisCofins.saldo * 0.2);
  });
});
