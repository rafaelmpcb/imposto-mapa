/** Leitura de planilhas (.xlsx/.csv) sem exigir formato fixo do cliente. */
import * as XLSX from "xlsx";

import {
  onlyDigits,
  parseAmount,
  type CarteiraDraftRow,
  type CarteiraField,
  type CarteiraTipo,
  type ColumnMapping,
  type SavedMapping,
} from "./types";

export interface ParsedSheet {
  fileName: string;
  headers: string[];
  rows: string[][];
  /** Índice da linha usada como cabeçalho, dentro da matriz original. */
  headerIndex: number;
}

/** Divide um CSV em células, preservando o texto original dos valores. */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delimiter = [";", "\t", ","]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0]!.d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Lê o arquivo e identifica a linha de cabeçalho e as colunas existentes. */
export async function readSheet(file: File): Promise<ParsedSheet> {
  let matrix: unknown[][];

  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    // CSV é lido como texto: assim "10.000,00" não vira número errado.
    matrix = parseCsv(await file.text());
  } else {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellText: true, cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("A planilha está vazia.");
    const sheet = wb.Sheets[sheetName]!;
    matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    });
  }

  const cells = matrix.map((row) => (row ?? []).map((c) => String(c ?? "").trim()));
  // Cabeçalho: primeira linha com pelo menos 2 células preenchidas e majoritariamente texto.
  let headerIndex = 0;
  for (let i = 0; i < Math.min(cells.length, 20); i += 1) {
    const row = cells[i] ?? [];
    const filled = row.filter((c) => c !== "");
    if (filled.length < 2) continue;
    const textish = filled.filter((c) => !/^[\d.,\-()R$\s]+$/.test(c)).length;
    if (textish >= Math.ceil(filled.length / 2)) {
      headerIndex = i;
      break;
    }
  }

  const rawHeaders = cells[headerIndex] ?? [];
  const width = Math.max(rawHeaders.length, ...cells.map((r) => r.length), 0);
  const headers = Array.from({ length: width }, (_, i) => rawHeaders[i] || `Coluna ${i + 1}`);
  const rows = cells
    .slice(headerIndex + 1)
    .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""))
    .filter((r) => r.some((c) => c !== ""));

  return { fileName: file.name, headers, rows, headerIndex };
}

const NORMALIZE = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const HINTS: Record<CarteiraField, string[]> = {
  nome: ["razaosocial", "razao", "nome", "cliente", "fornecedor", "contraparte", "beneficiario", "favorecido", "descricao", "participante"],
  cnpj: ["cnpj", "cnpjcpf", "cpfcnpj", "documento", "doc", "inscricao", "identificacao"],
  valor: ["valor", "valortotal", "valormovimentado", "total", "montante", "vlr", "valorbruto", "saldo", "movimento"],
  tipo: ["tipo", "natureza", "categoria", "classificacao", "clientefornecedor"],
};

/** Sugere automaticamente o mapeamento, com base no nome das colunas do arquivo. */
export function guessMapping(headers: string[], saved?: SavedMapping | null): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(NORMALIZE);

  if (saved) {
    for (const key of Object.keys(saved) as CarteiraField[]) {
      const target = NORMALIZE(saved[key] ?? "");
      if (!target) continue;
      const idx = normalized.indexOf(target);
      if (idx >= 0) mapping[key] = idx;
    }
  }

  for (const field of ["nome", "cnpj", "valor", "tipo"] as CarteiraField[]) {
    if (mapping[field] !== undefined) continue;
    const hints = HINTS[field];
    let best = -1;
    let bestScore = 0;
    normalized.forEach((h, idx) => {
      if (!h) return;
      if (Object.values(mapping).includes(idx)) return;
      for (const hint of hints) {
        const score = h === hint ? 3 : h.includes(hint) || hint.includes(h) ? 2 : 0;
        if (score > bestScore) {
          bestScore = score;
          best = idx;
        }
      }
    });
    if (best >= 0) mapping[field] = best;
  }

  return mapping;
}

const TIPO_FROM_TEXT = (value: string): CarteiraTipo | null => {
  const v = NORMALIZE(value);
  if (!v) return null;
  if (v.includes("fornec") || v.startsWith("f") || v.includes("pagar") || v.includes("compra"))
    return "fornecedor";
  if (v.includes("client") || v.startsWith("c") || v.includes("receber") || v.includes("venda"))
    return "cliente";
  return null;
};

export interface AggregateOptions {
  /** Tipo declarado para o arquivo inteiro (quando não há coluna de tipo). */
  tipoFixo?: CarteiraTipo | null;
}

/** Aplica o mapeamento e soma as linhas repetidas do mesmo CNPJ. */
export function aggregate(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  options: AggregateOptions = {},
): CarteiraDraftRow[] {
  const acc = new Map<
    string,
    { nomes: Map<string, number>; valor: number; tipo: CarteiraTipo; linhas: number; bruto: string }
  >();
  const invalidos: CarteiraDraftRow[] = [];

  const at = (row: string[], field: CarteiraField): string => {
    const idx = mapping[field];
    if (idx === undefined || idx < 0) return "";
    return row[idx] ?? "";
  };

  sheet.rows.forEach((row) => {
    const nome = at(row, "nome").trim();
    const cnpjRaw = at(row, "cnpj").trim();
    const valor = parseAmount(at(row, "valor"));
    const tipo =
      options.tipoFixo ?? TIPO_FROM_TEXT(at(row, "tipo")) ?? null;

    const digits = onlyDigits(cnpjRaw);
    if (!nome && !cnpjRaw && valor === 0) return;

    if (digits.length !== 14 || !tipo) {
      invalidos.push({
        nome: nome || "(sem nome)",
        cnpj: cnpjRaw,
        tipo: tipo ?? "cliente",
        valor,
        nomesDivergentes: [],
        linhas: 1,
        invalido: "cnpj",
      });
      return;
    }

    const key = `${tipo}:${digits}`;
    const entry = acc.get(key) ?? {
      nomes: new Map<string, number>(),
      valor: 0,
      tipo,
      linhas: 0,
      bruto: digits,
    };
    if (nome) entry.nomes.set(nome, (entry.nomes.get(nome) ?? 0) + 1);
    entry.valor += valor;
    entry.linhas += 1;
    acc.set(key, entry);
  });

  const rows: CarteiraDraftRow[] = [...acc.values()].map((entry) => {
    const ordered = [...entry.nomes.entries()].sort((a, b) => b[1] - a[1]);
    const nome = ordered[0]?.[0] ?? "";
    return {
      nome,
      cnpj: entry.bruto,
      tipo: entry.tipo,
      valor: Math.round(entry.valor * 100) / 100,
      nomesDivergentes: ordered.slice(1).map(([n]) => n),
      linhas: entry.linhas,
      invalido: entry.valor > 0 ? null : "valor",
    };
  });

  return [...rows, ...invalidos].sort((a, b) => b.valor - a.valor);
}

/** Converte o mapeamento por índice em mapeamento por nome de coluna, para guardar no Caso. */
export function toSavedMapping(headers: string[], mapping: ColumnMapping): SavedMapping {
  const saved: SavedMapping = {};
  for (const key of Object.keys(mapping) as CarteiraField[]) {
    const idx = mapping[key];
    if (idx !== undefined && idx >= 0 && headers[idx]) saved[key] = headers[idx];
  }
  return saved;
}

/** Planilha de exemplo, oferecida só a quem não tem nada pronto. */
export function downloadModel() {
  const data = [
    ["Razão Social", "CNPJ", "Tipo", "Valor"],
    ["Empresa Exemplo Ltda", "12.345.678/0001-95", "Cliente", "15000,00"],
    ["Fornecedor Exemplo ME", "98.765.432/0001-10", "Fornecedor", "4200,50"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Composicao");
  XLSX.writeFile(wb, "modelo-composicao-carteira.xlsx");
}
