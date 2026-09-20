/**
 * Leitura do extrato do PGDAS-D a partir do texto selecionável do PDF.
 * Parser orientado a rótulos conhecidos — sem OCR e sem coordenadas fixas.
 */
import { parseAmount } from "@/lib/carteira/types";
import {
  emptyExtraction,
  type PgdasdAnexo,
  type PgdasdExtraction,
  type PgdasdTributo,
} from "./types";

/** Extrai o texto de todas as páginas do PDF (vazio quando o PDF é imagem). */
export async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    let lastY: number | null = null;
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        parts.push(line.trim());
        line = "";
      }
      line += `${item.str} `;
      lastY = y;
    }
    if (line.trim()) parts.push(line.trim());
  }
  await doc.cleanup();
  return parts.join("\n");
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const MONEY = /(-?\(?R?\$?\s?[\d.]+,\d{2}\)?)/;

/** Procura a primeira linha que casa com algum dos rótulos e devolve o valor numérico. */
function findAmount(lines: string[], labels: string[]): number | null {
  for (let i = 0; i < lines.length; i += 1) {
    const plain = norm(lines[i]!);
    if (!labels.some((l) => plain.includes(l))) continue;
    const here = lines[i]!.match(MONEY);
    if (here?.[1]) return parseAmount(here[1]);
    // valor pode estar na linha seguinte
    const next = lines[i + 1]?.match(MONEY);
    if (next?.[1]) return parseAmount(next[1]);
  }
  return null;
}

function findLineValue(lines: string[], labels: string[], pattern: RegExp): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const plain = norm(lines[i]!);
    if (!labels.some((l) => plain.includes(l))) continue;
    const here = lines[i]!.match(pattern);
    if (here?.[1]) return here[1];
    const next = lines[i + 1]?.match(pattern);
    if (next?.[1]) return next[1];
  }
  return null;
}

const CNPJ_RE = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
const COMPETENCIA_RE = /(\d{2}\/\d{4})/;
const ROMANOS = ["I", "II", "III", "IV", "V"];

function extractAnexos(lines: string[]): PgdasdAnexo[] {
  const found = new Map<string, PgdasdAnexo>();
  for (const raw of lines) {
    const plain = norm(raw);
    const match = plain.match(/anexo\s+(i{1,3}v?|iv|v)\b/);
    if (!match) continue;
    const anexo = match[1]!.toUpperCase();
    if (!ROMANOS.includes(anexo)) continue;
    const pctMatch = raw.match(/(\d{1,2},\d{1,4})\s*%/);
    const valueMatch = raw.match(MONEY);
    const current = found.get(anexo) ?? { anexo, receita: null, percentual: null };
    if (current.percentual === null && pctMatch?.[1]) {
      current.percentual = parseAmount(pctMatch[1]);
    }
    if (current.receita === null && valueMatch?.[1]) {
      current.receita = parseAmount(valueMatch[1]);
    }
    found.set(anexo, current);
  }
  return [...found.values()].sort((a, b) => ROMANOS.indexOf(a.anexo) - ROMANOS.indexOf(b.anexo));
}

const TRIBUTOS = ["IRPJ", "CSLL", "COFINS", "PIS/Pasep", "INSS/CPP", "ICMS", "IPI", "ISS"];

function extractTributos(lines: string[]): PgdasdTributo[] {
  const out: PgdasdTributo[] = [];
  for (const tributo of TRIBUTOS) {
    const key = norm(tributo).replace("/pasep", "").replace("/cpp", "");
    for (const raw of lines) {
      const plain = norm(raw);
      if (!new RegExp(`(^|[^a-z])${key}([^a-z]|$)`).test(plain)) continue;
      const money = raw.match(MONEY);
      if (money?.[1]) {
        out.push({ tributo, valor: parseAmount(money[1]) });
        break;
      }
    }
  }
  return out;
}

/** Interpreta o texto do extrato do PGDAS-D. */
export function parsePgdasdText(text: string): PgdasdExtraction {
  const result = emptyExtraction();
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { ...result, status: "sem_texto", faltantes: ["texto do PDF"] };
  }

  const cnpj = findLineValue(lines, ["cnpj"], CNPJ_RE) ?? text.match(CNPJ_RE)?.[1] ?? null;
  const razao = (() => {
    for (let i = 0; i < lines.length; i += 1) {
      const plain = norm(lines[i]!);
      if (plain.includes("nome empresarial") || plain.includes("razao social")) {
        const inline = lines[i]!.split(/:/).slice(1).join(":").trim();
        if (inline) return inline;
        return lines[i + 1]?.trim() ?? null;
      }
    }
    return null;
  })();

  const competencia =
    findLineValue(lines, ["periodo de apuracao", "competencia", "pa "], COMPETENCIA_RE) ??
    text.match(COMPETENCIA_RE)?.[1] ??
    null;

  const rbt12 = findAmount(lines, [
    "rbt12",
    "receita bruta dos ultimos 12",
    "receita bruta total acumulada nos doze",
    "receita bruta acumulada nos 12",
  ]);
  const receitaPa = findAmount(lines, [
    "receita bruta do pa",
    "receita bruta do periodo de apuracao",
    "receita bruta informada no pa",
    "total do pa",
  ]);
  const folha = findAmount(lines, [
    "folha de salarios dos ultimos 12",
    "folha de salarios acumulada",
    "fs12",
    "folha de salarios",
  ]);
  const das = findAmount(lines, ["total do das", "valor total do das", "total do documento"]);

  const anexos = extractAnexos(lines);
  const tributos = extractTributos(lines);

  const faltantes: string[] = [];
  if (!cnpj) faltantes.push("CNPJ");
  if (!competencia) faltantes.push("competência");
  if (rbt12 === null) faltantes.push("RBT12");
  if (receitaPa === null) faltantes.push("receita bruta do período");
  if (anexos.length === 0) faltantes.push("Anexo");

  return {
    competencia,
    cnpj: cnpj ? cnpj.replace(/\D/g, "") : null,
    razaoSocial: razao,
    rbt12,
    receitaBrutaPa: receitaPa,
    anexos,
    folha12Meses: folha,
    valorTotalDas: das,
    tributos,
    status: faltantes.length === 0 ? "ok" : "parcial",
    faltantes,
  };
}

/** Lê e interpreta o arquivo enviado. */
export async function readPgdasd(file: File): Promise<PgdasdExtraction> {
  const text = await readPdfText(file);
  if (!text.trim()) {
    return { ...emptyExtraction(), status: "sem_texto", faltantes: ["texto do PDF"] };
  }
  return parsePgdasdText(text);
}

/** Competência (MM/AAAA) com mais de 12 meses em relação a hoje? */
export function isCompetenciaAntiga(competencia: string | null): boolean {
  if (!competencia) return false;
  const m = competencia.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const date = new Date(Number(m[2]), Number(m[1]) - 1, 1);
  const months =
    (new Date().getFullYear() - date.getFullYear()) * 12 +
    (new Date().getMonth() - date.getMonth());
  return months > 12;
}
