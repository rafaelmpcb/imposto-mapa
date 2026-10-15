import { describe, expect, it } from "vitest";

import { filtrarNotasDuplicadas, type NotaIdentidade } from "@/lib/carga/dedup";

function nota(parcial: Partial<NotaIdentidade> & { arquivo: string }): NotaIdentidade {
  return { chave: null, composta: null, ...parcial };
}

describe("filtrarNotasDuplicadas", () => {
  it("descarta nota cuja chave composta já existe no Caso, mesmo sem chave de acesso", () => {
    const enviadas = [
      nota({ arquivo: "nfse-2578.xml", composta: "21.153.354/0001-46||2578" }),
    ];
    const { novas, repetidas } = filtrarNotasDuplicadas(
      enviadas,
      new Set(),
      new Set(["21.153.354/0001-46||2578"]),
    );
    expect(novas).toHaveLength(0);
    expect(repetidas).toEqual([
      { chave: "21.153.354/0001-46||2578", arquivo: "nfse-2578.xml" },
    ]);
  });

  it("descarta a segunda ocorrência da mesma nota dentro do próprio lote", () => {
    const enviadas = [
      nota({ arquivo: "a.xml", composta: "123||10" }),
      nota({ arquivo: "b.xml", composta: "123||10" }),
    ];
    const { novas } = filtrarNotasDuplicadas(enviadas, new Set(), new Set());
    expect(novas).toHaveLength(1);
    expect(novas[0]?.arquivo).toBe("a.xml");
  });

  it("mantém notas com números diferentes do mesmo prestador", () => {
    const enviadas = [
      nota({ arquivo: "a.xml", composta: "123||10" }),
      nota({ arquivo: "b.xml", composta: "123||11" }),
    ];
    const { novas, repetidas } = filtrarNotasDuplicadas(enviadas, new Set(), new Set());
    expect(novas).toHaveLength(2);
    expect(repetidas).toHaveLength(0);
  });

  it("mantém nota sem nenhuma chave identificadora (não há como provar duplicidade)", () => {
    const enviadas = [nota({ arquivo: "sem-chave.xml" })];
    const { novas } = filtrarNotasDuplicadas(enviadas, new Set(), new Set());
    expect(novas).toHaveLength(1);
  });
});
