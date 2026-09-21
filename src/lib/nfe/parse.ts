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

/** Busca a primeira tag com esse nome local, ignorando namespace. */
function tag(root: ParentNode, name: string): Element | null {
  const found = root.querySelectorAll(name);
  return found.length > 0 ? (found[0] as Element) : null;
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
  };
  return nota;
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
        ultimaEmissao: nota.dataEmissao,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}
