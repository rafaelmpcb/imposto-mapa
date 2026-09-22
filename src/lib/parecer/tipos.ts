/**
 * Tipos e textos fixos do Parecer Padrão (Etapa 3 — camada de entregável).
 * Nada aqui calcula: são formatos de snapshot, rótulos e textos do manual.
 */

export type ParecerStatus = "rascunho" | "em_revisao" | "finalizado";

export type CaseEscopo = "light" | "completo";

export const ESCOPO_LABEL: Record<CaseEscopo, string> = {
  light: "LIGHT — 1 a 2 meses (proposta / potencial impacto)",
  completo: "COMPLETO — ano fechado (entrega ao cliente)",
};

export interface SecaoDef {
  numero: number;
  titulo: string;
  /** Bloco de tempo sugerido pelo manual para a reunião de entrega. */
  tempo: string;
  /** Campo do analista é obrigatório antes de finalizar. */
  obrigatorio: boolean;
}

export const SECOES: SecaoDef[] = [
  { numero: 1, titulo: "Identificação e escopo", tempo: "3 min", obrigatorio: false },
  { numero: 2, titulo: "Base documental e premissas", tempo: "5 min", obrigatorio: false },
  { numero: 3, titulo: "Sumário executivo (3 achados)", tempo: "7 min", obrigatorio: true },
  { numero: 4, titulo: "Compras", tempo: "8 min", obrigatorio: false },
  { numero: 5, titulo: "Vendas e precificação", tempo: "8 min", obrigatorio: false },
  { numero: 6, titulo: "DRE e margem", tempo: "7 min", obrigatorio: false },
  { numero: 7, titulo: "Fluxo de caixa e split payment", tempo: "7 min", obrigatorio: false },
  { numero: 8, titulo: "Regimes tributários", tempo: "8 min", obrigatorio: true },
  { numero: 9, titulo: "Plano de ação por departamento", tempo: "10 min", obrigatorio: false },
  { numero: 10, titulo: "Conclusão e ressalvas", tempo: "5 min", obrigatorio: true },
];

export interface AreaPlano {
  id: string;
  area: string;
  pergunta: string;
}

export const AREAS_PLANO: AreaPlano[] = [
  { id: "compras", area: "Compras", pergunta: "Quais fornecedores renegociar, trocar ou monitorar?" },
  {
    id: "vendas",
    area: "Vendas / Precificação",
    pergunta: "O que repassar, absorver ou diferenciar por perfil de cliente?",
  },
  { id: "fiscal", area: "Fiscal", pergunta: "CNAE/NCM/CFOP/benefícios e cadastros estão preparados?" },
  {
    id: "financeiro",
    area: "Financeiro",
    pergunta: "Quanto capital de giro será necessário com créditos e split?",
  },
  {
    id: "juridico",
    area: "Jurídico",
    pergunta: "Contratos têm cláusulas de preço/tributo e gatilhos de revisão adequados?",
  },
  { id: "rh", area: "RH", pergunta: "Folha e Fator R alteram estratégia de regime?" },
  {
    id: "erp",
    area: "ERP / Dados",
    pergunta: "O sistema captura NCM, CFOP, cliente/fornecedor e documentos necessários?",
  },
  {
    id: "governanca",
    area: "Governança",
    pergunta: "Quem é o dono de cada ação, prazo e evidência de conclusão?",
  },
];

export const AVISO_RECOMENDACAO =
  "A recomendação do sistema é insumo, não parecer; o documento final precisa registrar a análise jurídica/tributária e o contexto do negócio.";

/** Ressalvas fixas já definidas nos módulos de origem. */
export const LIMITACOES = {
  real: "Quando o regime atual é Lucro Real, o custo atual é apresentado sem o crédito hoje recuperável de PIS/COFINS — a comparação tende a exagerar a queda de custo.",
  simples:
    "Crédito gerado por fornecedor optante pelo Simples Nacional não é modelado; pela convenção adotada, entra como não gerador de crédito.",
  aliquota:
    "A alíquota plena de IBS/CBS e o cronograma de transição são estimativas: dependem de regulamentação e de lei complementar ainda em ajuste.",
  fluxo:
    "O fluxo de caixa é uma projeção simplificada: distribui as séries anuais uniformemente pelos meses, sem sazonalidade, e usa prazos médios informados.",
  dre: "Na DRE, a receita projetada aparece sem a CBS embutida — o efeito visual de queda de receita e o IRPJ/CSLL maior não significam, isoladamente, piora de resultado.",
  split:
    "A mecânica jurídica e os prazos legais de liquidação do split payment ainda dependem de regulamentação infralegal; a leitura aqui é financeira e gerencial.",
  preco:
    "O preço necessário é piso técnico de neutralidade tributária, não recomendação comercial de preço.",
  aluguel:
    "Nos contratos de locação, o redutor aplicável, a rampa de transição e a condição do locador (contribuinte ou não) são premissas editáveis; contratos antigos registrados podem seguir regra específica de transição.",
} as const;

export interface CargaLinhaSnap {
  tipo: string;
  validos: number;
  duplicados: number;
  naoSaoNotas: number;
  ignorados: number;
  manuais: number;
  total: number;
}

export interface PendenciaSnap {
  fluxo: string;
  itens: number;
  valor: number;
}

export interface ConcentracaoSnap {
  codigo: string;
  cnpj: string | null;
  nome: string | null;
  valorBase: number;
  valorApurado: number;
  itens: number;
  pendentes: number;
  /** Regime do fornecedor quando classificado na composição de carteira. */
  regime?: string | null;
}

/** Nota de compra individual de um fornecedor (retrato, sem recálculo). */
export interface FornecedorNotaSnap {
  chave: string | null;
  numero: string | null;
  serie: string | null;
  data: string | null;
  valorTotal: number;
  valorBase: number;
  credito: number;
  itens: number;
  pendentes: number;
}

/** Histórico mensal de compras de um fornecedor. */
export interface FornecedorMesSnap {
  /** Competência AAAA-MM. */
  competencia: string;
  valorBase: number;
  credito: number;
  notas: number;
  /** Participação do fornecedor no total comprado naquele mês (%). */
  participacaoPct: number;
}

export interface FornecedorDetalheSnap {
  chave: string;
  cnpj: string | null;
  nome: string | null;
  regime?: string | null;
  valorBase: number;
  credito: number;
  itens: number;
  pendentes: number;
  notas: FornecedorNotaSnap[];
  meses: FornecedorMesSnap[];
  topNcms: { ncm: string; descricao: string | null; valorBase: number; credito: number }[];
}

export interface Achado {
  titulo: string;
  impacto: string;
  causa: string;
  decisao: string;
}

export interface ContratoAluguelSnap {
  titulo: string;
  contraparte: string | null;
  papel: string;
  regime: string;
  criterio: string;
  ano: number;
  aluguelAtual: number;
  aluguelSugerido: number;
  variacaoAluguelPct: number;
  liquidoAtual: number;
  liquidoSemRepactuacao: number;
  custoAtualLocatario: number;
  custoSemRepactuacao: number;
}

export interface AluguelSnap {
  contratos: ContratoAluguelSnap[];
  totalAtual: number;
  totalSugerido: number;
  variacaoAluguelPct: number;
  liquidoAtual: number;
  liquidoSemRepactuacao: number;
  variacaoLiquidoPct: number;
}

export interface ParecerSnapshot {
  geradoEm: string;
  sec1: {
    cliente: string | null;
    cnpj: string | null;
    regimeAtual: string | null;
    escopo: CaseEscopo;
    objetivo: string | null;
    anoBase: number | null;
  };
  sec2: {
    carga: CargaLinhaSnap[];
    pendencias: PendenciaSnap[];
    despesas: { ano: number; valor: number }[];
    issOrigem: string | null;
    parametros: { label: string; valor: string; atualizadoEm: string | null }[];
    excecoes: { fonte: string; itens: number }[];
    limitacoes: string[];
  };
  sec3: { achados: Achado[] };
  sec4: {
    creditoTotal: number;
    baseTotal: number;
    fornecedores: ConcentracaoSnap[];
    ncms: ConcentracaoSnap[];
    pendentes: number;
    concentracaoTopPct: number | null;
  };
  sec5: {
    valorAtual: number;
    precoNecessario: number;
    variacaoMediaPct: number;
    porPerfil: { perfil: string; valorAtual: number; precoNecessario: number; itens: number }[];
    porAno: { ano: number; precoNecessario: number; variacaoPct: number }[];
  };
  sec6: {
    linhas: {
      ano: number;
      cenario: string;
      receitaBruta: number;
      custo: number;
      lucroBruto: number;
      despesas: number;
      ircs: number | null;
      resultadoLiquido: number | null;
    }[];
  };
  sec7: {
    periodo: { ano: number; mes: number } | null;
    vendasBrutas: number;
    debitoRetido: number;
    creditoDisponivel: number;
    debitoLiquido: number;
    resultadoLiquidoAno: number | null;
    resumoAnual: { ano: number; retido: number; credito: number; liquido: number }[];
  };
  sec8: {
    regimeAtual: string | null;
    anoBase: number | null;
    cenarios: { label: string; total: number | null; rate: number | null; atual: boolean; nota?: string }[];
    resultadoLiquido: number | null;
  };
  /** Submódulo Contratos e Aluguéis (opcional: só existe se houver contrato no Caso). */
  secAluguel?: AluguelSnap;
  sec9: { sugestoes: Record<string, string> };
  sec10: { limitacoes: string[] };
}

export interface PlanoAcaoEdicao {
  acao?: string;
  responsavel?: string;
  prazo?: string;
  prioridade?: string;
  indicador?: string;
}

export interface ParecerEdicoes {
  sec1?: string;
  sec2?: string;
  sec3?: { achados?: Achado[] };
  sec4?: string;
  sec5?: string;
  sec6?: string;
  sec7?: string;
  sec8?: { recomendacao?: string };
  sec9?: Record<string, PlanoAcaoEdicao>;
  sec10?: { sintese?: string; proximaRevisao?: string };
}

export interface ParecerVersao {
  id: string;
  case_id: string;
  versao: number;
  status: ParecerStatus;
  dados: ParecerSnapshot;
  edicoes: ParecerEdicoes;
  gerado_em: string;
  finalizado_em: string | null;
  share_enabled: boolean;
  share_token: string | null;
}


export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  detalhe: string;
  /** Âncora/seção que resolve o item. */
  alvo: string;
}
