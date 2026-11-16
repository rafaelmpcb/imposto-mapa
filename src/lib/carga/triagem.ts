import { parseNfseArquivo } from "@/lib/nfse/parse";
import { parseSped, type SpedArquivo } from "@/lib/sped/parse";

/** Resultado da triagem de um pacote solto (ReceitaNetBX, contador, ERP). */
export interface TriagemResultado {
  nfe: File[];
  nfseTomado: File[];
  nfsePrestado: File[];
  pgdasd: File[];
  planilhas: File[];
  sped: SpedArquivo[];
  naoReconhecidos: { arquivo: string; motivo: string }[];
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const tipoPorNome = (nome: string) => nome.toLowerCase().split(".").pop() ?? "";

/**
 * PDF de NFS-e (ex.: "NFSe_Nr_2633.pdf", "NFSe_NrNac_2635.pdf"): na prática,
 * quase todo PDF assim é só a representação visual de uma nota que também
 * chega em XML no mesmo pacote — o XML é a fonte usada para o cálculo, então
 * o PDF não precisa ser lido. Sem esse filtro, esses PDFs caíam todos no
 * balde de PGDAS-D (qualquer .pdf ia para lá), inflando o painel com
 * milhares de "sem dado" que nunca foram um extrato de PGDAS-D.
 */
const pareceNfsePdf = (nome: string) => /nfs[-_]?e/i.test(nome);

/**
 * Abre .zip (inclusive zips dentro de zips) e separa cada arquivo pelo
 * conteúdo, não pelo nome: NF-e, NFS-e (direção pelo CNPJ do Caso),
 * extrato PGDAS-D, planilha de carteira e SPED.
 */
export async function triarPacote(files: File[], caseCnpj: string | null): Promise<TriagemResultado> {
  const { default: JSZip } = await import("jszip");
  const cnpjCaso = onlyDigits(caseCnpj ?? "");
  const r: TriagemResultado = {
    nfe: [],
    nfseTomado: [],
    nfsePrestado: [],
    pgdasd: [],
    planilhas: [],
    sped: [],
    naoReconhecidos: [],
  };

  // O mesmo arquivo pode vir duplicado no pacote (zip dentro de zip, pastas
  // repetidas). Cópias exatas são descartadas silenciosamente para não
  // inflar a carga; a trava de nota duplicada continua valendo na gravação.
  const vistos = new Set<string>();
  const assinatura = (nome: string, conteudo: string) => {
    let h = 5381;
    for (let i = 0; i < conteudo.length; i += 97) h = ((h << 5) + h + conteudo.charCodeAt(i)) | 0;
    return `${nome}|${conteudo.length}|${h}`;
  };
  const jaVisto = (chave: string) => {
    if (vistos.has(chave)) return true;
    vistos.add(chave);
    return false;
  };

  const texto = (nome: string, conteudo: string) => {
    if (jaVisto(assinatura(nome, conteudo))) return;
    const ext = tipoPorNome(nome);
    const file = () => new File([conteudo], nome, { type: ext === "json" ? "application/json" : "text/xml" });

    if (ext === "txt") {
      if (/^\|0000\|/m.test(conteudo.slice(0, 2000))) {
        const lido = parseSped(nome, conteudo);
        if (lido.ok) r.sped.push(lido.item);
        else r.naoReconhecidos.push({ arquivo: nome, motivo: lido.motivo });
      } else r.naoReconhecidos.push({ arquivo: nome, motivo: "texto sem layout reconhecido" });
      return;
    }
    if (ext !== "xml" && ext !== "json") {
      r.naoReconhecidos.push({ arquivo: nome, motivo: "formato não suportado" });
      return;
    }
    if (ext === "xml" && /<(nfeProc|NFe)[\s>]/.test(conteudo) && /infNFe/.test(conteudo)) {
      r.nfe.push(file());
      return;
    }
    // O arquivo pode ser um lote com várias notas (algumas podem estar
    // canceladas) — a primeira nota VÁLIDA do lote já basta para classificar
    // o arquivo inteiro no balde certo; o lote completo é re-lido nota a
    // nota mais adiante, ao salvar, onde canceladas são descartadas uma a uma.
    const notasDoArquivo = parseNfseArquivo({ arquivo: nome, conteudo, formato: ext as "xml" | "json" });
    const nota = notasDoArquivo.find((n) => n.status === "ok" || n.status === "sem_cnpj");
    if (!nota) {
      const motivo =
        notasDoArquivo.length > 0 && notasDoArquivo.every((n) => n.status === "dps")
          ? "DPS (declaração prévia) — não é nota emitida; a NFS-e Nacional correspondente é o documento válido"
          : notasDoArquivo.length > 0 && notasDoArquivo.every((n) => n.status === "cancelada")
            ? "todas as notas do arquivo estão canceladas"
            : "não é NF-e nem NFS-e Nacional reconhecida";
      r.naoReconhecidos.push({ arquivo: nome, motivo });
      return;
    }
    const prestador = onlyDigits(nota.cnpjPrestador ?? "");
    const tomador = onlyDigits(nota.cnpjTomador ?? "");
    if (cnpjCaso && prestador === cnpjCaso) r.nfsePrestado.push(file());
    else if (cnpjCaso && tomador === cnpjCaso) r.nfseTomado.push(file());
    else r.naoReconhecidos.push({ arquivo: nome, motivo: "NFS-e sem o CNPJ do Caso como prestador ou tomador" });
  };

  const abrirZip = async (data: ArrayBuffer | Uint8Array, profundidade: number) => {
    const zip = await JSZip.loadAsync(data);
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const nome = entry.name.split("/").pop() ?? entry.name;
      if (nome.startsWith(".") || entry.name.includes("__MACOSX")) continue;
      const ext = tipoPorNome(nome);
      if (ext === "zip" && profundidade < 3) {
        await abrirZip(await entry.async("uint8array"), profundidade + 1);
      } else if (ext === "pdf" && pareceNfsePdf(nome)) {
        r.naoReconhecidos.push({
          arquivo: nome,
          motivo: "PDF de NFS-e — ignorado, o XML correspondente no pacote é a fonte usada",
        });
      } else if (ext === "pdf" || ext === "xlsx" || ext === "xls" || ext === "csv") {
        const blob = await entry.async("blob");
        if (jaVisto(`${nome}|${blob.size}`)) continue;
        const f = new File([blob], nome);
        (ext === "pdf" ? r.pgdasd : r.planilhas).push(f);
      } else if (ext === "txt") {
        texto(nome, new TextDecoder("latin1").decode(await entry.async("uint8array")));
      } else {
        texto(nome, await entry.async("string"));
      }
    }
  };

  for (const file of files) {
    const ext = tipoPorNome(file.name);
    try {
      if (ext === "zip") await abrirZip(await file.arrayBuffer(), 0);
      else if (ext === "pdf" && pareceNfsePdf(file.name)) {
        r.naoReconhecidos.push({
          arquivo: file.name,
          motivo: "PDF de NFS-e — ignorado, o XML correspondente no pacote é a fonte usada",
        });
      } else if (ext === "pdf") r.pgdasd.push(file);
      else if (ext === "xlsx" || ext === "xls" || ext === "csv") r.planilhas.push(file);
      else if (ext === "txt") texto(file.name, new TextDecoder("latin1").decode(await file.arrayBuffer()));
      else texto(file.name, await file.text());
    } catch {
      r.naoReconhecidos.push({ arquivo: file.name, motivo: "arquivo corrompido ou ilegível" });
    }
  }
  return r;
}
