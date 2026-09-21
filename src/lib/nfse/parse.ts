/**
 * Leitura de notas de serviço (NFS-e) no navegador.
 * A leitura é defensiva: o layout nacional e os layouts municipais (ABRASF)
 * variam, então cada informação é procurada por vários nomes de tag possíveis.
 */

import { onlyDigits } from "@/lib/carteira/types";

export type NfseStatus = "ok" | "sem_cnpj" | "xml_invalido" | "nao_e_nfse";

/** Serviço descrito na nota. */
export interface NfseServicoItem {
  nbs: string | null;
  itemLc116: string | null;
  descricao: string | null;
  valorServico: number;
  /** O documento já trouxe a classificação tributária de IBS/CBS. */
  temClassificacaoDocumento: boolean;
  cclasstrib: string | null;
  baseCalculo: number;
  vCBS: number;
  vIBSUF: number;
  vIBSMun: number;
}

export interface NfseNota {
  arquivo: string;
  chave: string | null;
  numero: string | null;
  serie: string | null;
  cnpjPrestador: string | null;
  razaoSocialPrestador: string | null;
  cnpjTomador: string | null;
  razaoSocialTomador: string | null;
  valorTotal: number;
  dataEmissao: string | null;
  status: NfseStatus;
  itens: NfseServicoItem[];
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").trim();

const num = (node: Element | null | undefined) => {
  const raw = text(node);
  if (!raw) return 0;
  const normalizado = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalizado) || 0;
};

/** Primeira tag com um dos nomes locais informados, em qualquer profundidade. */
function findTag(root: ParentNode | null, names: string[]): Element | null {
  if (!root) return null;
  const el = root as Element;
  const all = el.getElementsByTagName ? el.getElementsByTagName("*") : [];
  for (const name of names) {
    for (const node of Array.from(all)) {
      if (node.localName.toLowerCase() === name.toLowerCase()) return node;
    }
  }
  return null;
}

function findAll(root: ParentNode | null, names: string[]): Element[] {
  if (!root) return [];
  const el = root as Element;
  const all = Array.from(el.getElementsByTagName ? el.getElementsByTagName("*") : []);
  const lower = names.map((n) => n.toLowerCase());
  return all.filter((node) => lower.includes(node.localName.toLowerCase()));
}

const cnpjOf = (scope: Element | null): string | null => {
  if (!scope) return null;
  const node = findTag(scope, ["CNPJ", "Cnpj", "CpfCnpj"]);
  const d = onlyDigits(text(node));
  return d.length === 14 ? d : null;
};

const nomeOf = (scope: Element | null): string | null => {
  if (!scope) return null;
  return text(findTag(scope, ["xNome", "RazaoSocial", "NomeFantasia"])) || null;
};

/** Lê os serviços da nota e, quando existir, o bloco de IBS/CBS. */
export function parseServicos(root: Element, valorTotal: number): NfseServicoItem[] {
  const blocos = findAll(root, ["serv", "Servico"]);
  const alvos = blocos.length > 0 ? blocos : [root];

  return alvos.map((bloco) => {
    const ibscbs = findTag(bloco, ["IBSCBS", "gIBSCBS", "tribIBSCBS"]);
    const cclasstribNode = findTag(ibscbs ?? bloco, ["cClassTrib", "CClassTrib"]);
    const gCbs = findTag(ibscbs, ["gCBS"]);
    const gUf = findTag(ibscbs, ["gIBSUF"]);
    const gMun = findTag(ibscbs, ["gIBSMun"]);
    const valor =
      num(findTag(bloco, ["vServ", "ValorServicos", "vServPrest", "vLiq"])) || valorTotal;

    const cclasstrib = text(cclasstribNode) || null;
    return {
      nbs: text(findTag(bloco, ["cNBS", "CodigoNBS", "codigoNbs"])) || null,
      itemLc116:
        text(findTag(bloco, ["cTribNac", "ItemListaServico", "cServico", "CodigoTributacaoMunicipio"])) ||
        null,
      descricao: text(findTag(bloco, ["xDescServ", "Discriminacao", "xDescricao"])) || null,
      valorServico: valor,
      temClassificacaoDocumento: Boolean(cclasstrib),
      cclasstrib,
      baseCalculo: ibscbs ? num(findTag(ibscbs, ["vBC"])) : 0,
      vCBS: gCbs ? num(findTag(gCbs, ["vCBS"])) : 0,
      vIBSUF: gUf ? num(findTag(gUf, ["vIBSUF"])) : 0,
      vIBSMun: gMun ? num(findTag(gMun, ["vIBSMun"])) : 0,
    };
  });
}

export function parseNfseXml(xml: string, arquivo: string): NfseNota {
  const base: NfseNota = {
    arquivo,
    chave: null,
    numero: null,
    serie: null,
    cnpjPrestador: null,
    razaoSocialPrestador: null,
    cnpjTomador: null,
    razaoSocialTomador: null,
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

  const root =
    findTag(doc, ["infNFSe", "InfNfse", "Nfse", "infDPS"]) ?? (doc.documentElement as Element | null);
  if (!root) return { ...base, status: "nao_e_nfse" };
  if (findTag(doc, ["infNFe"])) return { ...base, status: "nao_e_nfse" };

  const prestScope = findTag(root, ["prest", "PrestadorServico", "Prestador", "emit"]);
  const tomaScope = findTag(root, ["toma", "TomadorServico", "Tomador", "dest"]);

  const valorTotal =
    num(findTag(root, ["vLiq", "vServ", "ValorLiquidoNfse", "ValorServicos"])) || 0;
  const emissao =
    text(findTag(root, ["dhEmi", "DataEmissao", "dhProc", "dCompet"])) || "";
  const chaveAttr = root.getAttribute("Id") ?? "";
  const chave =
    onlyDigits(text(findTag(root, ["chNFSe", "CodigoVerificacao"])) || chaveAttr) || null;

  const cnpjPrestador = cnpjOf(prestScope);
  const itens = parseServicos(root, valorTotal);

  return {
    arquivo,
    chave,
    numero: text(findTag(root, ["nNFSe", "Numero", "nDPS"])) || null,
    serie: text(findTag(root, ["serie", "Serie"])) || null,
    cnpjPrestador,
    razaoSocialPrestador: nomeOf(prestScope),
    cnpjTomador: cnpjOf(tomaScope),
    razaoSocialTomador: nomeOf(tomaScope),
    valorTotal: valorTotal || itens.reduce((acc, i) => acc + i.valorServico, 0),
    dataEmissao: toIso(emissao),
    status: cnpjPrestador ? "ok" : "sem_cnpj",
    itens,
  };
}
