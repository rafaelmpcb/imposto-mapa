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
  | "nao_e_nfse_nacional"
  /** DPS (declaração prévia de serviço): não é nota. A NFS-e Nacional gerada a partir dela é o documento válido. */
  | "dps"
  /** Nota cancelada (confirmação de cancelamento com sucesso) ou substituída por outra: não entra na receita. */
  | "cancelada";

/**
 * Detecta DPS (declaração prévia) ainda não convertida em NFS-e.
 * Um XML/JSON de DPS tem `nDPS`/`infDPS` e nenhum identificador de NFS-e
 * (`nNFSe`, `nNFS-e`, `Numero` ou `chNFSe`). A NFS-e Nacional embute o bloco
 * da DPS, mas traz `nNFSe`/`chNFSe` — por isso a checagem da nota vem antes.
 * Importar a DPS como nota duplica a receita (a mesma operação entra duas
 * vezes: a declaração e a nota gerada).
 */
export function isDpsDocumento(conteudo: string): boolean {
  const temNfse =
    /<nNFSe[\s>]|<nNFS-e[\s>]|<Numero[\s>]|<chNFSe[\s>]|"nNFSe"\s*:|"chNFSe"\s*:/i.test(conteudo);
  const temDps = /<nDPS[\s>]|<infDPS[\s>]|"nDPS"\s*:|"infDPS"\s*:/i.test(conteudo);
  return temDps && !temNfse;
}

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
  /** ISS destacado no documento (leitura defensiva: ausência = 0). */
  vISS: number;
  /** PIS e COFINS destacados no documento (leitura defensiva: ausência = 0). */
  vPIS: number;
  vCOFINS: number;
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
  /**
   * true quando o documento é a NFS-e Nacional em si (embute o bloco <DPS>
   * gerado pelo Ambiente de Dados Nacional) — não um layout municipal legado
   * que antecede a adesão do município ao padrão nacional.
   */
  formatoNacional: boolean;
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

  // Na NFS-e Nacional o total de ISS (vISSQN) fica em <infNFSe><valores>,
  // fora do <DPS><infDPS><serv> onde cada item vive — buscar só dentro do
  // bloco do item nunca encontra essa tag, e o ISS real do documento vira
  // 0 silenciosamente. Serve de reserva quando o item não traz o próprio
  // valor (layouts municipais costumam trazer por item), rateado pela
  // quantidade de serviços da nota quando há mais de um.
  const vIssRaiz = num(findTag(root, ["vISS", "ValorIss", "valorIss", "vISSQN"]));
  // Mesmo caso do ISS: PIS/COFINS da NFS-e Nacional ficam em
  // <infDPS><valores><trib><tribFed><piscofins>, irmão do <serv>, não dentro
  // dele — sem essa busca na raiz, o PIS/COFINS "de hoje" de uma empresa de
  // serviços nunca aparece (ficava 0 silenciosamente, igual o ISS estava).
  const vPisRaiz = num(findTag(root, ["vPis"]));
  const vCofinsRaiz = num(findTag(root, ["vCofins"]));

  return alvos.map((bloco) => {
    // Na NFS-e Nacional o <IBSCBS> com o cClassTrib fica como IRMÃO de
    // <serv> dentro de <infDPS> (e os totais calculados de CBS/IBS-UF/IBS-Mun
    // ficam em outro <IBSCBS>, no nível de <infNFSe>) — nenhum dos dois fica
    // DENTRO de <serv>. Por isso a busca cai para o nível do documento
    // (`root`) quando o próprio item não traz o bloco; sem isso, toda nota
    // nesse layout era lida como "sem classificação no documento" e o
    // crédito caía para a estimativa da tabela de exceções por NBS mesmo
    // quando a nota já trazia o valor oficial pronto.
    const ibscbsBloco = findTag(bloco, ["IBSCBS", "gIBSCBS", "tribIBSCBS"]);
    const ibscbs = ibscbsBloco ?? findTag(root, ["IBSCBS", "gIBSCBS", "tribIBSCBS"]);
    // cClassTrib é buscado direto na raiz (não dentro de `ibscbs`) porque,
    // quando há dois blocos <IBSCBS> (classificação e totais), o primeiro
    // encontrado por nome pode ser o de totais, que não tem cClassTrib.
    const cclasstribNode =
      findTag(bloco, ["cClassTrib", "CClassTrib"]) ?? findTag(root, ["cClassTrib", "CClassTrib"]);
    const gCbs = findTag(ibscbs, ["gCBS"]);
    const gUf = findTag(ibscbs, ["gIBSUF", "gIBSUFTot"]);
    const gMun = findTag(ibscbs, ["gIBSMun", "gIBSMunTot"]);
    const valor =
      num(findTag(bloco, ["vServ", "ValorServicos", "vServPrest", "vLiq"])) || valorTotal;

    const cclasstrib = text(cclasstribNode) || null;
    return {
      nbs: text(findTag(bloco, ["cNBS", "CodigoNBS", "codigoNbs"])) || null,
      itemLc116:
        text(
          findTag(bloco, [
            "cTribNac",
            "ItemListaServico",
            "cServico",
            "CodigoTributacaoMunicipio",
            "cLCServ",
          ]),
        ) || null,
      descricao: text(findTag(bloco, ["xDescServ", "Discriminacao", "xDescricao", "xServ"])) || null,
      valorServico: valor,
      temClassificacaoDocumento: Boolean(cclasstrib),
      cclasstrib,
      baseCalculo: ibscbs ? num(findTag(ibscbs, ["vBC"])) : 0,
      vCBS: gCbs ? num(findTag(gCbs, ["vCBS"])) : 0,
      vIBSUF: gUf ? num(findTag(gUf, ["vIBSUF"])) : 0,
      vIBSMun: gMun ? num(findTag(gMun, ["vIBSMun"])) : 0,
      vISS: num(findTag(bloco, ["vISS", "ValorIss", "valorIss", "vISSQN"])) || vIssRaiz / alvos.length,
      vPIS: num(findTag(bloco, ["vPis"])) || vPisRaiz / alvos.length,
      vCOFINS: num(findTag(bloco, ["vCofins"])) || vCofinsRaiz / alvos.length,
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
    formatoNacional: false,
  };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return base;
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return base;

  // DPS ainda não convertida em NFS-e: não é nota e não entra no cálculo.
  if (isDpsDocumento(xml)) return { ...base, status: "dps" };

  // Nota cancelada: no lote do ginfes, a confirmação de cancelamento vem como
  // irmã da nota dentro do mesmo item do lote (splitNotaBlocks mantém as duas
  // juntas). Uma nota substituída por outra (<NfseSubstituida>) também é
  // cancelada pelo próprio município como parte da substituição — confirmado
  // em dados reais, o cancelamento cobre os dois casos. Sem essa checagem a
  // nota cancelada entrava na receita como se fosse uma venda válida.
  const cancelamento = findTag(doc, ["Cancelamento"]);
  const cancelada = cancelamento
    ? text(findTag(cancelamento, ["Sucesso"])).toLowerCase() === "true"
    : false;
  if (cancelada) return { ...base, status: "cancelada" };

  const root =
    findTag(doc, ["infNFSe", "InfNfse", "Nfse", "infDPS"]) ?? (doc.documentElement as Element | null);
  if (!root) return { ...base, status: "nao_e_nfse" };
  if (findTag(doc, ["infNFe"])) return { ...base, status: "nao_e_nfse" };

  // "emit" primeiro: na NFS-e Nacional, o <DPS> embutido também tem um <prest>
  // (só com CNPJ, sem nome) — buscando "prest" antes, esse acharia esse <prest>
  // aninhado em vez do <emit> de topo, que é o único com xNome preenchido.
  const prestScope = findTag(root, ["emit", "prest", "PrestadorServico", "Prestador"]);
  const tomaScope = findTag(root, ["toma", "TomS", "TomadorServico", "Tomador", "dest"]);
  // Layout da Prefeitura de São Paulo (<NFe> com NumeroNFe, CPFCNPJPrestador,
  // RazaoSocialPrestador...): os dados das partes são tags soltas na raiz, sem
  // um bloco <prest>/<toma> que as agrupe.
  const layoutSp = Boolean(findTag(root, ["NumeroNFe"]));

  // Receita é sempre o valor bruto faturado (base de cálculo legal do ISS,
  // PIS/COFINS, IRPJ/CSLL e Simples) — retenção na fonte (ISS retido,
  // IRRF/PIS/COFINS/CSLL) só muda quem recolhe, não reduz a receita.
  // vLiq/ValorLiquidoNfse é só o valor líquido recebido em caixa.
  const valorTotal =
    num(findTag(root, ["vServ", "ValorServicos", "vServPrest", "vLiq", "ValorLiquidoNfse"])) || 0;
  const emissao =
    text(findTag(root, ["dhEmi", "dEmi", "DataEmissao", "DataEmissaoNFe", "dhProc", "dCompet"])) || "";
  const chaveAttr = root.getAttribute("Id") ?? "";
  const cnpjPrestador = layoutSp
    ? cnpjOf(findTag(root, ["CPFCNPJPrestador"]))
    : cnpjOf(prestScope);
  const itens = parseServicos(root, valorTotal);
  const numero = text(findTag(root, ["nNFSe", "nNFS-e", "Numero", "NumeroNFe", "nDPS"])) || null;
  const serieDoc = text(findTag(root, ["serie", "Serie", "SerieRPS"])) || "";
  // Layouts municipais (ex.: Caxias do Sul) não têm chave nacional: usa
  // referência do documento ou CNPJ+série+número como identificador único.
  // ChaveAcesso (quando existe) é o identificador oficial do documento — mais
  // robusto para deduplicação do que CodigoVerificacao, que é só o código de
  // consulta pública da nota.
  // No layout de São Paulo o CodigoVerificacao é alfanumérico (ex.: "VVMQ-DHW2"):
  // extrair só os dígitos daria um "2" que colidiria entre notas diferentes,
  // então a chave vem de CNPJ+série+número.
  const chave =
    (layoutSp
      ? ""
      : onlyDigits(text(findTag(root, ["chNFSe", "ChaveAcesso", "CodigoVerificacao"])) || chaveAttr)) ||
    text(findTag(root, ["refNF"])) ||
    (cnpjPrestador && numero ? `${cnpjPrestador}-${serieDoc}-${numero}` : "") ||
    null;

  // Aceita NFS-e nacional e municipal, desde que tenha número.
  const nacional = Boolean(numero);
  // A NFS-e Nacional embute o bloco <DPS> gerado pelo Ambiente de Dados
  // Nacional; layouts municipais legados (pré-adesão ao padrão nacional) não têm.
  const formatoNacional = Boolean(findTag(root, ["DPS"]));

  return {
    arquivo,
    chave,
    numero,
    serie: text(findTag(root, ["serie", "Serie", "SerieRPS"])) || null,
    cnpjPrestador,
    razaoSocialPrestador: layoutSp
      ? text(findTag(root, ["RazaoSocialPrestador"])) || null
      : nomeOf(prestScope),
    cnpjTomador: layoutSp ? cnpjOf(findTag(root, ["CPFCNPJTomador"])) : cnpjOf(tomaScope),
    razaoSocialTomador: layoutSp
      ? text(findTag(root, ["RazaoSocialTomador"])) || null
      : nomeOf(tomaScope),
    codigoServico: itens.find((i) => i.nbs)?.nbs ?? itens.find((i) => i.itemLc116)?.itemLc116 ?? null,
    regimePrestador: regimeDoDocumento(root),
    valorTotal: valorTotal || itens.reduce((acc, i) => acc + i.valorServico, 0),
    dataEmissao: toIso(emissao),
    status: !nacional ? "nao_e_nfse_nacional" : cnpjPrestador ? "ok" : "sem_cnpj",
    itens,
    formatoNacional,
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
  if (abrasf === "1" || abrasf.toLowerCase() === "true") return "simples";
  if (abrasf === "2" || abrasf.toLowerCase() === "false") return "regular";
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
    formatoNacional: false,
  };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return vazio;
  }
  if (isDpsDocumento(raw)) return { ...vazio, status: "dps" };

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
  // Mesma correção do leitor de XML: receita é o valor bruto faturado, não o
  // líquido após retenção na fonte.
  const valorTotal = numeroBr(
    deepText(json, ["vServ", "valorServicos", "vLiq", "valorLiquidoNfse"]),
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
    formatoNacional: true,
  };
}

/**
 * Prefeituras costumam exportar um "lote" com várias notas no mesmo arquivo
 * XML (confirmado em notas reais de Fortaleza/ginfes: um único .xml chega a
 * trazer mais de 80 <Nfse> diferentes). <InfNfse>/<infNFSe> é o envelope de
 * uma nota completa em qualquer leiaute (municipal ou Nacional), então cada
 * ocorrência é recortada como um documento próprio antes de aplicar a mesma
 * leitura de nota única — sem isso, só a primeira nota do lote era lida e o
 * resto do arquivo era descartado em silêncio.
 *
 * No lote do ginfes cada item vem num wrapper com prefixo de namespace (ex.:
 * <ns2:Nfse>), contendo a nota (<Nfse><InfNfse>) e, quando existe, a
 * confirmação de cancelamento (<Cancelamento>) como irmã dela — splitar por
 * esse wrapper (não só pelo <InfNfse>) mantém as duas juntas, senão a
 * confirmação de cancelamento fica para trás e a nota cancelada é lida como
 * se fosse uma venda válida. Formatos sem esse wrapper (ex.: um único
 * <infNFSe> solto) caem no fallback de sempre.
 */
/**
 * O prefixo de namespace de um fragmento recortado (ex.: "ns2:") só é válido
 * junto da declaração xmlns que o define — essa declaração vive no elemento
 * raiz do arquivo original, que fica para trás no recorte. Sem isso o
 * DOMParser rejeita o fragmento inteiro como XML inválido (prefixo não
 * declarado). O parsing daqui em diante só procura por nome local da tag
 * (findTag), então remover o prefixo não perde nenhuma informação.
 */
const removerPrefixosDeNamespace = (fragmento: string) =>
  fragmento.replace(/<(\/?)[A-Za-z][\w.-]*:/g, "<$1");

function splitNotaBlocks(xml: string): string[] {
  const comWrapperPrefixado = xml.match(/<([A-Za-z][\w-]*):Nfse\b[^]*?<\/\1:Nfse>/g);
  const blocos =
    comWrapperPrefixado && comWrapperPrefixado.length > 0
      ? comWrapperPrefixado
      : (xml.match(/<(?:\w+:)?infnfse\b[^]*?<\/(?:\w+:)?infnfse>/gi) ?? [xml]);
  return blocos.map(removerPrefixosDeNamespace);
}

/** Lê o documento conforme o formato do arquivo; um arquivo pode trazer mais de uma nota. */
export function parseNfseArquivo(item: NfseArquivo): NfseNota[] {
  if (item.formato === "json") return [parseNfseJson(item.conteudo, item.arquivo)];
  const blocos = splitNotaBlocks(item.conteudo);
  return blocos.map((bloco, i) =>
    parseNfseXml(bloco, blocos.length > 1 ? `${item.arquivo}#${i + 1}` : item.arquivo),
  );
}
