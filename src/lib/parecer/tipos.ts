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
  contratos:
    "Nos contratos de prestação continuada, a alíquota plena, a redução setorial, o custo direto e o aproveitamento de crédito do contratante são premissas informadas pelo analista.",
  saldoCredor:
    "O saldo credor de ICMS e de PIS/COFINS vem do último SPED importado no Caso — se houver período mais recente ainda não entregue, o saldo real pode ser outro. O cronograma de 240 parcelas do ICMS, a correção pelo IPCA e o deságio de cessão são estimativas sujeitas à homologação do saldo pela SEFAZ e à regulamentação da EC 132/2023.",
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

/**
 * Fornecedor de serviço tomado (aba "Serviços tomados"): só valor, regime e
 * proveniência. O crédito de IBS/CBS não é guardado aqui — é calculado na
 * tela, ano a ano, pela mesma alíquota de IBS/CBS do motor de regimes
 * (Simples Nacional não gera crédito; os demais, alíquota cheia do ano).
 */
export interface ServicoTomadoSnap {
  cnpj: string | null;
  nome: string | null;
  valorBase: number;
  /** Regime do fornecedor quando classificado na composição de carteira. */
  regime?: string | null;
  /** "xml" = apurado nota a nota (NFS-e); "planilha" = valor informado pela
   * planilha de contas a pagar, sem XML. */
  fonte: "xml" | "planilha";
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
  regime: string | null;
  valorBase: number;
  credito: number;
  itens: number;
  pendentes: number;
  notas: FornecedorNotaSnap[];
  meses: FornecedorMesSnap[];
  topNcms: { ncm: string; descricao: string | null; valorBase: number; credito: number }[];
}

/**
 * Retrato por cliente (vendas e serviços prestados). Mesma estrutura do
 * fornecedor: aqui `credito` é o crédito de IBS/CBS transferido ao cliente,
 * que corresponde ao débito apurado nas notas emitidas para ele.
 */
export type ClienteDetalheSnap = FornecedorDetalheSnap;

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

export interface ContratoReequilibrioSnap {
  titulo: string;
  contraparte: string | null;
  papel: string;
  regime: string;
  perfilContratante: string;
  cenario: string;
  status: string;
  ano: number;
  precoAtual: number;
  precoSugerido: number;
  variacaoPrecoPct: number;
  margemAtual: number;
  margemSemReequilibrio: number;
  custoContratanteAtual: number;
  custoContratanteSugerido: number;
}

export interface ReequilibrioSnap {
  contratos: ContratoReequilibrioSnap[];
  totalAtual: number;
  totalSugerido: number;
  variacaoPrecoPct: number;
  margemAtual: number;
  margemSemReequilibrio: number;
  variacaoMargemPct: number;
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
    /** Detalhamento por fornecedor: notas, histórico mensal e participação. */
    detalhes?: FornecedorDetalheSnap[];
  };
  /** Serviços tomados: junta o que foi apurado por XML de NFS-e com o que
   * foi informado na planilha de contas a pagar, quando não há nota. O
   * crédito (potencial/aproveitado/deixado na mesa) é calculado na tela,
   * ano a ano — não fica guardado aqui. */
  sec4b: {
    baseTotal: number;
    fornecedores: ServicoTomadoSnap[];
  };
  sec5: {
    valorAtual: number;
    precoNecessario: number;
    variacaoMediaPct: number;
    /** Valor líquido (sem os tributos atuais), somado direto dos itens — não derivado da rampa. */
    desonerado: number;
    /** Tributos atuais (PIS/COFINS/ICMS/ISS do item), somado direto dos itens. */
    tributosAtuais: number;
    /** Alíquota plena média aplicada, ponderada pelo valor líquido de cada item. */
    aliquotaPlenaMedia: number;
    porPerfil: { perfil: string; valorAtual: number; precoNecessario: number; itens: number }[];
    porAno: { ano: number; precoNecessario: number; variacaoPct: number }[];
    /** Clientes atendidos: volume vendido e crédito de IBS/CBS transferido. */
    clientes?: ClienteDetalheSnap[];
  };
  sec6: {
    linhas: {
      ano: number;
      cenario: string;
      receitaBruta: number;
      deducoes: number;
      receitaLiquida: number;
      custo: number;
      lucroBruto: number;
      despesas: number;
      resultadoAntesIrcs: number;
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
    cenarios: {
      label: string;
      total: number | null;
      rate: number | null;
      atual: boolean;
      nota?: string;
      /** Abertura por imposto (PIS, COFINS, ISS/ICMS, IBS+CBS, IRPJ, CSLL, CPP)
       * do valor pós-reforma deste regime no ano — base da tabela e das
       * barras empilhadas por imposto da aba Regimes. */
      porImposto?: { categoria: string; valor: number }[];
    }[];
    /** Mesma comparação de regimes, recalculada para cada ano da transição —
     * a aba "Regimes" do relatório reage à esteira de anos usando isto. */
    porAno: {
      ano: number;
      cenarios: {
        label: string;
        total: number | null;
        rate: number | null;
        atual: boolean;
        nota?: string;
        porImposto?: { categoria: string; valor: number }[];
      }[];
    }[];
    /** Comparação "hoje x reforma" do regime atual da empresa — mesmo cálculo
     * do simulador simples (simulate().current / .reform), não uma nova
     * conta: dá o ponto de partida antes de comparar com outros regimes. */
    atualHojeXReforma: { hoje: { total: number; rate: number }; reforma: { total: number; rate: number } } | null;
    /** Mesma comparação acima, recalculada para cada ano da transição. */
    atualHojeXReformaPorAno: {
      ano: number;
      hoje: { total: number; rate: number };
      reforma: { total: number; rate: number };
    }[];
    /** Ponte "hoje x com a reforma" do Lucro Real especificamente (mesmo
     * quando o regime atual da empresa não é o Real), abalizada por imposto
     * — alimenta o gráfico de cascata: de onde sai o custo de hoje (PIS,
     * COFINS, ISS/ICMS), o que entra (IBS+CBS) e o que muda (IRPJ/CSLL/CPP)
     * até chegar no custo com a reforma. Recalculada para cada ano. */
    ponteLucroRealPorAno: {
      ano: number;
      hojeTotal: number;
      reformaTotal: number;
      hoje: { categoria: string; valor: number }[];
      reforma: { categoria: string; valor: number }[];
    }[];
    resultadoLiquido: number | null;
  };
  /** Submódulo Contratos e Aluguéis (opcional: só existe se houver contrato no Caso). */
  secAluguel?: AluguelSnap;
  /** Submódulo Gestão de Contratos e Reequilíbrio (opcional). */
  secContratos?: ReequilibrioSnap;
  /** Submódulo Saldo credor acumulado de ICMS e PIS/COFINS (opcional: só
   * existe se houver SPED importado no Caso). Traz apenas o saldo declarado
   * — o cronograma das 240 parcelas do ICMS e a comparação com cessão a
   * terceiro são recalculados no cliente (src/lib/saldos/calculo.ts), a
   * partir deste saldo e das premissas editáveis em
   * ParecerEdicoes.secSaldoCredor, para reagir sem precisar gerar nova
   * versão. */
  secSaldoCredor?: {
    /** Saldo do SPED mais recente de cada tipo (ICMS-IPI e Contribuições,
     * que podem ter períodos diferentes entre si). */
    saldoIcmsAtual: number;
    saldoPisCofinsAtual: number;
    /** Competência (YYYY-MM) do SPED mais recente de cada tipo. */
    competenciaIcms: string | null;
    competenciaPisCofins: string | null;
    /** Evolução mês a mês dos saldos declarados, ao longo de todos os SPEDs
     * importados no Caso. */
    porPeriodo: { periodo: string; saldoIcms: number | null; saldoPisCofins: number | null }[];
    /** Débito mensal de CBS projetado, aproximado pela fatia CBS_SHARE do
     * débito combinado de IBS+CBS que o fluxo de caixa (Seção 7) já projeta
     * — o motor de cálculo nunca separa CBS de IBS, então isto é uma
     * estimativa, não um valor exato. Alimenta o simulador de consumo do
     * saldo de PIS/COFINS. */
    cbsMensal: { periodo: string; valor: number }[];
  };
  /** Aviso quando o regime de PIS/COFINS declarado no SPED de Contribuições
   * (cumulativo/não-cumulativo) diverge do que a simulação assumiu pelo
   * `taxpayerType` (Presumido → cumulativo, Real → não-cumulativo) — indica
   * possível erro de enquadramento na simulação. Ausente quando não há SPED
   * de Contribuições, quando o regime é misto, ou quando bate. */
  avisoRegimeSped?: string;
  /** Carga por tributo individual (ICMS, IPI, PIS/COFINS, ISS x IBS/CBS),
   * separada em compras e vendas — abre a mesma conta da DRE (Seção 6)
   * imposto a imposto: "depois" usa a mesma fração de transição do ano
   * selecionado, então a soma das linhas bate com a dedução/custo da DRE
   * daquele ano, e não com o regime pleno (2033) fixo. */
  secCargaTributaria: {
    compras: { tributo: string; antes: number; depois: number }[];
    vendas: { tributo: string; antes: number; depois: number }[];
    /** Mesma comparação acima, recalculada para cada ano da transição. */
    porAno: {
      ano: number;
      compras: { tributo: string; antes: number; depois: number }[];
      vendas: { tributo: string; antes: number; depois: number }[];
    }[];
  };
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
  /** Premissas do saldo credor acumulado (cessão a terceiro do ICMS) —
   * editáveis para recalcular sem gerar nova versão. Padrão quando ausente:
   * 30% de deságio, 12% a.a. de custo de oportunidade (mesmos da calculadora
   * standalone de saldos credores). O IPCA não é editável aqui — é o índice
   * fixado pela EC 132/2023 para a correção das parcelas de ICMS. */
  secSaldoCredor?: {
    desagioCessaoPct?: number;
    custoOportunidadeAaPct?: number;
    /** Texto livre do analista para cada uma das três possibilidades de uso
     * do saldo de PIS/COFINS (art. 378 da LC 214/2025) — o sistema não
     * calcula "quando faz sentido" nem "prazo e risco", só lista as opções. */
    pisCofins?: {
      compensacaoCbs?: { quandoFazSentido?: string; prazoRisco?: string };
      outrosTributos?: { quandoFazSentido?: string; prazoRisco?: string };
      ressarcimento?: { quandoFazSentido?: string; prazoRisco?: string };
    };
  };
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
