/**
 * Leitura de NF-e (modelo 55) e NFC-e (modelo 65) para a auditoria monofásica.
 * Roda no navegador: os XMLs não são enviados para o servidor, só o resultado
 * já classificado (quando o analista decide gravar no Caso).
 */

import JSZip from "jszip";

import type { ItemAuditoria } from "@/lib/monofasico/auditoria";

export interface NotaAuditoria {
  arquivo: string;
  chave: string | null;
  modelo: string | null;
  numero: string | null;
  dataEmissao: string | null;
  status: "ok" | "xml_invalido" | "nao_e_nfe" | "sem_itens";
  itens: ItemAuditoria[];
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").trim();
const num = (node: Element | null | undefined) => Number(text(node).replace(",", ".")) || 0;
const digits = (v: string) => v.replace(/\D/g, "");

function tag(root: ParentNode, name: string): Element | null {
  const found = root.querySelectorAll(name);
  return found.length > 0 ? (found[0] as Element) : null;
}

/** O CST fica em um filho do grupo PIS/COFINS (PISAliq, PISNT, PISOutr, ...). */
function grupoTributo(imposto: Element | null, nome: "PIS" | "COFINS") {
  if (!imposto) return { cst: null as string | null, valor: 0 };
  const raiz = tag(imposto, nome);
  if (!raiz) return { cst: null, valor: 0 };
  const cst = text(tag(raiz, "CST")) || null;
  const valor = num(tag(raiz, nome === "PIS" ? "vPIS" : "vCOFINS"));
  return { cst, valor };
}

export function parseNotaAuditoria(xml: string, arquivo: string): NotaAuditoria {
  const base: NotaAuditoria = {
    arquivo,
    chave: null,
    modelo: null,
    numero: null,
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

  const ide = tag(infNFe, "ide");
  const chave = digits(infNFe.getAttribute("Id") ?? "") || null;
  const emissao = text(ide ? tag(ide, "dhEmi") : null) || text(ide ? tag(ide, "dEmi") : null);
  const modelo = text(ide ? tag(ide, "mod") : null) || null;
  const numero = text(ide ? tag(ide, "nNF") : null) || null;
  const dataEmissao = emissao ? new Date(emissao).toISOString() : null;

  const itens: ItemAuditoria[] = Array.from(infNFe.getElementsByTagName("det")).map((det) => {
    const prod = tag(det, "prod");
    const imposto = tag(det, "imposto");
    const pis = grupoTributo(imposto, "PIS");
    const cofins = grupoTributo(imposto, "COFINS");
    return {
      arquivo,
      chave,
      modelo,
      numero,
      dataEmissao,
      ncm: digits(text(prod ? tag(prod, "NCM") : null)) || null,
      cfop: text(prod ? tag(prod, "CFOP") : null) || null,
      descricao: text(prod ? tag(prod, "xProd") : null) || null,
      valorItem: num(prod ? tag(prod, "vProd") : null),
      cstPis: pis.cst,
      cstCofins: cofins.cst,
      valorPis: pis.valor,
      valorCofins: cofins.valor,
    };
  });

  return {
    arquivo,
    chave,
    modelo,
    numero,
    dataEmissao,
    status: itens.length > 0 ? "ok" : "sem_itens",
    itens,
  };
}

/** Lê .xml soltos e/ou .zip com notas dentro. */
export async function readNotasAuditoria(files: File[]): Promise<NotaAuditoria[]> {
  const notas: NotaAuditoria[] = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(
        (e) => !e.dir && e.name.toLowerCase().endsWith(".xml"),
      );
      for (const entry of entries) {
        notas.push(
          parseNotaAuditoria(await entry.async("string"), entry.name.split("/").pop() ?? entry.name),
        );
      }
    } else if (lower.endsWith(".xml")) {
      notas.push(parseNotaAuditoria(await file.text(), file.name));
    }
  }
  return notas;
}
