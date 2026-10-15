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

  const texto = (nome: string, conteudo: string) => {
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
    const nota = parseNfseArquivo({ arquivo: nome, conteudo, formato: ext as "xml" | "json" });
    if (nota.status === "dps") {
      r.naoReconhecidos.push({
        arquivo: nome,
        motivo: "DPS (declaração prévia) — não é nota emitida; a NFS-e Nacional correspondente é o documento válido",
      });
      return;
    }
    if (nota.status !== "ok" && nota.status !== "sem_cnpj") {
      r.naoReconhecidos.push({ arquivo: nome, motivo: "não é NF-e nem NFS-e Nacional reconhecida" });
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
      } else if (ext === "pdf" || ext === "xlsx" || ext === "xls" || ext === "csv") {
        const blob = await entry.async("blob");
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
      else if (ext === "pdf") r.pgdasd.push(file);
      else if (ext === "xlsx" || ext === "xls" || ext === "csv") r.planilhas.push(file);
      else if (ext === "txt") texto(file.name, new TextDecoder("latin1").decode(await file.arrayBuffer()));
      else texto(file.name, await file.text());
    } catch {
      r.naoReconhecidos.push({ arquivo: file.name, motivo: "arquivo corrompido ou ilegível" });
    }
  }
  return r;
}
