/**
 * Tipos compartilhados do instrumento contratual do escritório.
 * O modelo (diagnóstico) produz uma lista de blocos neutros, que o gerador
 * de PDF timbrado desenha depois.
 */

export type ContratoKind = "diagnostico";

export const CONTRATO_LABELS: Record<ContratoKind, string> = {
  diagnostico: "Diagnóstico da Reforma Tributária",
};

export type Segmento = "comercio" | "servicos" | "imobiliario";

export const SEGMENTO_LABELS: Record<Segmento, string> = {
  comercio: "Comércio e distribuição",
  servicos: "Prestação de serviços",
  imobiliario: "Imobiliário (venda e locação)",
};

export interface DadosEscritorio {
  nome: string;
  cnpj: string;
  endereco: string;
  advogadoNome: string;
  /** Vazio quando a contratada não se apresenta como sociedade de advogados. */
  oab: string;
  cpfAdvogado: string;
  foro: string;
  email: string;
}

/**
 * Fallback vazio: os dados reais do escritório vêm de `office_config`
 * (tela Configurações), nunca hardcoded no código. Só usado se essas
 * configurações ainda não tiverem sido preenchidas.
 */
export const ESCRITORIO_PADRAO: DadosEscritorio = {
  nome: "",
  cnpj: "",
  endereco: "",
  advogadoNome: "",
  oab: "",
  cpfAdvogado: "",
  foro: "",
  email: "",
};

export interface DadosContratante {
  razaoSocial: string;
  cnpj: string;
  representante: string;
  cpf: string;
  endereco: string;
  email: string;
  telefone: string;
  /** Atividade descrita na cláusula 1. */
  atividade: string;
  /** Operações principais descritas na cláusula 1. */
  operacoes: string;
}

export interface ParamsDiagnostico {
  local: string;
  /** Data do documento em ISO (yyyy-mm-dd). */
  data: string;
  validadeDias: number;
  prazoDias: number;
  valorTotal: number;
  entradaPct: number;
  entradaData: string;
  formaPagamento: string;
  segmentos: Segmento[];
}

export const paramsDiagnosticoPadrao = (): ParamsDiagnostico => ({
  local: "Fortaleza/CE",
  data: new Date().toISOString().slice(0, 10),
  validadeDias: 30,
  prazoDias: 60,
  valorTotal: 0,
  entradaPct: 50,
  entradaData: "",
  formaPagamento: "PIX, boleto ou transferência bancária — dados informados no envio do aceite",
  segmentos: [],
});

/* ---------- blocos de documento ---------- */

export interface BlocoTabela {
  tipo: "tabela";
  titulo?: string;
  cabecalho?: string[];
  /** Frações da largura útil, somando 1. */
  colunas: number[];
  linhas: string[][];
}

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "clausula"; texto: string }
  | {
      tipo: "paragrafo";
      texto: string;
      alinhamento?: "esquerda" | "direita" | "centro";
      negrito?: boolean;
    }
  | { tipo: "espaco"; altura?: number }
  | { tipo: "quebra" }
  | { tipo: "linhaAssinatura"; nome: string; detalhe: string }
  | BlocoTabela;

export interface DocumentoContrato {
  kind: ContratoKind;
  titulo: string;
  /** Nome do arquivo enviado para assinatura. */
  arquivo: string;
  blocos: Bloco[];
}
