/**
 * Leitura de notas fiscais de venda (XML de NF-e), no navegador.
 * O cabeçalho identifica o destinatário (cliente), valor total, data, chave,
 * número e série. Os itens (det) são lidos para apurar o débito de IBS/CBS.
 * O CRT da nota NÃO é usado: ele é o regime de quem emite, não do cliente.
 */

import JSZip from "jszip";

import { onlyDigits } from "@/lib/carteira/types";
import { parseItens, type NfeItem } from "@/lib/nfe/parse";

export type NfeVendaStatus = "ok" | "sem_cnpj_destinatario" | "xml_invalido" | "nao_e_nfe";

export interface NfeVendaNota {
  arquivo: string;
  chave: string | null;
  numero: string | null;
  serie: string | null;
  cnpjDestinatario: string | null;
  razaoSocialDestinatario: string | null;
  valorTotal: number;
  dataEmissao: string | null;
  status: NfeVendaStatus;
  itens: NfeItem[];
}


export interface NfeVendaAgregado {
  cnpj: string;
  nome: string;
  valor: number;
  notas: number;
  /** Data da nota mais recente usada na soma. */
  ultimaEmissao: string | null;
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").trim();

/** Busca a primeira tag com esse nome local, ignorando namespace. */
function tag(root: ParentNode, name: string): Element | null {
  const found = root.querySelectorAll(name);
  return found.length > 0 ? (found[0] as Element) : null;
}

export function parseNfeVendaXml(xml: string, arquivo: string): NfeVendaNota {
  const base: NfeVendaNota = {
    arquivo,
    chave: null,
    numero: null,
    serie: null,
    cnpjDestinatario: null,
    razaoSocialDestinatario: null,
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

  const dest = tag(infNFe, "dest");
  const ide = tag(infNFe, "ide");
  const icmsTot = tag(infNFe, "ICMSTot");

  const chave = onlyDigits(infNFe.getAttribute("Id") ?? "") || null;
  const cnpj = onlyDigits(text(dest ? tag(dest, "CNPJ") : null));
  const emissao = text(ide ? tag(ide, "dhEmi") : null) || text(ide ? tag(ide, "dEmi") : null);
  const valor = Number(text(icmsTot ? tag(icmsTot, "vNF") : null).replace(",", ".")) || 0;

  return {
    arquivo,
    chave,
    numero: text(ide ? tag(ide, "nNF") : null) || null,
    serie: text(ide ? tag(ide, "serie") : null) || null,
    cnpjDestinatario: cnpj.length === 14 ? cnpj : null,
    razaoSocialDestinatario: text(dest ? tag(dest, "xNome") : null) || null,
    valorTotal: valor,
    dataEmissao: emissao ? new Date(emissao).toISOString() : null,
    status: cnpj.length === 14 ? "ok" : "sem_cnpj_destinatario",
  };
}

/** Lê arquivos .xml soltos e/ou um .zip com notas dentro. */
export async function readNfeVendaFiles(files: File[]): Promise<NfeVendaNota[]> {
  const notas: NfeVendaNota[] = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".xml"),
      );
      for (const entry of entries) {
        notas.push(
          parseNfeVendaXml(await entry.async("string"), entry.name.split("/").pop() ?? entry.name),
        );
      }
    } else if (lower.endsWith(".xml")) {
      notas.push(parseNfeVendaXml(await file.text(), file.name));
    }
  }
  return notas;
}

/** Agrupa as notas válidas por CNPJ do destinatário, somando os valores. */
export function aggregateVendas(notas: NfeVendaNota[]): NfeVendaAgregado[] {
  const map = new Map<string, NfeVendaAgregado>();
  for (const nota of notas) {
    if (nota.status !== "ok" || !nota.cnpjDestinatario) continue;
    const found = map.get(nota.cnpjDestinatario);
    if (found) {
      found.valor = Math.round((found.valor + nota.valorTotal) * 100) / 100;
      found.notas += 1;
      if (!found.nome && nota.razaoSocialDestinatario) found.nome = nota.razaoSocialDestinatario;
      if (nota.dataEmissao && (!found.ultimaEmissao || nota.dataEmissao > found.ultimaEmissao)) {
        found.ultimaEmissao = nota.dataEmissao;
      }
    } else {
      map.set(nota.cnpjDestinatario, {
        cnpj: nota.cnpjDestinatario,
        nome: nota.razaoSocialDestinatario ?? "",
        valor: Math.round(nota.valorTotal * 100) / 100,
        notas: 1,
        ultimaEmissao: nota.dataEmissao,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}
