/**
 * Leitura de notas fiscais de compra (XML de NF-e), no navegador.
 * Só o cabeçalho da nota é usado: emitente (fornecedor), valor total, data,
 * chave, número e série. Os itens (det) são ignorados de propósito.
 */

import JSZip from "jszip";

import { onlyDigits } from "@/lib/carteira/types";

export type NfeStatus = "ok" | "sem_cnpj_emitente" | "xml_invalido" | "nao_e_nfe";

/** Regime do emitente, direto do CRT da nota (1/2 = Simples, 3 = Regular). */
export type NfeRegime = "simples" | "regular" | "erro";

export function regimeFromCrt(crt: string | null): NfeRegime {
  if (crt === "1" || crt === "2") return "simples";
  if (crt === "3") return "regular";
  return "erro";
}

/** Item (det) da nota, usado para apurar o crédito de IBS/CBS. */
export interface NfeItem {
  ncm: string | null;
  cfop: string | null;
  descricao: string | null;
  quantidade: number;
  valorItem: number;
  temIbscbs: boolean;
  cclasstrib: string | null;
  baseCalculo: number;
  vCBS: number;
  vIBSUF: number;
  vIBSMun: number;
}

export interface NfeNota {
  arquivo: string;
  chave: string | null;
  numero: string | null;
  serie: string | null;
  cnpjEmitente: string | null;
  razaoSocialEmitente: string | null;
  crt: string | null;
  regime: NfeRegime;
  valorTotal: number;
  dataEmissao: string | null;
  status: NfeStatus;
  itens: NfeItem[];
}

export interface NfeAgregado {
  cnpj: string;
  nome: string;
  valor: number;
  notas: number;
  regime: NfeRegime;
  /** Data da nota mais recente usada na soma. */
  ultimaEmissao: string | null;
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").trim();

const num = (node: Element | null | undefined) =>
  Number(text(node).replace(",", ".")) || 0;

/** Busca a primeira tag com esse nome local, ignorando namespace. */
function tag(root: ParentNode, name: string): Element | null {
  const found = root.querySelectorAll(name);
  return found.length > 0 ? (found[0] as Element) : null;
}

/** Lê os itens (det) da nota: produto e, quando existir, o bloco IBSCBS. */
export function parseItens(infNFe: Element): NfeItem[] {
  const dets = Array.from(infNFe.getElementsByTagName("det"));
  return dets.map((det) => {
    const prod = tag(det, "prod");
    const ibscbs = tag(det, "IBSCBS");
    const gIbscbs = ibscbs ? tag(ibscbs, "gIBSCBS") : null;
    const gCbs = gIbscbs ? tag(gIbscbs, "gCBS") : ibscbs ? tag(ibscbs, "gCBS") : null;
    const gUf = gIbscbs ? tag(gIbscbs, "gIBSUF") : ibscbs ? tag(ibscbs, "gIBSUF") : null;
    const gMun = gIbscbs ? tag(gIbscbs, "gIBSMun") : ibscbs ? tag(ibscbs, "gIBSMun") : null;
    return {
      ncm: onlyDigits(text(prod ? tag(prod, "NCM") : null)) || null,
      cfop: text(prod ? tag(prod, "CFOP") : null) || null,
      descricao: text(prod ? tag(prod, "xProd") : null) || null,
      quantidade: num(prod ? tag(prod, "qCom") : null),
      valorItem: num(prod ? tag(prod, "vProd") : null),
      temIbscbs: Boolean(ibscbs),
      cclasstrib: ibscbs ? text(tag(ibscbs, "cClassTrib")) || null : null,
      baseCalculo: gIbscbs ? num(tag(gIbscbs, "vBC")) : 0,
      vCBS: gCbs ? num(tag(gCbs, "vCBS")) : 0,
      vIBSUF: gUf ? num(tag(gUf, "vIBSUF")) : 0,
      vIBSMun: gMun ? num(tag(gMun, "vIBSMun")) : 0,
    };
  });
}

export function parseNfeXml(xml: string, arquivo: string): NfeNota {
  const base: NfeNota = {
    arquivo,
    chave: null,
    numero: null,
    serie: null,
    cnpjEmitente: null,
    razaoSocialEmitente: null,
    crt: null,
    regime: "erro",
    valorTotal: 0,
    dataEmissao: null,
    status: "xml_invalido",
    itens: [],
  };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return base;
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return base;

  const infNFe = tag(doc, "infNFe");
  if (!infNFe) return { ...base, status: "nao_e_nfe" };

  const emit = tag(infNFe, "emit");
  const ide = tag(infNFe, "ide");
  const icmsTot = tag(infNFe, "ICMSTot");

  const chaveRaw = infNFe.getAttribute("Id") ?? "";
  const chave = onlyDigits(chaveRaw) || null;
  const cnpj = onlyDigits(text(emit ? tag(emit, "CNPJ") : null));
  const emissao = text(ide ? tag(ide, "dhEmi") : null) || text(ide ? tag(ide, "dEmi") : null);
  const valor = Number(text(icmsTot ? tag(icmsTot, "vNF") : null).replace(",", ".")) || 0;
  const crt = text(emit ? tag(emit, "CRT") : null) || null;

  const nota: NfeNota = {
    arquivo,
    chave,
    numero: text(ide ? tag(ide, "nNF") : null) || null,
    serie: text(ide ? tag(ide, "serie") : null) || null,
    cnpjEmitente: cnpj.length === 14 ? cnpj : null,
    razaoSocialEmitente: text(emit ? tag(emit, "xNome") : null) || null,
    crt,
    regime: regimeFromCrt(crt),
    valorTotal: valor,
    dataEmissao: emissao ? new Date(emissao).toISOString() : null,
    status: cnpj.length === 14 ? "ok" : "sem_cnpj_emitente",
    itens: parseItens(infNFe),
  };
  return nota;
}

/** Lê o conteúdo bruto dos .xml soltos e/ou dentro de um .zip. */
export async function readNfeRawFiles(
  files: File[],
): Promise<{ arquivo: string; xml: string }[]> {
  const out: { arquivo: string; xml: string }[] = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".xml"),
      );
      for (const entry of entries) {
        out.push({
          arquivo: entry.name.split("/").pop() ?? entry.name,
          xml: await entry.async("string"),
        });
      }
    } else if (lower.endsWith(".xml")) {
      out.push({ arquivo: file.name, xml: await file.text() });
    }
  }
  return out;
}

/** Lê arquivos .xml soltos e/ou um .zip com notas dentro. */
export async function readNfeFiles(files: File[]): Promise<NfeNota[]> {
  const notas: NfeNota[] = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".xml"),
      );
      for (const entry of entries) {
        notas.push(parseNfeXml(await entry.async("string"), entry.name.split("/").pop() ?? entry.name));
      }
    } else if (lower.endsWith(".xml")) {
      notas.push(parseNfeXml(await file.text(), file.name));
    }
  }
  return notas;
}

/** Agrupa as notas válidas por CNPJ do emitente, somando os valores. */
export function aggregateNotas(notas: NfeNota[]): NfeAgregado[] {
  const map = new Map<string, NfeAgregado>();
  for (const nota of notas) {
    if (nota.status !== "ok" || !nota.cnpjEmitente) continue;
    const found = map.get(nota.cnpjEmitente);
    if (found) {
      found.valor = Math.round((found.valor + nota.valorTotal) * 100) / 100;
      found.notas += 1;
      if (!found.nome && nota.razaoSocialEmitente) found.nome = nota.razaoSocialEmitente;
      // a nota mais recente define o regime informado no CRT
      if (
        nota.regime !== "erro" &&
        (found.regime === "erro" ||
          !found.ultimaEmissao ||
          (nota.dataEmissao ?? "") >= found.ultimaEmissao)
      ) {
        found.regime = nota.regime;
      }
      if (
        nota.dataEmissao &&
        (!found.ultimaEmissao || nota.dataEmissao > found.ultimaEmissao)
      ) {
        found.ultimaEmissao = nota.dataEmissao;
      }
    } else {
      map.set(nota.cnpjEmitente, {
        cnpj: nota.cnpjEmitente,
        nome: nota.razaoSocialEmitente ?? "",
        valor: Math.round(nota.valorTotal * 100) / 100,
        notas: 1,
        regime: nota.regime,
        ultimaEmissao: nota.dataEmissao,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}
