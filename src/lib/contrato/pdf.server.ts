/** Gerador do PDF timbrado dos contratos (logo no cabeçalho, tabelas com bordas). */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { LOGO_ESCRITORIO_JPG_BASE64 } from "./logo.server";
import type { BlocoTabela, DadosEscritorio, DocumentoContrato } from "./tipos";

const A4: [number, number] = [595.28, 841.89];
const M = 56;
const W = A4[0] - M * 2;
const TOP = A4[1] - 108;
const BOTTOM = 64;

const NAVY = rgb(0.086, 0.145, 0.247);
const TEXT = rgb(0.12, 0.13, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.75, 0.78, 0.83);
const HEAD_BG = rgb(0.9, 0.92, 0.95);

/** Helvetica padrão só desenha Latin-1: normaliza o restante. */
function safe(t: string): string {
  return t
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= width) line = test;
      else {
        if (line) out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

class Pdf {
  doc!: PDFDocument;
  page!: PDFPage;
  y = TOP;
  reg!: PDFFont;
  bold!: PDFFont;
  logo: PDFImage | null = null;
  esc!: DadosEscritorio;

  static async create(esc: DadosEscritorio, titulo: string) {
    const p = new Pdf();
    p.doc = await PDFDocument.create();
    p.doc.setTitle(safe(titulo));
    p.doc.setAuthor(safe(esc.nome));
    p.reg = await p.doc.embedFont(StandardFonts.Helvetica);
    p.bold = await p.doc.embedFont(StandardFonts.HelveticaBold);
    p.logo = LOGO_ESCRITORIO_JPG_BASE64
      ? await p.doc.embedJpg(Uint8Array.from(atob(LOGO_ESCRITORIO_JPG_BASE64), (c) => c.charCodeAt(0)))
      : null;
    p.esc = esc;
    p.newPage();
    return p;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    if (this.logo) {
      const h = 54;
      const w = (this.logo.width / this.logo.height) * h;
      this.page.drawImage(this.logo, { x: M, y: A4[1] - 34 - h, width: w, height: h });
    }
    const right = A4[0] - M;
    const lines: [string, PDFFont, number][] = [
      [this.esc.nome, this.bold, 10],
      ...(this.esc.oab ? ([[this.esc.oab, this.reg, 8]] as [string, PDFFont, number][]) : []),
      [`CNPJ ${this.esc.cnpj}`, this.reg, 8],
      [this.esc.email, this.reg, 8],
    ];
    let yy = A4[1] - 44;
    for (const [t, f, s] of lines) {
      const tt = safe(t);
      this.page.drawText(tt, { x: right - f.widthOfTextAtSize(tt, s), y: yy, size: s, font: f, color: NAVY });
      yy -= s + 3;
    }
    this.page.drawLine({
      start: { x: M, y: A4[1] - 96 },
      end: { x: right, y: A4[1] - 96 },
      thickness: 1,
      color: NAVY,
    });
    const foot = safe(this.esc.endereco);
    this.page.drawText(foot, {
      x: (A4[0] - this.reg.widthOfTextAtSize(foot, 7.5)) / 2,
      y: 36,
      size: 7.5,
      font: this.reg,
      color: MUTED,
    });
    this.y = TOP;
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  text(t: string, o: { size?: number; bold?: boolean; align?: "esquerda" | "direita" | "centro"; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.reg;
    const lh = size * 1.4;
    for (const line of wrap(t, font, size, W)) {
      this.ensure(lh);
      const lw = font.widthOfTextAtSize(line, size);
      const x = o.align === "direita" ? M + W - lw : o.align === "centro" ? M + (W - lw) / 2 : M;
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? TEXT });
      this.y -= lh;
    }
    this.y -= o.gap ?? 6;
  }

  table(t: BlocoTabela) {
    const size = 8.6;
    const lh = size * 1.35;
    const pad = 4;
    const widths = t.colunas.map((c) => c * W);
    if (t.titulo) {
      this.ensure(lh + pad * 2 + 30);
      const h = lh + pad * 2;
      this.page.drawRectangle({ x: M, y: this.y - h, width: W, height: h, color: NAVY });
      this.page.drawText(safe(t.titulo), { x: M + pad, y: this.y - pad - size, size, font: this.bold, color: rgb(1, 1, 1) });
      this.y -= h;
    }
    const rows: { cells: string[]; head: boolean }[] = [];
    if (t.cabecalho) rows.push({ cells: t.cabecalho, head: true });
    for (const l of t.linhas) rows.push({ cells: l, head: false });
    for (const row of rows) {
      const wrapped = row.cells.map((c, i) => {
        const font = row.head || (i === 0 && t.colunas.length === 2) ? this.bold : this.reg;
        return { font, lines: wrap(c, font, size, widths[i]! - pad * 2) };
      });
      const h = Math.max(...wrapped.map((w) => w.lines.length)) * lh + pad * 2;
      this.ensure(h);
      let x = M;
      wrapped.forEach((cell, i) => {
        const cw = widths[i]!;
        this.page.drawRectangle({
          x,
          y: this.y - h,
          width: cw,
          height: h,
          borderColor: LINE,
          borderWidth: 0.6,
          ...(row.head ? { color: HEAD_BG } : {}),
        });
        let yy = this.y - pad - size;
        for (const ln of cell.lines) {
          this.page.drawText(ln, { x: x + pad, y: yy, size, font: cell.font, color: TEXT });
          yy -= lh;
        }
        x += cw;
      });
      this.y -= h;
    }
    this.y -= 12;
  }
}

export async function gerarPdfContrato(esc: DadosEscritorio, d: DocumentoContrato): Promise<Uint8Array> {
  const pdf = await Pdf.create(esc, d.titulo);
  for (const b of d.blocos) {
    switch (b.tipo) {
      case "titulo":
        pdf.ensure(40);
        pdf.text(b.texto, { size: 13, bold: true, align: "centro", color: NAVY, gap: 4 });
        break;
      case "subtitulo":
        pdf.text(b.texto, { size: 11, bold: true, align: "centro", color: NAVY, gap: 10 });
        break;
      case "clausula":
        pdf.ensure(60);
        pdf.y -= 4;
        pdf.text(b.texto, { size: 10.5, bold: true, color: NAVY, gap: 6 });
        break;
      case "paragrafo":
        pdf.text(b.texto, { bold: b.negrito ?? false, align: b.alinhamento ?? "esquerda" });
        break;
      case "espaco":
        pdf.y -= b.altura ?? 10;
        break;
      case "quebra":
        pdf.newPage();
        break;
      case "linhaAssinatura":
        pdf.ensure(60);
        pdf.y -= 26;
        pdf.page.drawLine({ start: { x: M, y: pdf.y }, end: { x: M + 240, y: pdf.y }, thickness: 0.6, color: TEXT });
        pdf.y -= 4;
        pdf.text(b.nome, { bold: true, gap: 0 });
        pdf.text(b.detalhe, { size: 9, color: MUTED });
        break;
      case "tabela":
        pdf.table(b);
        break;
    }
  }
  const pages = pdf.doc.getPages();
  pages.forEach((pg, i) => {
    const t = `Página ${i + 1} de ${pages.length}`;
    pg.drawText(safe(t), { x: A4[0] - M - pdf.reg.widthOfTextAtSize(safe(t), 7.5), y: 24, size: 7.5, font: pdf.reg, color: MUTED });
  });
  return pdf.doc.save();
}
