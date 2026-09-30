/**
 * Minuta oficial: Proposta de Serviços Jurídico-Tributários — Assessoria
 * Tributária Contínua (Reforma Tributária). Reproduz o modelo mestre, já com
 * as alternativas das cláusulas 3 e 5 resolvidas pelos parâmetros.
 */
import { dataCurta, dataLonga, valorComExtenso } from "./extenso";
import type {
  Bloco,
  DadosContratante,
  DadosEscritorio,
  DocumentoContrato,
  ParamsAssessoria,
} from "./tipos";

const vazio = (v: string | null | undefined, alt: string) => (v && v.trim() ? v.trim() : alt);
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function montarPropostaAssessoria(
  esc: DadosEscritorio,
  cli: DadosContratante,
  p: ParamsAssessoria,
): DocumentoContrato {
  const reunioes = plural(p.reunioesMes, "reunião", "reuniões");
  const consultas = plural(p.consultasMes, "consulta", "consultas");
  const horas = plural(p.duracaoReuniaoHoras, "hora", "horas");

  const revisao =
    p.revisaoContratos === "nao"
      ? "Não incluída. Pode ser contratada à parte, por proposta específica ou por hora técnica (cláusula 6)."
      : `Incluída até ${plural(p.revisaoContratosQtd, "contrato", "contratos")} por mês, limitada a modelos-padrão de venda e de locação. O que exceder o limite é contratado à parte.`;
  const pareceres =
    p.pareceres === "nao"
      ? "Não incluídos. As respostas às consultas são orientações objetivas, sem forma de parecer, e pareceres formais são contratados à parte."
      : `Incluídos até ${p.pareceresQtd} por mês, sobre tema previamente acordado. O que exceder o limite é contratado à parte.`;

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
        "Ref.: Proposta de Serviços Jurídico-Tributários – Assessoria Tributária Contínua (Reforma Tributária)",
      negrito: true,
    },
    { tipo: "paragrafo", texto: `Validade da proposta: ${p.validadeDias} dias.` },
    { tipo: "espaco", altura: 10 },
    { tipo: "titulo", texto: "PROPOSTA DE SERVIÇOS JURÍDICO-TRIBUTÁRIOS" },
    { tipo: "subtitulo", texto: "Assessoria Tributária Contínua – Reforma Tributária" },
    {
      tipo: "paragrafo",
      texto: `Prezados, em conformidade com o alinhamento realizado, o escritório ${esc.nome} (CONTRATADA) apresenta esta proposta à empresa acima identificada (CONTRATANTE). Em resumo:`,
    },
    {
      tipo: "tabela",
      titulo: "Resumo da proposta",
      colunas: [0.26, 0.74],
      linhas: [
        [
          "O que é",
          "Assessoria jurídico-tributária preventiva e contínua, para acompanhar a adaptação da CONTRATANTE às regras da Reforma Tributária (CBS e IBS) ao longo da transição. Contratação mensal, sem valor fechado de projeto.",
        ],
        [
          "O que você recebe",
          `${reunioes} por mês, suporte por ${p.canal} com resposta em até ${p.prazoRespostaDiasUteis} dias úteis, informativo ${p.periodicidadeInformativo} e revisão periódica do plano de ação (cláusulas 2 e 3).`,
        ],
        [
          "Vigência",
          `${p.vigenciaMeses} meses, a partir do início dos trabalhos, com renovação automática e saída mediante aviso prévio de ${p.avisoPrevioDias} dias (cláusula 4).`,
        ],
        ["Investimento", `${valorComExtenso(p.mensalidade)} por mês, conforme a cláusula 6.`],
        [
          "O que não inclui",
          "Implementação das medidas, apuração e escrituração fiscal, contencioso, auditoria e o que exceder os limites de atendimento (cláusulas 3 e 5).",
        ],
        [
          "Próximo passo",
          "Assinatura eletrônica do Termo de Aceite e pagamento da primeira mensalidade.",
        ],
      ],
    },
    { tipo: "clausula", texto: "1. DO OBJETO" },
    {
      tipo: "paragrafo",
      texto:
        `A presente proposta tem por objeto a prestação de assessoria jurídica tributária contínua, de caráter preventivo e estratégico, para acompanhar a implementação da Reforma Tributária ` +
        `(Emenda Constitucional nº 132/2023, Lei Complementar nº 214/2025 e normas regulamentares) nas atividades de ` +
        `${vazio(cli.atividade, "[ATIVIDADE DA CONTRATANTE]")}, incluindo ${vazio(cli.operacoes, "[OPERAÇÕES PRINCIPAIS]")}, ` +
        `realizadas pela CONTRATANTE, a partir das informações e documentos por ela fornecidos.`,
    },
    { tipo: "clausula", texto: "2. DO ESCOPO" },
    {
      tipo: "paragrafo",
      texto:
        "A assessoria compreende as frentes abaixo, dentro dos limites indicados. Somente integram o objeto as frentes aqui descritas.",
    },
    {
      tipo: "tabela",
      cabecalho: ["Frente", "O que inclui", "Limite"],
      colunas: [0.22, 0.53, 0.25],
      linhas: [
        [
          "Acompanhamento da implementação",
          "Acompanhamento periódico da adaptação da CONTRATANTE às novas regras; análise dos impactos tributários e definição, em conjunto, das medidas necessárias; orientação jurídico-tributária sobre as obrigações decorrentes da Reforma e sobre a geração e o aproveitamento de créditos de CBS e IBS, quando aplicáveis; avaliação dos efeitos sobre preços, margens e fluxo financeiro, com recomendações de ajuste.",
          `${reunioes} por mês, de até ${horas}, não cumulativas.`,
        ],
        [
          "Atualização e adequação",
          "Monitoramento da legislação, regulamentação e atos normativos da Reforma Tributária; comunicação das mudanças que afetem a atividade da CONTRATANTE e das adequações recomendadas; revisão do plano de ação e das diretrizes de precificação e de repasse da carga tributária.",
          `Informativo ${p.periodicidadeInformativo}. Revisão do plano ${p.periodicidadePlano} ou em marco legislativo relevante.`,
        ],
        [
          "Orientação técnica contínua",
          "Esclarecimento de consultas sobre a interpretação e a aplicação da legislação da Reforma Tributária aos fatos e operações da CONTRATANTE, e apoio à tomada de decisões.",
          `Até ${consultas} por mês, por ${p.canal}.`,
        ],
        [
          "Conformidade dos processos",
          "Apontamento, com base nos documentos e informações fornecidos, dos pontos dos processos internos que mereçam ajuste diante do novo regime tributário.",
          "Sem auditoria. Limitado aos documentos fornecidos.",
        ],
      ],
    },
    { tipo: "clausula", texto: "3. DAS ENTREGAS E DO ATENDIMENTO" },
    {
      tipo: "tabela",
      cabecalho: ["Entrega", "Descrição", "Periodicidade / limite"],
      colunas: [0.24, 0.51, 0.25],
      linhas: [
        [
          "Reuniões de acompanhamento",
          "Reuniões por videoconferência com o time do escritório, para alinhamento, esclarecimento de dúvidas e definição de medidas.",
          `${p.reunioesMes} por mês. Não cumulativas.`,
        ],
        [
          "Suporte a consultas",
          `Respostas objetivas às consultas da CONTRATANTE dentro do objeto, por ${p.canal}, em dias úteis, das ${p.horarioAtendimento}.`,
          `Resposta em até ${p.prazoRespostaDiasUteis} dias úteis. Até ${consultas} por mês.`,
        ],
        [
          "Informativo legislativo",
          "Resumo das alterações legislativas e regulamentares relevantes para a atividade da CONTRATANTE, com as providências recomendadas.",
          p.periodicidadeInformativo,
        ],
        [
          "Revisão do plano de ação",
          "Atualização das recomendações e do plano de ação à luz da evolução da regulamentação.",
          p.periodicidadePlano,
        ],
      ],
    },
    {
      tipo: "tabela",
      titulo: "Contratos e pareceres",
      colunas: [0.26, 0.74],
      linhas: [
        ["Revisão de contratos", revisao],
        ["Pareceres jurídicos formais", pareceres],
      ],
    },
    {
      tipo: "tabela",
      titulo: "Natureza do trabalho",
      colunas: [0.26, 0.74],
      linhas: [
        [
          "Obrigação de meio",
          "A obrigação da CONTRATADA é de meio, e não de resultado, e não há garantia de economia tributária.",
        ],
        [
          "Base das orientações",
          "As orientações baseiam-se nos dados e documentos fornecidos e na legislação vigente na data em que são emitidas. Mudanças legislativas ou de entendimento posteriores podem exigir novas orientações.",
        ],
        [
          "Decisão da CONTRATANTE",
          "A decisão sobre adotar as medidas recomendadas, inclusive sobre preços e contratos, é da CONTRATANTE.",
        ],
        ["Uso interno", "As orientações e informativos são de uso interno da CONTRATANTE."],
      ],
    },
    { tipo: "clausula", texto: "4. DA VIGÊNCIA E DA CONTRATANTE" },
    {
      tipo: "tabela",
      titulo: "Vigência e condições",
      colunas: [0.26, 0.74],
      linhas: [
        [
          "Início",
          `Na data em que a CONTRATADA confirma, por escrito, o pagamento da primeira mensalidade e o recebimento dos documentos iniciais. Ponto de partida dos trabalhos: ${
            p.pontoPartida === "diagnostico"
              ? "Relatório de Diagnóstico já entregue à CONTRATANTE"
              : "levantamento inicial das operações, realizado no primeiro mês"
          }.`,
        ],
        [
          "Vigência",
          `${p.vigenciaMeses} meses, renovada automaticamente por iguais períodos, salvo aviso em contrário.`,
        ],
        [
          "Saída",
          `Qualquer das partes pode encerrar o contrato mediante aviso prévio escrito de ${p.avisoPrevioDias} dias. Os honorários são devidos até o fim do aviso prévio.`,
        ],
        [
          "Dados da CONTRATANTE",
          `A CONTRATANTE fornece, de forma completa e tempestiva, os documentos e informações necessários (${p.documentosMensais}, até o dia ${p.diaEnvioDocumentos} de cada mês), indica um responsável nominal e responde pela veracidade dos dados. A CONTRATADA não realiza auditoria contábil ou fiscal deles.`,
        ],
        [
          "Suspensão",
          "Os prazos de resposta ficam suspensos enquanto houver pendência atribuível à CONTRATANTE. A inadimplência por mais de 30 dias autoriza a suspensão dos serviços até a regularização.",
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
          "Implementação operacional das medidas recomendadas (ajuste de sistemas, cadastros, rotinas e contratos)",
          "Execução pela equipe da CONTRATANTE ou de seus fornecedores, ou assessoria de implementação por proposta específica.",
        ],
        [
          "Apuração, escrituração, cumprimento ou retificação de obrigações tributárias",
          "Contabilidade da CONTRATANTE. A CONTRATADA orienta apenas o aspecto jurídico-tributário.",
        ],
        [
          "Contencioso administrativo ou judicial e consultas a autoridades",
          "Contratação específica.",
        ],
        ["Auditoria contábil ou fiscal", "Fora da atuação da CONTRATADA neste contrato."],
        [
          "Elaboração ou revisão de contratos e pareceres formais, salvo o previsto na cláusula 3",
          "Proposta específica ou hora técnica.",
        ],
        [
          "Assuntos fora do objeto (societário, trabalhista, civil e outros)",
          "Proposta específica.",
        ],
        [
          "Reuniões, consultas e demandas que excedam os limites da cláusula 3",
          "Hora técnica, com aprovação prévia (cláusula 6).",
        ],
      ],
    },
    { tipo: "clausula", texto: "6. DOS HONORÁRIOS" },
    {
      tipo: "tabela",
      titulo: "Honorários e pagamento",
      colunas: [0.26, 0.74],
      linhas: [
        ["Mensalidade", `${valorComExtenso(p.mensalidade)} por mês.`],
        [
          "Vencimento",
          `Todo dia ${p.diaVencimento} de cada mês, sendo a primeira mensalidade paga no aceite${
            p.primeiraMensalidadeData ? `, até ${dataCurta(p.primeiraMensalidadeData)}` : ""
          }. O início dos trabalhos fica condicionado à confirmação desse pagamento.`,
        ],
        ["Forma de pagamento", p.formaPagamento],
        ["Reajuste", `A cada 12 (doze) meses, pela variação do ${p.reajusteIndice} no período.`],
        [
          "Hora técnica",
          `${valorComExtenso(p.horaTecnica)} por hora de advogado, para o que exceder os limites da cláusula 3 ou não estiver incluído, sempre com aprovação prévia escrita da CONTRATANTE, com relatório das horas, e paga até o dia 5 do mês seguinte.`,
        ],
        [
          "Atraso",
          "Multa de 2%, juros de 1% ao mês e correção pelo IPCA, sem prejuízo da suspensão prevista na cláusula 4.",
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
        "7.3 A proposta é aceita mediante assinatura eletrônica do Termo de Aceite, dentro da validade, e constitui, por si só, o contrato escrito de prestação de serviços e honorários (art. 48 do Código de Ética e Disciplina da OAB e art. 24 da Lei nº 8.906/1994), sem necessidade de outro instrumento.",
    },
    { tipo: "espaco", altura: 10 },
    { tipo: "paragrafo", texto: "Atenciosamente," },
    { tipo: "linhaAssinatura", nome: esc.nome, detalhe: `${esc.advogadoNome} | ${esc.oab}` },
    { tipo: "quebra" },
    { tipo: "titulo", texto: "TERMO DE ACEITE DA PROPOSTA" },
    {
      tipo: "paragrafo",
      texto:
        `Pelo presente, a CONTRATANTE identificada abaixo aceita a Proposta de Serviços Jurídico-Tributários – Assessoria Tributária Contínua (Reforma Tributária), ` +
        `contratando os serviços do escritório ${esc.nome}, sociedade de advogados inscrita no CNPJ/MF sob o nº ${esc.cnpj}, com sede na ${esc.endereco}, ` +
        `neste ato representada por seu sócio, Dr. ${esc.advogadoNome}, brasileiro, casado, advogado, inscrito na ${esc.oab}, CPF nº ${esc.cpfAdvogado}, e-mail ${esc.email}.`,
    },
    {
      tipo: "paragrafo",
      texto:
        "A CONTRATANTE declara que recebeu, leu e concorda com todos os termos da proposta, autorizando o início dos trabalhos após a confirmação do pagamento da primeira mensalidade.",
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

  const nomeArquivo = `Proposta-Assessoria-Continua-${(cli.razaoSocial || "Contratante")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, 40)}.pdf`;

  return {
    kind: "assessoria",
    titulo:
      "Proposta de Serviços Jurídico-Tributários – Assessoria Tributária Contínua (Reforma Tributária)",
    arquivo: nomeArquivo,
    blocos,
  };
}
