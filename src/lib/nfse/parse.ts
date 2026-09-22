/**
 * Leitura de notas de serviço (NFS-e) no navegador.
 * A leitura é defensiva: o layout nacional e os layouts municipais (ABRASF)
 * variam, então cada informação é procurada por vários nomes de tag possíveis.
 */

import { onlyDigits } from "@/lib/carteira/types";

export type NfseStatus =
  | "ok"
  | "sem_cnpj"
  | "xml_invalido"
  | "nao_e_nfse"
  /** Lido, mas sem chave/número de NFS-e Nacional (layout municipal legado, por exemplo). */
  | "nao_e_nfse_nacional";

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
  /** Código do serviço como veio no documento (NBS ou item da LC 116). */
  codigoServico: string | null;
  /** Regime do prestador, só quando o próprio documento informa. */
  regimePrestador: "simples" | "regular" | null;
  valorTotal: number;
  dataEmissao: string | null;
  status: NfseStatus;
  itens: NfseServicoItem[];
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").trim();

/** Data em ISO, ou null quando o documento traz algo que não é data. */
const toIso = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

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
    codigoServico: null,
    regimePrestador: null,
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
  const numero = text(findTag(root, ["nNFSe", "Numero", "nDPS"])) || null;

  // Só é NFS-e Nacional quando o documento traz chave de acesso e número.
  const nacional = Boolean(chave && numero);

  return {
    arquivo,
    chave,
    numero,
    serie: text(findTag(root, ["serie", "Serie"])) || null,
    cnpjPrestador,
    razaoSocialPrestador: nomeOf(prestScope),
    cnpjTomador: cnpjOf(tomaScope),
    razaoSocialTomador: nomeOf(tomaScope),
    codigoServico: itens.find((i) => i.nbs)?.nbs ?? itens.find((i) => i.itemLc116)?.itemLc116 ?? null,
    regimePrestador: regimeDoDocumento(root),
    valorTotal: valorTotal || itens.reduce((acc, i) => acc + i.valorServico, 0),
    dataEmissao: toIso(emissao),
    status: !nacional ? "nao_e_nfse_nacional" : cnpjPrestador ? "ok" : "sem_cnpj",
    itens,
  };
}

/**
 * Regime do prestador quando o próprio documento informa (equivalente ao CRT da NF-e).
 * No leiaute nacional vem em regTrib/opSimpNac: 1 = não optante, 2 e 3 = Simples.
 */
function regimeDoDocumento(root: Element): "simples" | "regular" | null {
  const nacionalNode = findTag(root, ["opSimpNac"]);
  const nacionalVal = text(nacionalNode);
  if (nacionalVal === "1") return "regular";
  if (nacionalVal === "2" || nacionalVal === "3") return "simples";

  const abrasf = text(findTag(root, ["OptanteSimplesNacional"]));
  if (abrasf === "1") return "simples";
  if (abrasf === "2") return "regular";
  return null;
}

/** Contraparte agregada a partir das notas de serviço. */
export interface NfseAgregado {
  cnpj: string;
  nome: string;
  valor: number;
  notas: number;
  regimeDocumento: "simples" | "regular" | null;
}

/**
 * Agrupa as notas pelo CNPJ da contraparte, somando os valores.
 * `lado` = "tomado" agrupa pelo prestador; "prestado" agrupa pelo tomador.
 */
export function aggregateNfse(notas: NfseNota[], lado: "tomado" | "prestado"): NfseAgregado[] {
  const mapa = new Map<string, NfseAgregado>();
  for (const nota of notas) {
    const cnpj = lado === "tomado" ? nota.cnpjPrestador : nota.cnpjTomador;
    if (!cnpj) continue;
    const nome =
      (lado === "tomado" ? nota.razaoSocialPrestador : nota.razaoSocialTomador) ?? cnpj;
    const atual = mapa.get(cnpj);
    if (atual) {
      atual.valor += nota.valorTotal;
      atual.notas += 1;
      if (!atual.regimeDocumento && lado === "tomado") atual.regimeDocumento = nota.regimePrestador;
    } else {
      mapa.set(cnpj, {
        cnpj,
        nome,
        valor: nota.valorTotal,
        notas: 1,
        regimeDocumento: lado === "tomado" ? nota.regimePrestador : null,
      });
    }
  }
  return [...mapa.values()].map((a) => ({ ...a, valor: Math.round(a.valor * 100) / 100 }));
}

/* ------------------------------------------------------------------ *
 * Leitura dos arquivos enviados (.xml, .json ou .zip com vários)
 * ------------------------------------------------------------------ */

/** Conteúdo bruto de cada documento encontrado nos arquivos enviados. */
export interface NfseArquivo {
  arquivo: string;
  conteudo: string;
  formato: "xml" | "json";
}

export async function readNfseRawFiles(files: File[]): Promise<NfseArquivo[]> {
  const { default: JSZip } = await import("jszip");
  const out: NfseArquivo[] = [];
  const add = (arquivo: string, conteudo: string) => {
    const lower = arquivo.toLowerCase();
    if (lower.endsWith(".json")) out.push({ arquivo, conteudo, formato: "json" });
    else if (lower.endsWith(".xml")) out.push({ arquivo, conteudo, formato: "xml" });
  };
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        add(entry.name.split("/").pop() ?? entry.name, await entry.async("string"));
      }
    } else {
      add(file.name, await file.text());
    }
  }
  return out;
}

/** Busca, em profundidade, o primeiro valor cuja chave case com um dos nomes. */
function deepFind(node: unknown, names: string[]): unknown {
  const alvo = names.map((n) => n.toLowerCase());
  const fila: unknown[] = [node];
  while (fila.length > 0) {
    const atual = fila.shift();
    if (!atual || typeof atual !== "object") continue;
    for (const [key, value] of Object.entries(atual as Record<string, unknown>)) {
      if (alvo.includes(key.toLowerCase()) && value !== null && typeof value !== "object") {
        return value;
      }
    }
    for (const value of Object.values(atual as Record<string, unknown>)) {
      if (value && typeof value === "object") fila.push(value);
    }
  }
  return undefined;
}

const deepText = (node: unknown, names: string[]) => {
  const v = deepFind(node, names);
  return v === undefined || v === null ? "" : String(v).trim();
};

/** Escopo (objeto) com um dos nomes informados. */
function deepScope(node: unknown, names: string[]): unknown {
  const alvo = names.map((n) => n.toLowerCase());
  const fila: unknown[] = [node];
  while (fila.length > 0) {
    const atual = fila.shift();
    if (!atual || typeof atual !== "object") continue;
    for (const [key, value] of Object.entries(atual as Record<string, unknown>)) {
      if (alvo.includes(key.toLowerCase()) && value && typeof value === "object") return value;
    }
    for (const value of Object.values(atual as Record<string, unknown>)) {
      if (value && typeof value === "object") fila.push(value);
    }
  }
  return undefined;
}

/** Leitura defensiva da NFS-e Nacional entregue em JSON. */
export function parseNfseJson(raw: string, arquivo: string): NfseNota {
  const vazio: NfseNota = {
    arquivo,
    chave: null,
    numero: null,
    serie: null,
    cnpjPrestador: null,
    razaoSocialPrestador: null,
    cnpjTomador: null,
    razaoSocialTomador: null,
    codigoServico: null,
    regimePrestador: null,
    valorTotal: 0,
    dataEmissao: null,
    status: "xml_invalido",
    itens: [],
  };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return vazio;
  }

  const prest = deepScope(json, ["prest", "prestador", "prestadorServico", "emit"]);
  const toma = deepScope(json, ["toma", "tomador", "tomadorServico", "dest"]);
  const cnpjDe = (scope: unknown) => {
    const d = onlyDigits(deepText(scope ?? {}, ["CNPJ", "cnpj", "cpfCnpj"]));
    return d.length === 14 ? d : null;
  };
  const numeroBr = (v: string) => {
    if (!v) return 0;
    const n = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
    return Number(n) || 0;
  };

  const chave = onlyDigits(deepText(json, ["chNFSe", "chaveAcesso", "chave"])) || null;
  const numero = deepText(json, ["nNFSe", "numero", "nDPS"]) || null;
  const valorTotal = numeroBr(
    deepText(json, ["vLiq", "vServ", "valorServicos", "valorLiquidoNfse"]),
  );
  const cnpjPrestador = cnpjDe(prest);
  const opSimpNac = deepText(json, ["opSimpNac"]);
  const optante = deepText(json, ["optanteSimplesNacional"]);
  const regimePrestador =
    opSimpNac === "1"
      ? ("regular" as const)
      : opSimpNac === "2" || opSimpNac === "3"
        ? ("simples" as const)
        : optante === "1"
          ? ("simples" as const)
          : optante === "2"
            ? ("regular" as const)
            : null;

  return {
    arquivo,
    chave,
    numero,
    serie: deepText(json, ["serie"]) || null,
    cnpjPrestador,
    razaoSocialPrestador: deepText(prest ?? {}, ["xNome", "razaoSocial", "nome"]) || null,
    cnpjTomador: cnpjDe(toma),
    razaoSocialTomador: deepText(toma ?? {}, ["xNome", "razaoSocial", "nome"]) || null,
    codigoServico: deepText(json, ["cNBS", "codigoNbs", "cTribNac", "itemListaServico"]) || null,
    regimePrestador,
    valorTotal,
    dataEmissao: toIso(deepText(json, ["dhEmi", "dataEmissao", "dhProc", "dCompet"])),
    status: !(chave && numero) ? "nao_e_nfse_nacional" : cnpjPrestador ? "ok" : "sem_cnpj",
    itens: [],
  };
}

/** Lê o documento conforme o formato do arquivo. */
export function parseNfseArquivo(item: NfseArquivo): NfseNota {
  return item.formato === "json"
    ? parseNfseJson(item.conteudo, item.arquivo)
    : parseNfseXml(item.conteudo, item.arquivo);
}
