import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  compareRegimes,
  simulate,
  type SimulationInput,
  type TaxpayerType,
} from "@/lib/tax/calc";
import { LEGAL_REFERENCE_DATE, type YearId } from "@/lib/tax/constants";

const REGIME_LABELS: Record<TaxpayerType, string> = {
  pf: "Pessoa Física (CLT)",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

/* Formatação própria (sem Intl) para funcionar em qualquer runtime de servidor. */
function money(value: number): string {
  const neg = value < 0;
  const cents = Math.round(Math.abs(value) * 100);
  const whole = Math.floor(cents / 100).toString();
  const frac = (cents % 100).toString().padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}R$ ${grouped},${frac}`;
}

function percent(fraction: number, digits = 2): string {
  const v = fraction * 100;
  return `${v.toFixed(digits).replace(".", ",")}%`;
}

function formatDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
}

/* Fontes padrão do PDF usam WinAnsi: normaliza o que estiver fora dessa tabela. */
function safe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;
const HEADER_TOP = A4[1] - 40;
const BODY_TOP = A4[1] - 84;
const BODY_BOTTOM = 66;

const NAVY = rgb(0.086, 0.145, 0.247);
const TEXT = rgb(0.12, 0.13, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const DANGER = rgb(0.72, 0.14, 0.14);
const SUCCESS = rgb(0.06, 0.45, 0.28);

export interface ReportPayload {
  input: SimulationInput;
  year: YearId;
  clientName?: string | null;
  generatedAt?: Date;
}

class Doc {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private y = BODY_TOP;
  private pages = 0;
  regular!: PDFFont;
  bold!: PDFFont;
  /** Espaço reservado para um cabeçalho com logo no futuro. */
  private headerTitle = "Relatório de impacto estimado — Reforma Tributária (IBS/CBS)";

  static async create(): Promise<Doc> {
    const d = new Doc();
    d.doc = await PDFDocument.create();
    d.doc.setTitle("Relatório de impacto estimado — Reforma Tributária");
    d.doc.setCreator("Simulador da Reforma Tributária");
    d.regular = await d.doc.embedFont(StandardFonts.Helvetica);
    d.bold = await d.doc.embedFont(StandardFonts.HelveticaBold);
    d.newPage();
    return d;
  }

  newPage(): void {
    this.page = this.doc.addPage(A4);
    this.pages += 1;
    // Cabeçalho (substituir por logo quando houver identidade visual).
    this.page.drawText(safe(this.headerTitle), {
      x: MARGIN,
      y: HEADER_TOP,
      size: 9,
      font: this.bold,
      color: NAVY,
    });
    this.page.drawLine({
      start: { x: MARGIN, y: HEADER_TOP - 10 },
      end: { x: A4[0] - MARGIN, y: HEADER_TOP - 10 },
      thickness: 0.8,
      color: LINE,
    });
    // Rodapé.
    this.page.drawLine({
      start: { x: MARGIN, y: BODY_BOTTOM - 12 },
      end: { x: A4[0] - MARGIN, y: BODY_BOTTOM - 12 },
      thickness: 0.8,
      color: LINE,
    });
    this.page.drawText(
      safe("Documento estimativo. Não substitui diagnóstico fiscal nem constitui parecer jurídico."),
      { x: MARGIN, y: BODY_BOTTOM - 26, size: 7.5, font: this.regular, color: MUTED },
    );
    const label = safe(`Página ${this.pages}`);
    this.page.drawText(label, {
      x: A4[0] - MARGIN - this.regular.widthOfTextAtSize(label, 7.5),
      y: BODY_BOTTOM - 26,
      size: 7.5,
      font: this.regular,
      color: MUTED,
    });
    this.y = BODY_TOP;
  }

  ensure(height: number): void {
    if (this.y - height < BODY_BOTTOM) this.newPage();
  }

  gap(h: number): void {
    this.y -= h;
  }

  get cursor(): number {
    return this.y;
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  text(
    content: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      leading?: number;
      after?: number;
    } = {},
  ): void {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const width = opts.width ?? CONTENT_WIDTH;
    const leading = opts.leading ?? size * 1.42;
    for (const line of this.wrap(content, font, size, width)) {
      this.ensure(leading);
      this.y -= leading;
      this.page.drawText(line, {
        x: opts.x ?? MARGIN,
        y: this.y,
        size,
        font,
        color: opts.color ?? TEXT,
      });
    }
    if (opts.after) this.gap(opts.after);
  }

  heading(title: string): void {
    this.ensure(42);
    this.gap(12);
    this.text(title, { size: 13, bold: true, color: NAVY });
    this.ensure(10);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4[0] - MARGIN, y: this.y },
      thickness: 0.8,
      color: LINE,
    });
    this.gap(6);
  }

  bullets(items: string[], size = 9.5): void {
    for (const item of items) {
      const lines = this.wrap(item, this.regular, size, CONTENT_WIDTH - 14);
      this.ensure(lines.length * size * 1.4);
      for (let i = 0; i < lines.length; i += 1) {
        this.y -= size * 1.4;
        if (i === 0) {
          this.page.drawText("-", { x: MARGIN, y: this.y, size, font: this.regular, color: NAVY });
        }
        this.page.drawText(lines[i] as string, {
          x: MARGIN + 14,
          y: this.y,
          size,
          font: this.regular,
          color: TEXT,
        });
      }
      this.gap(2);
    }
  }

  /** Linha de tabela com três colunas: rótulo, valor A, valor B. */
  row(label: string, a: string, b: string, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}): void {
    const size = 9.5;
    const font = opts.bold ? this.bold : this.regular;
    this.ensure(18);
    this.y -= 15;
    const colA = MARGIN + CONTENT_WIDTH * 0.52;
    const colB = MARGIN + CONTENT_WIDTH * 0.78;
    const right = MARGIN + CONTENT_WIDTH;
    this.page.drawText(safe(label), {
      x: MARGIN,
      y: this.y,
      size,
      font,
      color: opts.color ?? TEXT,
    });
    const aText = safe(a);
    const bText = safe(b);
    this.page.drawText(aText, {
      x: colB - 6 - font.widthOfTextAtSize(aText, size),
      y: this.y,
      size,
      font,
      color: opts.color ?? TEXT,
    });
    this.page.drawText(bText, {
      x: right - font.widthOfTextAtSize(bText, size),
      y: this.y,
      size,
      font,
      color: opts.color ?? TEXT,
    });
    void colA;
  }

  rule(): void {
    this.ensure(8);
    this.y -= 5;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4[0] - MARGIN, y: this.y },
      thickness: 0.6,
      color: LINE,
    });
  }

  box(lines: { text: string; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }[]): void {
    const padding = 12;
    const heights = lines.map((l) => (l.size ?? 10) * 1.5);
    const total = heights.reduce((a, b) => a + b, 0) + padding * 2;
    this.ensure(total + 10);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - total,
      width: CONTENT_WIDTH,
      height: total,
      borderColor: LINE,
      borderWidth: 1,
      color: rgb(0.97, 0.975, 0.985),
    });
    let cursor = top - padding;
    for (const line of lines) {
      const size = line.size ?? 10;
      const font = line.bold ? this.bold : this.regular;
      cursor -= size * 1.5;
      const content = safe(line.text);
      this.page.drawText(content, {
        x: MARGIN + CONTENT_WIDTH / 2 - font.widthOfTextAtSize(content, size) / 2,
        y: cursor + size * 0.35,
        size,
        font,
        color: line.color ?? TEXT,
      });
    }
    this.y = top - total - 6;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export async function buildReportPdf(payload: ReportPayload): Promise<Uint8Array> {
  const { input, year } = payload;
  const generatedAt = payload.generatedAt ?? new Date();
  const result = simulate(input, year);
  const diff = result.reform.total - result.current.total;
  const rateDiff = result.reform.rate - result.current.rate;
  const worse = diff > 0.005;
  const unchanged = Math.abs(diff) <= 0.005;
  const regimeLabel = REGIME_LABELS[input.taxpayerType];
  const isBusiness =
    input.taxpayerType === "simples" ||
    input.taxpayerType === "presumido" ||
    input.taxpayerType === "real";

  const doc = await Doc.create();

  /* 1. Identificação */
  doc.text("Relatório de impacto estimado", { size: 20, bold: true, color: NAVY });
  doc.text("Reforma Tributária do consumo — IBS e CBS (LC 214/2025)", {
    size: 10,
    color: MUTED,
    after: 8,
  });
  if (payload.clientName?.trim()) {
    doc.text(`Cliente/empresa: ${payload.clientName.trim()}`, { size: 11, bold: true });
  }
  doc.text(`Data da simulação: ${formatDate(generatedAt)}`, { size: 10, color: MUTED });
  doc.text(`Regime informado: ${regimeLabel} · Cenário de referência: ${year}`, {
    size: 10,
    color: MUTED,
  });

  /* 2. Sistema atual x cenário pós-reforma */
  doc.heading(`Sistema atual x Cenário ${year} — comparativo tributo a tributo`);
  doc.row("Tributo", "Sistema atual", `Cenário ${year}`, { bold: true, color: MUTED });
  doc.rule();
  const labels = [
    ...result.current.lines.map((l) => l.label),
    ...result.reform.lines.filter((l) => !result.current.lines.some((c) => c.label === l.label)).map((l) => l.label),
  ];
  for (const label of labels) {
    const a = result.current.lines.find((l) => l.label === label)?.value;
    const b = result.reform.lines.find((l) => l.label === label)?.value;
    doc.row(label, a === undefined ? "—" : money(a), b === undefined ? "—" : money(b));
  }
  doc.rule();
  doc.row("Total mensal", money(result.current.total), money(result.reform.total), { bold: true });
  doc.row(
    "Carga sobre a base informada",
    percent(result.current.rate),
    percent(result.reform.rate),
    { bold: true },
  );
  doc.gap(10);

  /* 3. Diferença */
  const diffLabel = unchanged
    ? "SEM ALTERAÇÃO ESTIMADA"
    : worse
      ? "AUMENTO ESTIMADO"
      : "ECONOMIA ESTIMADA";
  const diffColor = unchanged ? TEXT : worse ? DANGER : SUCCESS;
  const pp = `${rateDiff > 0 ? "+" : ""}${(rateDiff * 100).toFixed(2).replace(".", ",")} p.p.`;
  doc.box([
    { text: diffLabel, size: 9.5, bold: true, color: diffColor },
    { text: `${money(Math.abs(diff))} por mês`, size: 20, bold: true, color: diffColor },
    { text: `${pp} na carga tributária · ${money(Math.abs(diff) * 12)} por ano`, size: 9.5, color: MUTED },
  ]);

  /* 4. Comparação entre regimes */
  if (isBusiness) {
    const items = compareRegimes(input, year);
    doc.heading("Comparação entre regimes após a reforma");
    doc.text(
      `Carga tributária mensal estimada em ${year}, após a reforma, nos três regimes empresariais.`,
      { size: 9.5, color: MUTED },
    );
    doc.gap(4);
    doc.row("Regime", "Carga mensal", "% do faturamento", { bold: true, color: MUTED });
    doc.rule();
    for (const item of items) {
      const marks = [
        item.isCurrent ? "seu regime atual" : null,
        item.isBest ? "mais vantajoso após a reforma" : null,
      ].filter(Boolean);
      const label = marks.length ? `${item.label} (${marks.join("; ")})` : item.label;
      doc.row(label, money(item.total), percent(item.rate), {
        bold: item.isBest,
        ...(item.isBest ? { color: SUCCESS } : {}),
      });
      if (item.estimateNote) {
        doc.text(item.estimateNote, { size: 8, color: MUTED, x: MARGIN + 10, width: CONTENT_WIDTH - 10 });
      }
    }
    doc.gap(8);
    doc.text(
      "Simples Nacional exige faturamento anual de até R$ 4,8 milhões e não é permitido para algumas atividades. Lucro Real é obrigatório para faturamento anual acima de R$ 78 milhões ou determinadas atividades financeiras. Migrar de regime tributário tem implicações legais e operacionais além do cálculo de impostos — este comparativo é uma estimativa para orientar a conversa, não uma recomendação definitiva.",
      { size: 8.5, color: MUTED },
    );
  }

  /* 5. Resumo executivo */
  doc.ensure(150);
  doc.heading("Resumo executivo");
  doc.text(
    `Com base nos dados informados, a carga tributária projetada muda de ${percent(
      result.current.rate,
    )} para ${percent(result.reform.rate)} em ${year} — uma ${
      worse ? "elevação" : unchanged ? "variação" : "redução"
    } estimada de ${money(Math.abs(diff))} por mês (${money(Math.abs(diff) * 12)} por ano).`,
    { size: 10 },
  );
  if (result.benefitApplied) {
    doc.gap(4);
    doc.text(
      `Benefício aplicado: alíquota efetiva de IBS/CBS de ${percent(result.effectiveNewRate)} em vez de 26,5%.`,
      { size: 9.5, color: SUCCESS },
    );
  }
  if (result.benefitLost) {
    doc.gap(4);
    doc.text(
      "Benefício de redução de alíquota não aplicado: a composição societária informada não atende aos requisitos da profissão regulamentada.",
      { size: 9.5, color: DANGER },
    );
  }
  if (result.notes.length) {
    doc.gap(6);
    doc.bullets(result.notes);
  }

  /* 6. O que considera / não considera */
  doc.heading("O que esta estimativa considera");
  doc.bullets([
    "Alíquota de referência de 26,5% e reduções por atividade",
    "Tributos sobre consumo do regime atual (PIS, COFINS, ICMS/ISS, Simples)",
    "IRPJ, CSLL e contribuição previdenciária patronal sobre a folha",
    "Créditos estimados sobre compras e receita monofásica informadas",
    "Cronograma de transição previsto na LC 214/2025",
  ]);

  doc.heading("O que esta estimativa NÃO considera");
  doc.bullets([
    "Benefícios estaduais/municipais, substituição tributária e regimes especiais",
    "Split payment, cashback e Imposto Seletivo",
    "Créditos acumulados, estoques e operações interestaduais específicas",
    "Planejamento societário, distribuição de lucros e tributação de dividendos",
    "Particularidades contratuais e reprecificação com clientes e fornecedores",
  ]);

  /* 7. Avisos legais */
  doc.heading("Avisos legais");
  doc.text(
    `Esta é uma estimativa baseada exclusivamente nos dados informados pelo usuário e na legislação vigente da Reforma Tributária (LC 214/2025) em ${LEGAL_REFERENCE_DATE}. Não substitui uma análise fiscal completa nem constitui aconselhamento jurídico ou tributário.`,
    { size: 9, color: MUTED },
  );
  doc.gap(4);
  doc.text(
    "Os valores de 2027 em diante são projeções baseadas no cronograma legal atual, que ainda pode ser ajustado por regulamentação complementar. A alíquota de referência de 26,5% está sujeita a alteração pelo Senado Federal.",
    { size: 9, color: MUTED },
  );
  doc.gap(4);
  doc.text(
    "Nenhuma decisão tributária, societária ou contratual deve ser tomada com base apenas neste documento.",
    { size: 9, color: MUTED },
  );

  /* 8. Próximo passo */
  doc.heading("Próximo passo");
  doc.text(
    "Esse é o retrato estimado do impacto da reforma no seu negócio. O próximo passo é o diagnóstico completo — com base em documentos fiscais reais — que começa com a assinatura de um Memorando de Entendimento e Confidencialidade.",
    { size: 10 },
  );

  return doc.save();
}
