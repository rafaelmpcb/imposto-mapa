import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { OfficeConfig } from "@/lib/office-config.functions";

export interface MemorandoClient {
  razao_social: string;
  cnpj: string;
  endereco: string;
  representante_nome: string;
}

export interface MemorandoManual {
  representante_cpf: string;
  prazo_confidencialidade_anos: string;
  cidade_assinatura: string;
  data_assinatura: string;
}

export interface MemorandoData {
  escritorio: OfficeConfig;
  cliente: MemorandoClient;
  manual: MemorandoManual;
}

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const FONT = "Arial";

const body = (text: string, opts: { bold?: boolean; align?: "center" } = {}) =>
  new Paragraph({
    alignment: opts.align === "center" ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: 180, line: 300 },
    children: [new TextRun({ text, bold: opts.bold === true, font: FONT, size: 22 })],
  });

/** Parágrafo com prefixo em negrito ("ESCRITÓRIO: ..."). */
const labelled = (label: string, rest: string) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 180, line: 300 },
    children: [
      new TextRun({ text: label, bold: true, font: FONT, size: 22 }),
      new TextRun({ text: rest, font: FONT, size: 22 }),
    ],
  });

const clause = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 24 })],
  });

export async function buildMemorandoBlob(data: MemorandoData): Promise<Blob> {
  const { escritorio: e, cliente: c, manual: m } = data;

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: "MEMORANDO DE ENTENDIMENTO E CONFIDENCIALIDADE",
                bold: true,
                font: FONT,
                size: 28,
              }),
            ],
          }),

          labelled(
            "ESCRITÓRIO: ",
            `${e.nome}, inscrito no CNPJ sob nº ${e.cnpj}, com sede em ${e.endereco}, neste ato representado por ${e.advogado_nome}, advogado inscrito na ${e.oab}, doravante denominado “ESCRITÓRIO”.`,
          ),
          labelled(
            "CLIENTE: ",
            `${c.razao_social}, inscrita no CNPJ sob nº ${c.cnpj}, com sede em ${c.endereco}, neste ato representada por ${c.representante_nome}, portador(a) do CPF nº ${m.representante_cpf}, doravante denominado “CLIENTE”.`,
          ),

          body(
            "CONSIDERANDO que o CLIENTE realizou simulação preliminar e estimativa de impacto da Reforma Tributária sobre sua operação, por meio de ferramenta disponibilizada pelo ESCRITÓRIO (“Reforma Fácil”);",
          ),
          body(
            "CONSIDERANDO o interesse do CLIENTE em avançar para diagnóstico fiscal completo, mediante análise de documentos e dados fiscais reais;",
          ),
          body(
            "CONSIDERANDO que, para a realização desse diagnóstico, será necessário o compartilhamento de documentos e dados fiscais, contábeis, societários e, eventualmente, dados pessoais, de natureza sigilosa;",
          ),
          body(
            "As partes celebram o presente Memorando de Entendimento e Confidencialidade (“Memorando”), que se rege pelas cláusulas seguintes:",
          ),

          clause("Cláusula 1 — Do objeto"),
          body(
            "1.1. Este Memorando formaliza o entendimento entre as partes quanto à intenção do CLIENTE de contratar o ESCRITÓRIO para a realização de diagnóstico fiscal completo relativo aos impactos da Reforma Tributária (EC 132/2023 e LC 214/2025) sobre suas operações, a partir da análise de documentos fiscais reais.",
          ),
          body(
            "1.2. Este instrumento não constitui, por si só, contrato de prestação de serviços advocatícios, nem gera obrigação de contratação por qualquer das partes. Escopo, prazo e honorários do diagnóstico completo serão objeto de proposta e contrato específicos, a formalizar em momento posterior.",
          ),

          clause("Cláusula 2 — Da confidencialidade"),
          body(
            "2.1. As partes comprometem-se a manter sigilo sobre toda informação, documento, dado técnico, fiscal, contábil, societário, financeiro ou comercial trocado em razão deste Memorando e do diagnóstico dele decorrente (“Informação Confidencial”).",
          ),
          body(
            "2.2. A obrigação de confidencialidade não se aplica a informação que: (i) já seja de domínio público sem violação deste Memorando; (ii) tenha sido desenvolvida de forma independente pela parte receptora; ou (iii) deva ser revelada por lei, ordem judicial ou determinação de autoridade competente — hipótese em que a parte obrigada notificará a outra previamente, sempre que possível.",
          ),
          body(
            `2.3. A obrigação de confidencialidade permanece vigente durante toda a relação entre as partes e por ${m.prazo_confidencialidade_anos} anos após seu encerramento, independentemente do motivo.`,
          ),
          body(
            "2.4. O ESCRITÓRIO observa, adicionalmente, o dever de sigilo profissional a que está sujeito por força do Estatuto da Advocacia e do Código de Ética e Disciplina da OAB.",
          ),

          clause("Cláusula 3 — Da proteção de dados pessoais (LGPD)"),
          body(
            "3.1. Eventuais dados pessoais compartilhados em razão deste Memorando serão tratados pelo ESCRITÓRIO exclusivamente para a finalidade de elaboração do diagnóstico fiscal e das providências a ele relacionadas, com fundamento no art. 7º, V, da Lei nº 13.709/2018 (LGPD) — execução de procedimentos preliminares relacionados a contrato do qual o titular, ou a pessoa jurídica por ele representada, seja parte — e, subsidiariamente, no legítimo interesse das partes na avaliação da viabilidade do diagnóstico (art. 7º, IX).",
          ),
          body(
            "3.2. O ESCRITÓRIO adota medidas técnicas e administrativas razoáveis para proteger os dados pessoais e demais informações recebidas contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.",
          ),
          body(
            "3.3. Caso as partes não avancem para a contratação do diagnóstico completo, os dados e documentos compartilhados serão eliminados ou devolvidos ao CLIENTE, conforme sua opção, no prazo de 30 (trinta) dias contados da manifestação de desistência de qualquer das partes, ressalvada a guarda pelo prazo exigido por obrigação legal ou regulatória aplicável à atividade advocatícia.",
          ),

          clause("Cláusula 4 — Da vigência"),
          body(
            "4.1. Este Memorando vigora a partir da data de sua assinatura e permanece em vigor até a celebração do contrato de prestação de serviços relativo ao diagnóstico completo, ou até sua rescisão por qualquer das partes mediante comunicação por escrito — sem prejuízo da subsistência das obrigações de confidencialidade previstas na Cláusula 2.",
          ),

          clause("Cláusula 5 — Disposições gerais"),
          body("5.1. Este Memorando obriga as partes e seus eventuais sucessores."),
          body(
            `5.2. Fica eleito o foro da comarca de ${e.foro}, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir controvérsias oriundas deste instrumento.`,
          ),

          new Paragraph({
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({
                text: `${m.cidade_assinatura}, ${m.data_assinatura}.`,
                font: FONT,
                size: 22,
              }),
            ],
          }),

          body("_________________________________________", { align: "center" }),
          body(`ESCRITÓRIO — ${e.nome}`, { align: "center" }),
          body(`${e.advogado_nome} — ${e.oab}`, { align: "center" }),

          new Paragraph({ spacing: { after: 320 }, children: [new TextRun({ text: "" })] }),

          body("_________________________________________", { align: "center" }),
          body(`CLIENTE — ${c.razao_social}`, { align: "center" }),
          body(`${c.representante_nome} — CPF nº ${m.representante_cpf}`, { align: "center" }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export const memorandoFileName = (razaoSocial: string) =>
  `memorando-${slugify(razaoSocial) || new Date().toISOString().slice(0, 10)}.docx`;
