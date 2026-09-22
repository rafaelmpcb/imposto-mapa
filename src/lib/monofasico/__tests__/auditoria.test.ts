import { describe, expect, it } from "vitest";

import {
  buscarNcm,
  classificarItem,
  indexarCatalogo,
  isSaida,
  resumirAuditoria,
  type CatalogoNcmMonofasico,
  type ItemAuditoria,
} from "@/lib/monofasico/auditoria";

const catalogo: CatalogoNcmMonofasico[] = [
  {
    ncmPrefixo: "3004",
    descricao: "Medicamentos dosificados",
    grupo: "Medicamentos",
    cstEsperado: "04",
    cstAlternativos: ["04", "06"],
    baseLegal: "Lei 10.147/2000",
    observacao: null,
  },
  {
    ncmPrefixo: "34011190",
    descricao: "Sabão de toucador",
    grupo: "Perfumaria e cosméticos",
    cstEsperado: "04",
    cstAlternativos: ["04"],
    baseLegal: "Lei 10.147/2000",
    observacao: null,
  },
];

const index = indexarCatalogo(catalogo);

const item = (over: Partial<ItemAuditoria>): ItemAuditoria => ({
  arquivo: "nota.xml",
  chave: "1".repeat(44),
  modelo: "55",
  numero: "1",
  dataEmissao: "2026-03-10T00:00:00.000Z",
  ncm: "30049099",
  cfop: "5102",
  descricao: "Dipirona",
  valorItem: 1000,
  cstPis: "01",
  cstCofins: "01",
  valorPis: 16.5,
  valorCofins: 76,
  ...over,
});

describe("auditoria monofásica", () => {
  it("encontra o NCM pelo prefixo mais específico", () => {
    expect(buscarNcm("30049099", index)?.grupo).toBe("Medicamentos");
    expect(buscarNcm("34011190", index)?.grupo).toBe("Perfumaria e cosméticos");
    expect(buscarNcm("22030000", index)).toBeNull();
  });

  it("aponta indébito quando o item monofásico foi tributado", () => {
    const res = classificarItem(item({}), index, "real", 0);
    expect(res.classificacao).toBe("possivel_indebito");
    expect(res.indebitoEstimado).toBe(92.5);
    expect(res.competencia).toBe("2026-03");
  });

  it("usa a alíquota efetiva do DAS no Simples", () => {
    const res = classificarItem(item({}), index, "simples", 1.5);
    expect(res.indebitoEstimado).toBe(15);
  });

  it("reconhece o item já segregado como correto", () => {
    const res = classificarItem(
      item({ cstPis: "04", cstCofins: "04", valorPis: 0, valorCofins: 0 }),
      index,
      "real",
      0,
    );
    expect(res.classificacao).toBe("monofasico_correto");
    expect(res.indebitoEstimado).toBe(0);
  });

  it("ignora itens fora do catálogo e sem NCM", () => {
    expect(classificarItem(item({ ncm: "22030000" }), index, "real", 0).classificacao).toBe(
      "nao_monofasico",
    );
    expect(classificarItem(item({ ncm: null }), index, "real", 0).classificacao).toBe("sem_ncm");
  });

  it("resume receita, participação e indébito", () => {
    const itens = [
      classificarItem(item({}), index, "real", 0),
      classificarItem(item({ ncm: "22030000", chave: "2".repeat(44) }), index, "real", 0),
    ];
    const resumo = resumirAuditoria(itens);
    expect(resumo.notas).toBe(2);
    expect(resumo.receitaTotal).toBe(2000);
    expect(resumo.receitaMonofasica).toBe(1000);
    expect(resumo.participacaoMonofasicaPct).toBe(50);
    expect(resumo.indebitoTotal).toBe(92.5);
    expect(resumo.grupos[0]?.rotulo).toBe("Medicamentos");
  });

  it("filtra CFOP de saída", () => {
    expect(isSaida("5102")).toBe(true);
    expect(isSaida("1102")).toBe(false);
  });
});
