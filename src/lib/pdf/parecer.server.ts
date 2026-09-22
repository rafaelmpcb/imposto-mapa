import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  AREAS_PLANO,
  AVISO_RECOMENDACAO,
  ESCOPO_LABEL,
  SECOES,
  type ParecerEdicoes,
  type ParecerSnapshot,
} from "@/lib/parecer/tipos";

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
/* Paleta dos gráficos — mesma linguagem visual do relatório em tela. */
const TRACK = rgb(0.93, 0.93, 0.96);
const MINT = rgb(0.16, 0.71, 0.56);
const LAVENDER = rgb(0.45, 0.42, 0.85);
const MAGENTA = rgb(0.83, 0.26, 0.55);
const SKY = rgb(0.22, 0.55, 0.85);
const AMBER = rgb(0.92, 0.65, 0.19);


function safe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");
}

function money(value: number): string {
  const neg = value < 0;
  const cents = Math.round(Math.abs(value) * 100);
  const whole = Math.floor(cents / 100).toString();
  const frac = (cents % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${frac}`;
}

function pct(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

class Doc {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private y = BODY_TOP;
  private pages = 0;
  regular!: PDFFont;
  bold!: PDFFont;

  static async create(titulo: string): Promise<Doc> {
    const d = new Doc();
    d.doc = await PDFDocument.create();
    d.doc.setTitle(titulo);
    d.doc.setCreator("Simulador da Reforma Tributária");
    d.regular = await d.doc.embedFont(StandardFonts.Helvetica);
    d.bold = await d.doc.embedFont(StandardFonts.HelveticaBold);
    d.newPage();
    return d;
  }

  newPage(): void {
    this.page = this.doc.addPage(A4);
    this.pages += 1;
    this.page.drawText(safe("Parecer Padrão — impacto da Reforma Tributária (IBS/CBS)"), {
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
    this.page.drawLine({
      start: { x: MARGIN, y: BODY_BOTTOM - 12 },
      end: { x: A4[0] - MARGIN, y: BODY_BOTTOM - 12 },
      thickness: 0.8,
      color: LINE,
    });
    this.page.drawText(
      safe("Documento técnico de apoio. As estimativas dependem de regulamentação ainda em curso."),
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
      after?: number;
    } = {},
  ): void {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const width = opts.width ?? CONTENT_WIDTH;
    const leading = size * 1.42;
    const lines = this.wrap(content, font, size, width);
    const block = lines.length * leading;
    if (block <= BODY_TOP - BODY_BOTTOM) this.ensure(block);
    for (const line of lines) {
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

  heading(numero: number, titulo: string): void {
    this.ensure(46);
    this.gap(10);
    this.text(`${numero}. ${titulo}`, { size: 13, bold: true, color: NAVY, after: 2 });
  }

  row(cols: string[], widths: number[], opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}): void {
    const size = 9;
    const leading = size * 1.5;
    this.ensure(leading);
    this.y -= leading;
    let x = MARGIN;
    cols.forEach((col, i) => {
      const w = widths[i] ?? 80;
      const font = opts.bold ? this.bold : this.regular;
      let txt = safe(col);
      while (txt.length > 1 && font.widthOfTextAtSize(txt, size) > w - 6) txt = txt.slice(0, -1);
      this.page.drawText(txt, { x, y: this.y, size, font, color: opts.color ?? TEXT });
      x += w;
    });
  }

  /** Título curto de um gráfico, com respiro acima. */
  chartTitle(titulo: string): void {
    this.gap(6);
    this.text(titulo, { size: 10, bold: true, color: NAVY });
  }

  /**
   * Barras horizontais: rótulo à esquerda, barra proporcional ao maior valor
   * e valor formatado à direita. Usa o módulo dos valores para o comprimento.
   */
  hBars(
    items: { label: string; value: number; texto: string; color?: ReturnType<typeof rgb> }[],
    opts: { labelWidth?: number } = {},
  ): void {
    if (items.length === 0) return;
    const labelW = opts.labelWidth ?? 150;
    const valueW = 92;
    const trackW = CONTENT_WIDTH - labelW - valueW - 12;
    const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
    const barH = 11;
    const step = barH + 7;
    this.ensure(items.length * step + 10);
    this.gap(6);
    for (const item of items) {
      this.ensure(step);
      this.y -= step;
      let label = safe(item.label);
      while (label.length > 1 && this.regular.widthOfTextAtSize(label, 8.5) > labelW - 8) {
        label = label.slice(0, -1);
      }
      this.page.drawText(label, {
        x: MARGIN,
        y: this.y + 2,
        size: 8.5,
        font: this.regular,
        color: TEXT,
      });
      this.page.drawRectangle({
        x: MARGIN + labelW,
        y: this.y,
        width: trackW,
        height: barH,
        color: TRACK,
      });
      const w = Math.max((Math.abs(item.value) / max) * trackW, item.value === 0 ? 0 : 2);
      this.page.drawRectangle({
        x: MARGIN + labelW,
        y: this.y,
        width: w,
        height: barH,
        color: item.color ?? NAVY,
      });
      const texto = safe(item.texto);
      this.page.drawText(texto, {
        x: MARGIN + CONTENT_WIDTH - this.bold.widthOfTextAtSize(texto, 8.5),
        y: this.y + 2,
        size: 8.5,
        font: this.bold,
        color: TEXT,
      });
    }
    this.gap(4);
  }

  /**
   * Colunas verticais agrupadas (até duas séries por categoria), com legenda.
   * Serve para comparar "hoje" e "pós-reforma" ano a ano.
   */
  vBars(
    categorias: { label: string; a: number; b?: number | undefined }[],
    opts: { legendA: string; legendB?: string; fmt: (v: number) => string },
  ): void {
    if (categorias.length === 0) return;
    const plotH = 96;
    const blockH = plotH + 46;
    this.ensure(blockH);
    this.gap(6);
    const baseY = this.y - plotH - 16;
    const slot = CONTENT_WIDTH / categorias.length;
    const hasB = opts.legendB != null;
    const barW = Math.min(hasB ? 22 : 34, (slot - 14) / (hasB ? 2 : 1));
    const values = categorias.flatMap((c) => [c.a, c.b ?? 0]);
    const max = Math.max(...values.map(Math.abs), 1);

    this.page.drawLine({
      start: { x: MARGIN, y: baseY },
      end: { x: MARGIN + CONTENT_WIDTH, y: baseY },
      thickness: 0.8,
      color: LINE,
    });

    categorias.forEach((c, i) => {
      const center = MARGIN + slot * i + slot / 2;
      const draw = (value: number, offset: number, color: ReturnType<typeof rgb>) => {
        const h = Math.max((Math.abs(value) / max) * plotH, value === 0 ? 0 : 2);
        const x = center + offset - barW / 2;
        this.page.drawRectangle({ x, y: baseY, width: barW, height: h, color });
        const txt = safe(opts.fmt(value));
        const size = 7;
        this.page.drawText(txt, {
          x: x + barW / 2 - this.regular.widthOfTextAtSize(txt, size) / 2,
          y: baseY + h + 3,
          size,
          font: this.regular,
          color: MUTED,
        });
      };
      if (hasB) {
        draw(c.a, -(barW / 2 + 2), NAVY);
        draw(c.b ?? 0, barW / 2 + 2, MINT);
      } else {
        draw(c.a, 0, NAVY);
      }
      const label = safe(c.label);
      this.page.drawText(label, {
        x: center - this.regular.widthOfTextAtSize(label, 8) / 2,
        y: baseY - 12,
        size: 8,
        font: this.regular,
        color: TEXT,
      });
    });

    this.y = baseY - 26;
    this.legend(
      hasB
        ? [
            { label: opts.legendA, color: NAVY },
            { label: opts.legendB as string, color: MINT },
          ]
        : [{ label: opts.legendA, color: NAVY }],
    );
  }

  /** Barra única 100% empilhada, com legenda de composição. */
  stacked(parts: { label: string; value: number; color: ReturnType<typeof rgb> }[]): void {
    const total = parts.reduce((s, p) => s + Math.max(p.value, 0), 0);
    if (total <= 0) return;
    const h = 20;
    this.ensure(h + 34);
    this.gap(8);
    this.y -= h;
    let x = MARGIN;
    for (const p of parts) {
      const w = (Math.max(p.value, 0) / total) * CONTENT_WIDTH;
      if (w <= 0) continue;
      this.page.drawRectangle({ x, y: this.y, width: w, height: h, color: p.color });
      const share = `${Math.round((Math.max(p.value, 0) / total) * 100)}%`;
      if (w > 26) {
        this.page.drawText(share, {
          x: x + w / 2 - this.bold.widthOfTextAtSize(share, 7.5) / 2,
          y: this.y + 6,
          size: 7.5,
          font: this.bold,
          color: rgb(1, 1, 1),
        });
      }
      x += w;
    }
    this.gap(6);
    this.legend(parts.map((p) => ({ label: p.label, color: p.color })));
  }

  /** Legenda horizontal com quadradinhos de cor. */
  legend(items: { label: string; color: ReturnType<typeof rgb> }[]): void {
    this.ensure(16);
    this.y -= 12;
    let x = MARGIN;
    for (const item of items) {
      const label = safe(item.label);
      const w = this.regular.widthOfTextAtSize(label, 8) + 22;
      if (x + w > MARGIN + CONTENT_WIDTH) {
        this.y -= 12;
        x = MARGIN;
      }
      this.page.drawRectangle({ x, y: this.y, width: 8, height: 8, color: item.color });
      this.page.drawText(label, {
        x: x + 12,
        y: this.y,
        size: 8,
        font: this.regular,
        color: MUTED,
      });
      x += w;
    }
    this.gap(6);
  }

  async bytes(): Promise<Uint8Array> {
    return this.doc.save();
  }
}


export interface ParecerPdfPayload {
  snapshot: ParecerSnapshot;
  edicoes: ParecerEdicoes;
  versao: number;
  status: string;
}

function analista(doc: Doc, texto: string | undefined): void {
  if (!texto?.trim()) return;
  doc.gap(4);
  doc.text("Análise do escritório", { size: 9, bold: true, color: NAVY });
  doc.text(texto.trim(), { size: 10 });
}

export async function buildParecerPdf(payload: ParecerPdfPayload): Promise<Uint8Array> {
  const { snapshot: s, edicoes: e } = payload;
  const doc = await Doc.create("Parecer Padrão — Reforma Tributária");

  doc.text("Parecer Padrão", { size: 22, bold: true, color: NAVY });
  doc.text("Impacto da Reforma Tributária do consumo — IBS e CBS", { size: 10, color: MUTED, after: 6 });
  doc.text(
    `Versão ${payload.versao} · ${payload.status === "finalizado" ? "Finalizado" : "Rascunho"} · Gerado em ${formatDate(
      s.geradoEm,
    )}`,
    { size: 9, color: MUTED },
  );

  /* 1 */
  doc.heading(1, SECOES[0]!.titulo);
  doc.text(`Cliente: ${s.sec1.cliente ?? "não informado"}`, { size: 10 });
  doc.text(`CNPJ: ${s.sec1.cnpj ?? "não informado"}`, { size: 10 });
  doc.text(`Regime atual: ${s.sec1.regimeAtual ?? "não informado"}`, { size: 10 });
  doc.text(`Escopo: ${ESCOPO_LABEL[s.sec1.escopo]}`, { size: 10 });
  doc.text(`Objetivo: ${s.sec1.objetivo ?? "não informado"}`, { size: 10 });
  if (s.sec1.anoBase) doc.text(`Ano de referência do cálculo: ${s.sec1.anoBase}`, { size: 10 });
  analista(doc, e.sec1);

  /* 2 */
  doc.heading(2, SECOES[1]!.titulo);
  if (s.sec2.carga.length > 0) {
    doc.text("Arquivos recebidos", { size: 10, bold: true });
    const w = [150, 60, 70, 70, 70, 70];
    doc.row(["Tipo", "Válidos", "Duplicados", "Não são notas", "Ignorados", "Total"], w, { bold: true });
    for (const l of s.sec2.carga) {
      doc.row(
        [l.tipo, String(l.validos), String(l.duplicados), String(l.naoSaoNotas), String(l.ignorados), String(l.total)],
        w,
      );
    }
  } else {
    doc.text("Nenhum documento fiscal foi processado neste Caso (lacuna documentada).", { size: 10 });
  }
  doc.gap(6);
  doc.text("Lacunas de classificação", { size: 10, bold: true });
  if (s.sec2.pendencias.length === 0) {
    doc.text("Nenhum item sem classificação ou em revisão pendente.", { size: 10 });
  } else {
    for (const p of s.sec2.pendencias) {
      doc.text(`- ${p.fluxo}: ${p.itens} item(ns), ${money(p.valor)}`, { size: 10 });
    }
  }
  doc.gap(6);
  doc.text("Inputs manuais", { size: 10, bold: true });
  if (s.sec2.despesas.length === 0) {
    doc.text("Nenhuma despesa operacional informada manualmente.", { size: 10 });
  } else {
    for (const d of s.sec2.despesas) {
      doc.text(`- Despesa operacional ${d.ano}: ${money(d.valor)} (informada pelo analista)`, { size: 10 });
    }
  }
  if (s.sec2.issOrigem) {
    doc.gap(4);
    doc.text("ISS", { size: 10, bold: true });
    doc.text(s.sec2.issOrigem, { size: 10 });
  }
  doc.gap(6);
  doc.text("Parâmetros do simulador", { size: 10, bold: true });
  for (const p of s.sec2.parametros) {
    doc.text(`- ${p.label}: ${p.valor} (última alteração: ${formatDate(p.atualizadoEm)})`, { size: 10 });
  }
  if (s.sec2.excecoes.length > 0) {
    doc.gap(6);
    doc.text("Benefícios e exceções aplicados", { size: 10, bold: true });
    for (const x of s.sec2.excecoes) {
      doc.text(`- Fonte ${x.fonte}: ${x.itens} item(ns) classificados.`, { size: 10 });
    }
  }
  doc.gap(6);
  doc.text("Limitações", { size: 10, bold: true });
  for (const l of s.sec2.limitacoes) doc.text(`- ${l}`, { size: 9.5, color: MUTED });
  analista(doc, e.sec2);

  /* 3 */
  doc.heading(3, SECOES[2]!.titulo);
  const achados = e.sec3?.achados ?? s.sec3.achados;
  achados.forEach((a, i) => {
    doc.gap(4);
    doc.text(`Achado ${i + 1} — ${a.titulo || "a definir pelo analista"}`, { size: 10.5, bold: true });
    if (a.impacto) doc.text(`Impacto: ${a.impacto}`, { size: 10 });
    if (a.causa) doc.text(`Causa: ${a.causa}`, { size: 10 });
    if (a.decisao) doc.text(`Decisão: ${a.decisao}`, { size: 10 });
  });

  /* 4 */
  doc.heading(4, SECOES[3]!.titulo);
  if (s.sec4.baseTotal === 0) {
    doc.text("Sem documentos de compra apurados neste Caso (lacuna documentada).", { size: 10 });
  } else {
    doc.text(
      `Base apurada de ${money(s.sec4.baseTotal)} com ${money(s.sec4.creditoTotal)} de crédito de IBS/CBS.`,
      { size: 10 },
    );
    if (s.sec4.concentracaoTopPct != null) {
      doc.text(`Maior fornecedor concentra ${pct(s.sec4.concentracaoTopPct)} do crédito apurado.`, { size: 10 });
    }
    doc.gap(4);
    const w = [220, 110, 110, 60];
    doc.row(["Fornecedor", "Base", "Crédito", "Itens"], w, { bold: true });
    for (const f of s.sec4.fornecedores) {
      doc.row([f.nome ?? f.cnpj ?? "-", money(f.valorBase), money(f.valorApurado), String(f.itens)], w);
    }
    if (s.sec4.ncms.length > 0) {
      doc.gap(6);
      doc.row(["NCM", "Base", "Crédito", "Itens"], w, { bold: true });
      for (const n of s.sec4.ncms) {
        doc.row([n.codigo || "-", money(n.valorBase), money(n.valorApurado), String(n.itens)], w);
      }
    }
    if (s.sec4.pendentes > 0) {
      doc.gap(4);
      doc.text(`Risco: ${s.sec4.pendentes} item(ns) ainda em revisão podem alterar o crédito apurado.`, {
        size: 10,
      });
    }
  }
  analista(doc, e.sec4);

  /* 5 */
  doc.heading(5, SECOES[4]!.titulo);
  if (s.sec5.valorAtual === 0) {
    doc.text("Sem cálculo de preço necessário neste Caso (lacuna documentada).", { size: 10 });
  } else {
    doc.text(
      `Vendas analisadas: ${money(s.sec5.valorAtual)}. Preço necessário agregado: ${money(
        s.sec5.precoNecessario,
      )} (variação média de ${pct(s.sec5.variacaoMediaPct)}).`,
      { size: 10 },
    );
    const w = [180, 130, 130, 60];
    doc.gap(4);
    doc.row(["Perfil do cliente", "Valor atual", "Preço necessário", "Itens"], w, { bold: true });
    for (const p of s.sec5.porPerfil) {
      doc.row([p.perfil, money(p.valorAtual), money(p.precoNecessario), String(p.itens)], w);
    }
    if (s.sec5.porAno.length > 0) {
      doc.gap(6);
      doc.row(["Ano", "Preço necessário", "Variação"], [80, 160, 120], { bold: true });
      for (const a of s.sec5.porAno) {
        doc.row([String(a.ano), money(a.precoNecessario), pct(a.variacaoPct)], [80, 160, 120]);
      }
    }
    doc.gap(4);
    doc.text("O preço necessário é piso técnico de neutralidade tributária, não recomendação comercial.", {
      size: 9,
      color: MUTED,
    });
  }
  analista(doc, e.sec5);

  /* 6 */
  doc.heading(6, SECOES[5]!.titulo);
  if (s.sec6.linhas.length === 0) {
    doc.text("DRE ainda não gerada para este Caso (lacuna documentada).", { size: 10 });
  } else {
    const w = [55, 80, 90, 90, 80, 100];
    doc.row(["Ano", "Cenário", "Receita", "Custo", "IR/CS", "Resultado"], w, { bold: true });
    for (const l of s.sec6.linhas) {
      doc.row(
        [
          String(l.ano),
          l.cenario,
          money(l.receitaBruta),
          money(l.custo),
          l.ircs == null ? "-" : money(l.ircs),
          l.resultadoLiquido == null ? "-" : money(l.resultadoLiquido),
        ],
        w,
      );
    }
    doc.gap(4);
    doc.text(
      "A receita projetada aparece sem a CBS embutida: a queda de receita e o IRPJ/CSLL maior não significam, isoladamente, piora de resultado.",
      { size: 9, color: MUTED },
    );
  }
  analista(doc, e.sec6);

  /* 7 */
  doc.heading(7, SECOES[6]!.titulo);
  if (!s.sec7.periodo) {
    doc.text("Fluxo de caixa ainda não projetado para este Caso (lacuna documentada).", { size: 10 });
  } else {
    doc.text(
      `Período de leitura: ${String(s.sec7.periodo.mes).padStart(2, "0")}/${s.sec7.periodo.ano}`,
      { size: 10, bold: true },
    );
    doc.text(`1. Venda bruta do mês: ${money(s.sec7.vendasBrutas)}`, { size: 10 });
    doc.text(`2. IBS/CBS retido na origem: ${money(s.sec7.debitoRetido)}`, { size: 10 });
    doc.text(`3. Crédito de compras disponível no período: ${money(s.sec7.creditoDisponivel)}`, { size: 10 });
    doc.text(`4. Efeito líquido — saída efetiva pelo split: ${money(s.sec7.debitoLiquido)}`, {
      size: 11,
      bold: true,
    });
    if (s.sec7.resultadoLiquidoAno != null) {
      doc.text(`Resultado líquido projetado no ano: ${money(s.sec7.resultadoLiquidoAno)}`, { size: 10 });
    }
    doc.gap(4);
    doc.text(
      "Mostrar apenas a retenção da venda, sem o crédito de compras, é uma meia-leitura: o efeito líquido é o número que orienta a decisão.",
      { size: 9, color: MUTED },
    );
    if (s.sec7.resumoAnual.length > 0) {
      doc.gap(6);
      const w = [70, 140, 140, 140];
      doc.row(["Ano", "Retido", "Crédito disponível", "Efeito líquido"], w, { bold: true });
      for (const a of s.sec7.resumoAnual) {
        doc.row([String(a.ano), money(a.retido), money(a.credito), money(a.liquido)], w);
      }
    }
  }
  analista(doc, e.sec7);

  /* 8 */
  doc.heading(8, SECOES[7]!.titulo);
  if (s.sec8.cenarios.length === 0) {
    doc.text("Comparativo de regimes indisponível (lacuna documentada).", { size: 10 });
  } else {
    const w = [220, 120, 90, 70];
    doc.row(["Regime", "Carga estimada", "Alíquota", "Atual"], w, { bold: true });
    for (const c of s.sec8.cenarios) {
      doc.row(
        [
          c.label,
          c.total == null ? "não disponível" : money(c.total),
          c.rate == null ? "-" : pct(c.rate * 100),
          c.atual ? "sim" : "",
        ],
        w,
      );
    }
    for (const c of s.sec8.cenarios) {
      if (c.nota) {
        doc.gap(4);
        doc.text(c.nota, { size: 9, color: MUTED });
      }
    }
    if (s.sec8.resultadoLiquido != null) {
      doc.gap(4);
      doc.text(`Resultado após IR/CS no ano projetado: ${money(s.sec8.resultadoLiquido)}`, { size: 10 });
    }
  }
  doc.gap(6);
  doc.text("Recomendação do escritório", { size: 10, bold: true, color: NAVY });
  doc.text(e.sec8?.recomendacao?.trim() || "Recomendação não registrada nesta versão.", { size: 10 });
  doc.text(AVISO_RECOMENDACAO, { size: 9, color: MUTED });

  /* 9 */
  doc.heading(9, SECOES[8]!.titulo);
  for (const area of AREAS_PLANO) {
    const edit = e.sec9?.[area.id];
    doc.gap(4);
    doc.text(`${area.area} — ${area.pergunta}`, { size: 10, bold: true });
    doc.text(`Ação: ${edit?.acao?.trim() || s.sec9.sugestoes[area.id] || "a definir"}`, { size: 10 });
    doc.text(
      `Responsável: ${edit?.responsavel?.trim() || "a definir"} · Prazo: ${
        edit?.prazo?.trim() || "a definir"
      } · Prioridade: ${edit?.prioridade?.trim() || "a definir"} · Indicador: ${
        edit?.indicador?.trim() || "a definir"
      }`,
      { size: 9, color: MUTED },
    );
  }

  /* 10 */
  doc.heading(10, SECOES[9]!.titulo);
  doc.text(e.sec10?.sintese?.trim() || "Síntese não registrada nesta versão.", { size: 10 });
  doc.gap(4);
  doc.text(
    `Próxima revisão sugerida: ${e.sec10?.proximaRevisao?.trim() || "a agendar"}`,
    { size: 10, bold: true },
  );
  doc.gap(4);
  doc.text(
    "As ressalvas aplicáveis estão listadas na Seção 2 (Base documental e premissas) e integram este parecer.",
    { size: 9, color: MUTED },
  );

  return doc.bytes();
}
