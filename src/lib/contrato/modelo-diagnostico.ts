/**
 * Minuta oficial: Proposta de Serviços de Assessoria Tributária — Diagnóstico
 * da Reforma Tributária. Reproduz o modelo mestre da RCB Inteligência
 * Tributária, com o Anexo I modular (Parte A comum + apenas os blocos da
 * Parte B do segmento).
 */
import { dataCurta, dataLonga, moeda, valorComExtenso } from "./extenso";
import {
  type Bloco,
  type DadosContratante,
  type DadosEscritorio,
  type DocumentoContrato,
  type ParamsDiagnostico,
  type Segmento,
} from "./tipos";

const vazio = (v: string | null | undefined, alternativa: string) =>
  v && v.trim() ? v.trim() : alternativa;

function termoDeAceite(esc: DadosEscritorio, cli: DadosContratante): Bloco[] {
  return [
    { tipo: "quebra" },
    { tipo: "titulo", texto: "TERMO DE ACEITE DA PROPOSTA" },
    {
      tipo: "paragrafo",
      texto:
        `Pelo presente, a CONTRATANTE identificada abaixo aceita a Proposta de Serviços de Assessoria Tributária – ` +
        `Diagnóstico da Reforma Tributária, com o Anexo I, contratando os serviços da ${esc.nome}, pessoa jurídica ` +
        `inscrita no CNPJ sob o nº ${esc.cnpj}, sediada em ${esc.endereco}, neste ato representada por seu sócio, ` +
        `${esc.advogadoNome}, brasileiro, casado, advogado, inscrito no CPF/MF sob o nº ${esc.cpfAdvogado}, ` +
        `residente e domiciliado em ${esc.foro}.`,
    },
    {
      tipo: "paragrafo",
      texto:
        "A CONTRATANTE declara que recebeu, leu e concorda com todos os termos da proposta, autorizando o início dos trabalhos após a confirmação do pagamento da primeira parcela.",
    },
    { tipo: "subtitulo", texto: "CONTRATANTE" },
    {
      tipo: "tabela",
      colunas: [0.28, 0.72],
      linhas: [
        ["Razão social", vazio(cli.razaoSocial, "__________________________________")],
        ["CNPJ", vazio(cli.cnpj, "__________________________________")],
        ["Representante legal", vazio(cli.representante, "__________________________________")],
        ["CPF", vazio(cli.cpf, "__________________________________")],
        ["Endereço", vazio(cli.endereco, "__________________________________")],
        ["E-mail", vazio(cli.email, "__________________________________")],
        ["Data", "____ / ____ / ________"],
        ["Assinatura eletrônica", ""],
      ],
    },
  ];
}

const PARTE_A: string[][] = [
  [
    "A.1 Diagnóstico tributário",
    "Regime atual, tributos incidentes, base de cálculo e alíquotas, principais operações, estabelecimentos e unidades federativas.",
    "Regime atual; extrato do PGDAS-D (Simples) ou EFD-Fiscal e EFD-Contribuições (Presumido e Real); relação de estabelecimentos e UFs.",
    "Quadro da situação tributária atual e da carga atual.",
  ],
  [
    "A.2 CBS e IBS e transição",
    "Incidência estimada de CBS e IBS, regimes específicos, reduções e regras de crédito; comparação entre a carga atual e a projetada; efeitos do período de transição.",
    "XMLs de NF-e, NFC-e, NFS-e e CT-e de entrada e saída do período.",
    "Comparativo entre o modelo atual e o novo, por tipo de operação e por ano.",
  ],
  [
    "A.3 Comparação de regimes",
    "Simples Nacional, Lucro Presumido e Lucro Real, inclusive a opção pelo regime regular de IBS/CBS pelos optantes do Simples; elegibilidade e efeitos da eventual mudança.",
    "Folha anual, encargos e pró-labore; custos e despesas; RBT12 e anexo (Simples); balancete apenas para suprir lacunas.",
    "Quadro comparativo dos regimes e recomendação técnica, com as premissas adotadas.",
  ],
  [
    "A.4 Preço, margem e caixa",
    "Efeito estimado sobre preços de venda e custos, margem, resultado e fluxo de caixa, inclusive o recolhimento segregado (split payment).",
    "Despesas operacionais anuais e prazos médios de recebimento e pagamento.",
    "Preço necessário para preservar o resultado (referência, e não recomendação de preço), resultado projetado e fluxo de caixa.",
  ],
  [
    "A.5 Créditos, fornecedores e clientes",
    "Créditos de CBS e IBS por fornecedor, fornecedores de maior efeito, e perfil tributário dos clientes (regime regular ou Simples).",
    "XMLs de entrada e saída; relação de serviços tomados; regime dos principais clientes.",
    "Fornecedores críticos, de atenção e de oportunidade, e perfil da carteira de clientes.",
  ],
  [
    "A.6 Riscos e plano de ação",
    "Riscos e oportunidades das frentes anteriores e pontos de contratos com clientes e fornecedores que merecem revisão (sem elaboração ou revisão).",
    "Responsável nominal e canal único para a troca de documentos.",
    "Três principais achados e plano de ação por área (compras, vendas, fiscal, financeiro, jurídico, pessoal, dados e governança).",
  ],
];

const PARTE_B: Record<Segmento, { titulo: string; linhas: string[][] }> = {
  comercio: {
    titulo: "B.1 Comércio e distribuição",
    linhas: [
      [
        "B.1.1 Classificação fiscal (NCM)",
        "NCM dos produtos comercializados e seus reflexos (alíquotas, reduções e regimes específicos).",
        "Cadastro de produtos com NCM; XML de saída ou planilha com NCM quando as NFC-e não a trouxerem.",
        "Produtos com classificação a revisar e reflexo tributário. Não inclui laudo de classificação.",
      ],
      [
        "B.1.2 Estoque e crédito de CBS",
        "Estimativa do crédito de CBS sobre o estoque existente.",
        "Inventário completo, atualizado e escriturado, levantado pela CONTRATANTE.",
        "Estimativa de crédito sobre o estoque. Sem o inventário, a frente não é realizada.",
      ],
      [
        "B.1.3 Operações por estabelecimento e UF",
        "Efeito do princípio do destino sobre as vendas por unidade federativa e por estabelecimento.",
        "Relação de estabelecimentos e UFs de destino (extraída dos XMLs de saída).",
        "Efeito por UF e por estabelecimento.",
      ],
    ],
  },
  servicos: {
    titulo: "B.2 Prestação de serviços",
    linhas: [
      [
        "B.2.1 Classificação dos serviços (NBS)",
        "Enquadramento (NBS) dos serviços prestados e seus reflexos (alíquotas, reduções e regimes específicos).",
        "Relação dos serviços prestados com NBS e código de serviço; NFS-e emitidas.",
        "Serviços com tratamento diferenciado e reflexo tributário.",
      ],
      [
        "B.2.2 Serviços tomados e folha",
        "Créditos sobre serviços contratados de terceiros e efeito da folha de pagamento, que em regra não gera crédito.",
        "Relação ou XMLs de serviços tomados; folha anual e encargos.",
        "Estimativa de crédito e efeito da folha sobre o resultado.",
      ],
      [
        "B.2.3 Clientes e repasse",
        "Capacidade de repasse conforme o perfil dos clientes (empresas ou consumidores finais; regime dos clientes).",
        "Principais clientes e regime tributário de cada um, quando conhecido.",
        "Exposição por perfil de cliente.",
      ],
      [
        "B.2.4 ISS e transição",
        "Alíquotas de ISS praticadas e transição do ISS para o IBS.",
        "Municípios de prestação e alíquotas de ISS praticadas.",
        "Efeito da transição do ISS.",
      ],
    ],
  },
  imobiliario: {
    titulo: "B.3 Imobiliário (venda e locação de imóveis)",
    linhas: [
      [
        "B.3.1 Regimes específicos do setor",
        "Enquadramento das operações de venda, locação, cessão e administração de imóveis nas alíquotas reduzidas e nos regimes específicos.",
        "Relação de imóveis e operações por modalidade; contratos-modelo de venda e de locação.",
        "Tratamento tributário por modalidade de operação.",
      ],
      [
        "B.3.2 Locações e operações sem nota",
        "Carga tributária das locações, cujo histórico é lançado manualmente.",
        "Relação de contratos de locação, com valores, prazos e características, informada pela CONTRATANTE.",
        "Carga por locação e pontos dos contratos de locação que merecem revisão (sem revisão).",
      ],
      [
        "B.3.3 Fornecedores do setor",
        "Créditos sobre incorporadoras, construtoras, prestadores de serviços de construção, corretores, administradoras e condomínios.",
        "Notas de entrada e relação de serviços tomados.",
        "Fornecedores de maior efeito sobre o crédito.",
      ],
      [
        "B.3.4 Preço de venda e valor de locação",
        "Efeito estimado sobre o preço de venda dos imóveis e sobre o valor dos aluguéis.",
        "Tabela de preços de venda e valores de locação.",
        "Preço e aluguel necessários para preservar o resultado (referência, e não recomendação).",
      ],
    ],
  },
};

const CABECALHO_ANEXO = [
  "Frente",
  "O que será analisado",
  "O que a CONTRATANTE fornece",
  "O que aparece no Relatório",
];
const COLUNAS_ANEXO = [0.2, 0.3, 0.27, 0.23];

export function montarPropostaDiagnostico(
  esc: DadosEscritorio,
  cli: DadosContratante,
  p: ParamsDiagnostico,
): DocumentoContrato {
  const entrada = (p.valorTotal * p.entradaPct) / 100;
  const saldo = p.valorTotal - entrada;
  const saldoPct = 100 - p.entradaPct;
  const segmentos = p.segmentos.length ? p.segmentos : (["comercio"] as Segmento[]);

  const blocos: Bloco[] = [
    { tipo: "paragrafo", texto: `${p.local}, ${dataLonga(p.data)}.`, alinhamento: "direita" },
    { tipo: "espaco", altura: 8 },
    { tipo: "paragrafo", texto: "Ao" },
    {
      tipo: "paragrafo",
      texto: `SR./SRA. ${vazio(cli.representante, "[NOME DO REPRESENTANTE]").toUpperCase()}`,
      negrito: true,
    },
    {
      tipo: "paragrafo",
      texto: vazio(cli.razaoSocial, "[RAZÃO SOCIAL DA CONTRATANTE]").toUpperCase(),
      negrito: true,
    },
    { tipo: "espaco", altura: 8 },
    {
      tipo: "paragrafo",
      texto:
        "Ref.: Proposta de Serviços de Assessoria Tributária – Diagnóstico da Reforma Tributária",
      negrito: true,
    },
    {
      tipo: "paragrafo",
      texto: `Validade da proposta: ${p.validadeDias} (${p.validadeDias === 30 ? "trinta" : String(p.validadeDias)}) dias.`,
    },
    { tipo: "espaco", altura: 10 },
    { tipo: "titulo", texto: "PROPOSTA DE SERVIÇOS DE ASSESSORIA TRIBUTÁRIA" },
    { tipo: "subtitulo", texto: "Diagnóstico da Reforma Tributária" },
    {
      tipo: "paragrafo",
      texto: `Prezados, em conformidade com o alinhamento realizado, a ${esc.nome} (CONTRATADA) apresenta esta proposta à empresa acima identificada (CONTRATANTE). Em resumo:`,
    },
    {
      tipo: "tabela",
      titulo: "Resumo da proposta",
      colunas: [0.26, 0.74],
      linhas: [
        [
          "O que é",
          "Análise tributária dos impactos da Reforma Tributária (CBS e IBS) sobre a atividade da CONTRATANTE, com comparação de regimes tributários, simulações e plano de ação. Projeto fechado, com início e fim.",
        ],
        [
          "O que você recebe",
          "Relatório de Diagnóstico e Plano de Ação e uma reunião de apresentação, com 15 dias para esclarecer dúvidas depois dela.",
        ],
        [
          "Prazo",
          `Até ${p.prazoDias} dias, contados da confirmação escrita do escritório de que os documentos do Anexo I foram recebidos.`,
        ],
        ["Investimento", `${valorComExtenso(p.valorTotal)}, conforme a cláusula 6.`],
        [
          "O que não inclui",
          "Assessoria continuada, implementação das medidas, contencioso, auditoria e elaboração ou revisão de contratos (cláusula 5).",
        ],
        [
          "Próximo passo",
          "Assinatura eletrônica do Termo de Aceite e envio dos documentos solicitados.",
        ],
      ],
    },
    { tipo: "clausula", texto: "1. DO OBJETO" },
    {
      tipo: "paragrafo",
      texto:
        `A presente proposta tem por objeto a prestação de serviços de assessoria tributária especializada, com apoio ` +
        `de tecnologia e análise de dados, para análise dos impactos da Reforma Tributária ` +
        `(Emenda Constitucional nº 132/2023, Lei Complementar nº 214/2025 e normas regulamentares) sobre as atividades de ` +
        `${vazio(cli.atividade, "[ATIVIDADE DA CONTRATANTE]")}, incluindo ${vazio(cli.operacoes, "[OPERAÇÕES PRINCIPAIS]")}, ` +
        `realizadas pela CONTRATANTE, a partir das informações e documentos por ela fornecidos.`,
    },
    { tipo: "clausula", texto: "2. DO ESCOPO" },
    {
      tipo: "paragrafo",
      texto:
        "Os trabalhos compreendem as frentes abaixo. O detalhamento de cada uma, com o que será analisado, o que a CONTRATANTE fornece e o que aparece no Relatório, consta do Anexo I, definido para o segmento da CONTRATANTE. Somente integram o objeto as frentes ali descritas.",
    },
    {
      tipo: "tabela",
      cabecalho: ["Frente", "Em resumo"],
      colunas: [0.3, 0.7],
      linhas: [
        [
          "Diagnóstico tributário",
          "Situação tributária atual e principais operações da CONTRATANTE.",
        ],
        [
          "CBS e IBS e transição",
          "Incidência estimada, regimes específicos, reduções e créditos, com comparação entre a carga atual e a projetada.",
        ],
        [
          "Comparação de regimes",
          "Simples Nacional, Lucro Presumido e Lucro Real, inclusive a opção pelo regime regular de IBS/CBS pelos optantes do Simples, com recomendação técnica fundamentada nas premissas e nos dados fornecidos.",
        ],
        [
          "Preço, margem e caixa",
          "Efeitos estimados sobre preços, custos, margens e fluxo de caixa.",
        ],
        [
          "Créditos, fornecedores e clientes",
          "Créditos de CBS e IBS e perfil tributário de fornecedores e clientes, quando os documentos permitirem.",
        ],
        [
          "Riscos e plano de ação",
          "Riscos, oportunidades e plano de ação por área da CONTRATANTE.",
        ],
        [
          "Frentes do segmento",
          "Análises específicas da atividade da CONTRATANTE (Anexo I, Parte B).",
        ],
      ],
    },
    { tipo: "clausula", texto: "3. DAS ENTREGAS" },
    {
      tipo: "tabela",
      cabecalho: ["Entrega", "Descrição", "Quando"],
      colunas: [0.26, 0.5, 0.24],
      linhas: [
        [
          "Relatório de Diagnóstico e Plano de Ação",
          "Premissas, resultados, simulações, comparação de regimes, riscos e plano de ação por área.",
          `Até ${p.prazoDias} dias do Marco Zero`,
        ],
        [
          "Reunião de apresentação",
          "Apresentação dos resultados aos responsáveis da CONTRATANTE, por videoconferência.",
          "Após a entrega do Relatório",
        ],
        [
          "Esclarecimento de dúvidas",
          "Dúvidas sobre o Relatório, por e-mail. Encerra o projeto.",
          "15 dias após a reunião",
        ],
      ],
    },
    {
      tipo: "tabela",
      titulo: "Natureza do trabalho",
      colunas: [0.26, 0.74],
      linhas: [
        ["Obrigação de meio", "A obrigação da CONTRATADA é de meio, e não de resultado."],
        [
          "Estimativas",
          "As simulações são estimativas baseadas nos dados fornecidos e na legislação vigente na data-base indicada no Relatório, sem garantia de resultado ou de economia tributária. Alterações legislativas posteriores à data-base não obrigam a refazer o Relatório.",
        ],
        ["Uso do Relatório", "Uso interno da CONTRATANTE. Não constitui parecer formal."],
      ],
    },
    { tipo: "clausula", texto: "4. DO PRAZO E DA CONTRATANTE" },
    {
      tipo: "tabela",
      cabecalho: ["Etapa", "O que acontece", "Responsável"],
      colunas: [0.26, 0.5, 0.24],
      linhas: [
        [
          "1. Levantamento e validação dos dados",
          "A CONTRATANTE envia os documentos do Anexo I, e a CONTRATADA confere e confirma o recebimento por escrito (Marco Zero).",
          "CONTRATANTE e CONTRATADA",
        ],
        [
          "2. Análise e simulações",
          "Aplicação da metodologia e das simulações.",
          "CONTRATADA",
        ],
        [
          "3. Relatório e plano de ação",
          "Consolidação dos resultados e das recomendações.",
          "CONTRATADA",
        ],
        [
          "4. Apresentação",
          "Reunião de apresentação e esclarecimento de dúvidas.",
          "CONTRATADA e CONTRATANTE",
        ],
      ],
    },
    {
      tipo: "tabela",
      titulo: "Condições do prazo",
      colunas: [0.26, 0.74],
      linhas: [
        [
          "Marco Zero",
          `O prazo de até ${p.prazoDias} (sessenta) dias conta desta data: aquela em que a CONTRATADA confirma, por escrito, o recebimento completo dos documentos e informações do Anexo I e o pagamento da primeira parcela.`,
        ],
        [
          "Suspensão",
          "O prazo fica suspenso enquanto houver pendência atribuível à CONTRATANTE.",
        ],
        [
          "Dados da CONTRATANTE",
          "A CONTRATANTE fornece os documentos de forma completa e tempestiva, indica um responsável nominal e responde pela veracidade dos dados. A CONTRATADA não realiza auditoria contábil ou fiscal deles.",
        ],
      ],
    },
    { tipo: "clausula", texto: "5. DOS SERVIÇOS NÃO INCLUÍDOS" },
    {
      tipo: "tabela",
      cabecalho: ["Não está incluído", "Como pode ser tratado"],
      colunas: [0.45, 0.55],
      linhas: [
        [
          "Assessoria ou consultoria tributária continuada e monitoramento legislativo",
          "Assessoria de implementação, de contratação opcional, por proposta própria.",
        ],
        ["Implementação operacional das medidas recomendadas", "Proposta específica."],
        [
          "Cumprimento ou retificação de obrigações tributárias",
          "Contabilidade da CONTRATANTE, ou proposta específica.",
        ],
        [
          "Contencioso administrativo ou judicial e consultas a autoridades",
          "Contratação específica, com profissional habilitado.",
        ],
        ["Auditoria contábil ou fiscal", "Fora da atuação da CONTRATADA neste projeto."],
        [
          "Elaboração ou revisão de contratos",
          "Proposta específica. O Relatório apenas aponta os pontos que merecem revisão.",
        ],
        ["Pareceres técnicos formais avulsos", "Proposta específica."],
        ["Definição da política de preços", "Decisão da CONTRATANTE, com base no Relatório."],
      ],
    },
    { tipo: "clausula", texto: "6. DA REMUNERAÇÃO" },
    {
      tipo: "tabela",
      titulo: "Remuneração e pagamento",
      colunas: [0.26, 0.74],
      linhas: [
        ["Valor total", valorComExtenso(p.valorTotal)],
        [
          "Entrada",
          `${p.entradaPct}% (${moeda(entrada)}) no aceite${p.entradaData ? `, até ${dataCurta(p.entradaData)}` : ""}. O início dos trabalhos fica condicionado à confirmação do pagamento.`,
        ],
        ["Saldo", `${saldoPct}% (${moeda(saldo)}) na entrega do Relatório.`],
        ["Forma de pagamento", p.formaPagamento],
        [
          "Atraso",
          "Multa de 2%, juros de 1% ao mês e correção pelo IPCA. A CONTRATADA poderá suspender os trabalhos e o prazo até a regularização.",
        ],
        [
          "Despesas",
          "As reuniões são virtuais. Despesas extraordinárias (deslocamentos, custas, serviços de terceiros) não estão incluídas e só serão realizadas com prévia aprovação escrita da CONTRATANTE.",
        ],
      ],
    },
    { tipo: "clausula", texto: "7. DAS DISPOSIÇÕES FINAIS" },
    {
      tipo: "paragrafo",
      texto:
        "7.1 As partes manterão sigilo sobre as informações e documentos a que tiverem acesso, durante e após a contratação, salvo obrigação legal, e os dados pessoais contidos nos documentos serão tratados somente para a execução do objeto, nos termos da Lei nº 13.709/2018 (LGPD).",
    },
    { tipo: "paragrafo", texto: `7.2 Fica eleito o foro da Comarca de ${esc.foro}.` },
    {
      tipo: "paragrafo",
      texto:
        "7.3 A proposta é aceita mediante assinatura eletrônica do Termo de Aceite, dentro da validade, e constitui, por si só, o contrato escrito de prestação de serviços e remuneração, com base na liberdade de forma dos contratos (arts. 107 e 425 do Código Civil) e na validade jurídica da assinatura eletrônica (Lei nº 14.063/2020), sem necessidade de outro instrumento. O Anexo I integra a proposta.",
    },
    { tipo: "espaco", altura: 10 },
    { tipo: "paragrafo", texto: "Atenciosamente," },
    {
      tipo: "linhaAssinatura",
      nome: esc.nome,
      detalhe: esc.oab
        ? `${esc.advogadoNome} | Sócio | ${esc.oab} | CPF nº ${esc.cpfAdvogado}`
        : `${esc.advogadoNome} | Sócio | CPF nº ${esc.cpfAdvogado}`,
    },
    ...termoDeAceite(esc, cli),
    { tipo: "quebra" },
    { tipo: "titulo", texto: "ANEXO I – ESCOPO DETALHADO" },
    {
      tipo: "paragrafo",
      texto: "A Parte A vale para todos os projetos. A Parte B corresponde ao segmento da CONTRATANTE.",
    },
    { tipo: "subtitulo", texto: "PARTE A – Frentes comuns a todos os segmentos" },
    { tipo: "tabela", cabecalho: CABECALHO_ANEXO, colunas: COLUNAS_ANEXO, linhas: PARTE_A },
    { tipo: "subtitulo", texto: "PARTE B – Frentes do segmento" },
  ];

  for (const seg of segmentos) {
    const bloco = PARTE_B[seg];
    blocos.push({ tipo: "paragrafo", texto: bloco.titulo, negrito: true });
    blocos.push({
      tipo: "tabela",
      cabecalho: CABECALHO_ANEXO,
      colunas: COLUNAS_ANEXO,
      linhas: bloco.linhas,
    });
  }

  blocos.push({
    tipo: "paragrafo",
    texto:
      "As frentes só são realizadas quando o dado indicado é fornecido, e a ausência é registrada no Relatório. Os arquivos originais recebidos são preservados, e o trabalho é feito em cópia.",
  });

  const nomeArquivo = `Proposta-Diagnostico-${(cli.razaoSocial || "Contratante")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, 40)}.pdf`;

  return {
    kind: "diagnostico",
    titulo: "Proposta de Serviços de Assessoria Tributária – Diagnóstico da Reforma Tributária",
    arquivo: nomeArquivo,
    blocos,
  };
}
