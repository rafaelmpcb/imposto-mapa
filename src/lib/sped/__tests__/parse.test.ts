import { describe, expect, it } from "vitest";

import { parseSped, type SpedContribResumo, type SpedIcmsResumo } from "@/lib/sped/parse";

const icmsTxt = [
  "|0000|017|0|01012025|31012025|EMPRESA TESTE LTDA|12345678000199||SP|123|3550308|||A|1|",
  "|C190|000|5102|18,00|1000,00|1000,00|180,00|0|0|0|0||",
  "|C190|000|1102|18,00|400,00|400,00|72,00|0|0|0|0||",
  "|E110|180,00|0|0|0|72,00|0|0|0|50,00|58,00|0|58,00|0|0|",
  "|9999|5|",
].join("\r\n");

const contribTxt = [
  "|0000|006|0|||01012025|31012025|EMPRESA TESTE LTDA|12345678000199|SP|3550308||00|1|",
  "|0110|1|1|1||",
  "|M100|101|0|400,00|1,65|||6,60|0|0|0|6,60|0|6,60|0|",
  "|M200|16,50|6,60|0|9,90|0|0|9,90|0|0|0|0|9,90|",
  "|M210|01|1000,00|1000,00|1,65|",
  "|M600|76,00|30,40|0|45,60|0|0|45,60|0|0|0|0|45,60|",
  "|1100|012025|01||101|20,00|0|20,00|0|0|0|20,00|5,00|0|0|0|0|15,00|",
].join("\n");

describe("parseSped", () => {
  it("reconhece EFD ICMS-IPI e soma saídas, entradas e apuração", () => {
    const r = parseSped("icms.txt", icmsTxt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.tipo).toBe("icms_ipi");
    expect(r.item.periodoIni).toBe("2025-01-01");
    const s = r.item.resumo as SpedIcmsResumo;
    expect(s.saidas.valor).toBe(1000);
    expect(s.entradas.icms).toBe(72);
    expect(s.icms.aRecolher).toBe(58);
  });

  it("reconhece EFD Contribuições com receita, PIS/Cofins e saldo credor", () => {
    const r = parseSped("contrib.txt", contribTxt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.tipo).toBe("contribuicoes");
    const s = r.item.resumo as SpedContribResumo;
    expect(s.regime).toBe("nao_cumulativo");
    expect(s.receitaBruta).toBe(1000);
    expect(s.pis.totalARecolher).toBe(9.9);
    expect(s.cofins.totalARecolher).toBe(45.6);
    expect(s.pis.saldoCredorFinal).toBe(15);
  });

  it("recusa ECD como não lida", () => {
    expect(parseSped("ecd.txt", "|0000|LECD|01012025|31122025|X|").ok).toBe(false);
  });
});
