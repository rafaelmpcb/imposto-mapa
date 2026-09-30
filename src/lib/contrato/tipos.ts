/**
 * Tipos compartilhados dos instrumentos contratuais do escritório.
 * Os modelos (diagnóstico e assessoria contínua) produzem uma lista de blocos
 * neutros, que o gerador de PDF timbrado desenha depois.
 */

export type ContratoKind = "diagnostico" | "assessoria";

export const CONTRATO_LABELS: Record<ContratoKind, string> = {
  diagnostico: "Diagnóstico da Reforma Tributária",
  assessoria: "Assessoria Tributária Contínua",
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
  oab: string;
  cpfAdvogado: string;
  foro: string;
  email: string;
}

export const ESCRITORIO_PADRAO: DadosEscritorio = {
  nome: "AZEVEDO & ADVOGADOS ASSOCIADOS",
  cnpj: "31.893.964/0001-30",
  endereco: "Rua Júlio Siqueira, nº 803, Bairro Dionísio Torres, Fortaleza/CE, CEP 60.135-226",
  advogadoNome: "LEONARDO AZEVEDO PINHEIRO BORGES",
  oab: "OAB/CE nº 12.810 | OAB/SP nº 457.940",
  cpfAdvogado: "728.915.723-00",
  foro: "Fortaleza/CE",
  email: "leonardo@azevedoeadvogados.adv.br",
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

export interface ParamsAssessoria {
  local: string;
  data: string;
  validadeDias: number;
  mensalidade: number;
  diaVencimento: number;
  primeiraMensalidadeData: string;
  vigenciaMeses: number;
  avisoPrevioDias: number;
  reunioesMes: number;
  duracaoReuniaoHoras: number;
  canal: string;
  prazoRespostaDiasUteis: number;
  consultasMes: number;
  periodicidadeInformativo: string;
  periodicidadePlano: string;
  horarioAtendimento: string;
  horaTecnica: number;
  reajusteIndice: string;
  formaPagamento: string;
  diaEnvioDocumentos: number;
  documentosMensais: string;
  pontoPartida: "diagnostico" | "levantamento";
  revisaoContratos: "nao" | "incluida";
  revisaoContratosQtd: number;
  pareceres: "nao" | "incluidos";
  pareceresQtd: number;
}

export const paramsDiagnosticoPadrao = (): ParamsDiagnostico => ({
  local: "Fortaleza/CE",
  data: new Date().toISOString().slice(0, 10),
  validadeDias: 30,
  prazoDias: 60,
  valorTotal: 0,
  entradaPct: 50,
  entradaData: "",
  formaPagamento: "PIX ou transferência bancária — dados informados no envio do aceite",
  segmentos: [],
});

export const paramsAssessoriaPadrao = (): ParamsAssessoria => ({
  local: "Fortaleza/CE",
  data: new Date().toISOString().slice(0, 10),
  validadeDias: 30,
  mensalidade: 0,
  diaVencimento: 10,
  primeiraMensalidadeData: "",
  vigenciaMeses: 12,
  avisoPrevioDias: 30,
  reunioesMes: 1,
  duracaoReuniaoHoras: 1,
  canal: "e-mail e grupo de mensagens",
  prazoRespostaDiasUteis: 2,
  consultasMes: 4,
  periodicidadeInformativo: "mensal",
  periodicidadePlano: "trimestral",
  horarioAtendimento: "9h às 18h",
  horaTecnica: 450,
  reajusteIndice: "IPCA",
  formaPagamento: "PIX ou transferência bancária — dados informados no envio do aceite",
  diaEnvioDocumentos: 10,
  documentosMensais: "notas fiscais e faturamento do período",
  pontoPartida: "levantamento",
  revisaoContratos: "nao",
  revisaoContratosQtd: 1,
  pareceres: "nao",
  pareceresQtd: 1,
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
