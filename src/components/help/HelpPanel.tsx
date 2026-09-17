import { useEffect, useMemo, useState } from "react";

type Section = {
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: string[];
  faq?: { q: string; a: string }[];
};

const SECTIONS: Section[] = [
  {
    id: "visao-geral",
    title: "Visão geral",
    paragraphs: [
      "O Reforma Fácil é a calculadora de impacto da Reforma Tributária (IBS/CBS) usada como ferramenta de demonstração em reuniões com o cliente — não é o diagnóstico completo. O objetivo é, em poucos minutos, mostrar de forma visual como a carga tributária do cliente muda com a reforma, gerando confiança suficiente para avançar para a próxima etapa comercial: a assinatura do Memorando de Entendimento e Confidencialidade, que dá início ao diagnóstico completo — feito depois do recebimento dos documentos da empresa.",
    ],
  },
  {
    id: "passo-a-passo",
    title: "Passo a passo — como fazer uma simulação completa",
    steps: [
      'Etapa 1 — Identificação do cliente: informe o CNPJ da empresa, ou clique em "Pular e preencher manualmente" se não tiver o CNPJ em mãos. Se o CNPJ for informado, o sistema busca automaticamente razão social, CNAE e demais dados públicos, e sugere a Atividade principal com base no CNAE — essa sugestão pode ser alterada e nunca é definitiva.',
      "Etapa 2 — Atividade e regime: confirme (ou ajuste) a Atividade principal e informe o regime tributário atual (Simples Nacional, Lucro Presumido, Lucro Real, MEI ou Pessoa Física). Dependendo da Atividade escolhida, pode aparecer uma etapa extra perguntando se a empresa tem registro em conselho profissional — isso segue o Art. 127 da LC 214/2025 e é sempre uma resposta manual, nunca preenchida a partir do CNAE.",
      'Etapas seguintes — Faturamento e dados financeiros: informe faturamento, despesas e demais dados pedidos para o cálculo, de acordo com o regime selecionado. O total de etapas ("Etapa X de N") varia de uma simulação para outra dependendo se a etapa de registro profissional se aplica — isso é esperado, não é um erro.',
      'Etapa final — Resultado: o sistema mostra o comparativo entre a carga tributária atual e a carga com a reforma, a diferença entre elas e, quando o CNPJ foi informado, um bloco de contextualização do setor da empresa a partir do CNAE. A partir dessa tela você pode ativar o Modo Apresentação, baixar o PDF do relatório, gerar o Memorando de Entendimento ou, quando o escritório tiver contatos cadastrados, falar direto com o cliente pelos botões "Falar no WhatsApp" e "Enviar e-mail".',
    ],
  },
  {
    id: "modo-apresentacao",
    title: "Modo Apresentação",
    paragraphs: [
      "Use esse modo quando estiver compartilhando a tela com o cliente durante a reunião. Ele esconde os campos e controles de edição, deixando visíveis apenas os cards de comparação (carga atual, carga com a reforma, diferença) e os botões de próximo passo — dando ao cliente uma sensação de apresentação profissional em vez de tela de formulário. Você pode ativar e desativar quantas vezes quiser: os dados preenchidos não se perdem ao alternar o modo.",
    ],
  },
  {
    id: "memorando",
    title: "Gerar o Memorando de Entendimento e Confidencialidade",
    paragraphs: [
      'Na tela de resultado, clique em "Gerar Memorando". Se o CNPJ do cliente já tiver sido informado e salvo naquela simulação, o sistema pula a busca e reaproveita os dados já obtidos; caso contrário, ele pergunta se você quer buscar o CNPJ agora ou preencher manualmente. Em seguida, numa tela de revisão, você confirma os dados que sempre exigem confirmação manual — como o nome de quem vai assinar pelo cliente, que o CNPJ não informa. O documento final é gerado em .docx, já preenchido com os dados do escritório e do cliente, com o nome do arquivo no formato memorando-[razão-social-ou-data].docx.',
    ],
  },
  {
    id: "dados-escritorio",
    title: "Configurar os dados do escritório",
    paragraphs: [
      'Em "Dados do escritório" (área protegida por login), preencha nome do escritório, CNPJ/CPF, endereço e responsável — esses dados alimentam o Memorando gerado e, no Modo Apresentação, a marca discreta na tela de resultado. Há também quatro campos opcionais de contato: WhatsApp, e-mail de contato, telefone fixo e site. Quando preenchidos, esses contatos passam a aparecer para o cliente na Etapa 5 (botões "Falar no WhatsApp" e "Enviar e-mail"), no rodapé da página inicial, no link somente leitura de um cálculo compartilhado e no rodapé do PDF do relatório. Se nenhum contato for cadastrado, nada disso aparece — a tela fica como era antes. O botão de WhatsApp já abre com uma mensagem pronta, incluindo o nome do cliente e o link do cálculo quando disponíveis.',
    ],
  },
  {
    id: "meus-calculos",
    title: "Meus Cálculos e login da equipe",
    paragraphs: [
      '"Meus Cálculos" é a lista de simulações salvas (nome do cliente, data e resultado resumido), para reencontrar um cálculo feito antes — visível para toda a equipe, com indicação de quem criou cada um. O acesso a essa lista, à configuração de alíquotas e aos dados do escritório agora exige login individual (e-mail e senha, ou "Entrar com Google") em vez do código único de antes; o cadastro é fechado, então novas contas da equipe precisam ser criadas por quem já administra o sistema — não há autocadastro. O simulador, a página inicial e o link somente leitura de um cálculo compartilhado continuam públicos, sem exigir login. Em cada cálculo com compartilhamento ativado, o botão "Enviar por WhatsApp" abre o WhatsApp já com a mensagem e o link somente leitura prontos para o cliente.',
    ],
  },
  {
    id: "faq",
    title: "Perguntas frequentes",
    faq: [
      {
        q: "O CNAE decide automaticamente a Atividade ou o Anexo do Simples?",
        a: "Não. O CNAE só sugere a Atividade (você pode trocar) e aparece como contexto no relatório final; ele nunca preenche Anexo do Simples, regime ou a resposta sobre registro em conselho profissional — isso é sempre manual.",
      },
      {
        q: 'Por que o número de etapas muda de uma simulação para outra ("Etapa 3 de 4" numa e "Etapa 3 de 5" em outra)?',
        a: "É esperado: a etapa de registro em conselho profissional (Art. 127) só aparece quando a Atividade selecionada exige esse tipo de validação.",
      },
      {
        q: "Posso mostrar a tela para o cliente sem risco de ele ver campos de edição?",
        a: "Sim — ative o Modo Apresentação antes de compartilhar a tela.",
      },
      {
        q: 'O relatório final entrega o "como fazer" para reduzir a carga tributária?',
        a: "Não, e não deve. Ele mostra o comparativo e o contexto setorial; a análise de caminho e estratégia fica reservada para o diagnóstico completo, depois da assinatura do Memorando.",
      },
      {
        q: "Preciso estar logado para fazer uma simulação?",
        a: 'Não. O simulador, a página inicial e o link somente leitura de um cálculo compartilhado são públicos. Login só é exigido para acessar "Meus Cálculos", a configuração de alíquotas e os dados do escritório.',
      },
      {
        q: "Como adiciono um novo membro da equipe?",
        a: 'O cadastro é fechado — não existe tela de "criar conta" pública. Uma conta nova (e-mail/senha ou Google) precisa ser criada por quem já administra o sistema.',
      },
    ],
  },
];

const SIMULATOR_SECTIONS: Section[] = [
  {
    id: "sobre-simulacao",
    title: "Sobre esta simulação",
    paragraphs: [
      "O Reforma Fácil é uma calculadora que estima, a partir dos dados informados aqui, como a carga tributária da empresa pode mudar com a Reforma Tributária (IBS/CBS). Os valores mostrados são uma estimativa inicial, com base nas informações preenchidas nesta simulação.",
    ],
  },
  {
    id: "passo-a-passo",
    title: "Passo a passo",
    steps: [
      'Etapa 1 — Identificação: informe o CNPJ da empresa, ou clique em "Pular e preencher manualmente" se preferir. Informando o CNPJ, alguns dados (razão social, CNAE, sugestão de Atividade) são preenchidos automaticamente — você pode ajustar qualquer um deles.',
      "Etapa 2 — Atividade e regime: confirme ou ajuste a Atividade principal e informe o regime tributário atual (Simples Nacional, Lucro Presumido, Lucro Real, MEI ou Pessoa Física). Dependendo da Atividade, pode aparecer uma etapa perguntando sobre registro em conselho profissional — essa resposta é sempre preenchida manualmente.",
      "Etapas seguintes — Faturamento e dados financeiros: informe faturamento, despesas e demais dados pedidos, de acordo com o regime selecionado. O número total de etapas pode variar dependendo das suas respostas — isso é normal.",
      "Etapa final — Resultado: mostra o comparativo entre a carga tributária atual e a estimada com a reforma, a diferença entre elas e, quando o CNPJ foi informado, um contexto sobre o setor da empresa. A partir daqui é possível baixar o relatório em PDF, gerar o Memorando de Entendimento e, quando disponível, falar diretamente pelo WhatsApp ou e-mail.",
    ],
  },
  {
    id: "faq",
    title: "Perguntas frequentes",
    faq: [
      {
        q: "O CNAE preenche automaticamente minha Atividade ou o meu regime?",
        a: "Não. O CNAE só sugere a Atividade (você pode alterar) e aparece como contexto no resultado final; ele nunca decide sozinho o Anexo do Simples, o regime ou a resposta sobre registro em conselho profissional.",
      },
      {
        q: "Por que o número de etapas muda?",
        a: "A etapa sobre registro em conselho profissional só aparece quando a Atividade selecionada exige esse tipo de validação — por isso o total de etapas pode variar.",
      },
      {
        q: "Preciso criar login para fazer essa simulação?",
        a: "Não. A simulação é aberta e não exige login.",
      },
    ],
  },
];

const sectionText = (s: Section) =>
  [
    s.title,
    ...(s.paragraphs ?? []),
    ...(s.steps ?? []),
    ...(s.faq ?? []).flatMap((f) => [f.q, f.a]),
  ]
    .join(" ")
    .toLowerCase();

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let found = lower.indexOf(term, i);
  let key = 0;
  while (found !== -1) {
    if (found > i) parts.push(text.slice(i, found));
    parts.push(
      <mark key={key++} className="rounded bg-warning-soft px-0.5 text-foreground">
        {text.slice(found, found + term.length)}
      </mark>,
    );
    i = found + term.length;
    found = lower.indexOf(term, i);
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

export type HelpVariant = "full" | "simulator";

export function HelpPanel({ onClose, variant = "full" }: { onClose: () => void; variant?: HelpVariant }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(
    variant === "full" ? { "visao-geral": true } : { "sobre-simulacao": true },
  );

  const term = query.trim().toLowerCase();
  const sections = variant === "full" ? SECTIONS : SIMULATOR_SECTIONS;

  const matches = useMemo(
    () => (term ? sections.filter((s) => sectionText(s).includes(term)) : sections),
    [term, sections],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOpen = (id: string) => (term ? true : Boolean(open[id]));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40" role="dialog" aria-modal="true" aria-label="Manual do sistema">
      <button type="button" aria-label="Fechar ajuda" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col bg-card shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {variant === "full" ? "Ajuda — manual do sistema" : "Ajuda — sobre a simulação"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {variant === "full"
                ? "Documentação interna. Busque por um termo ou navegue pelo sumário."
                : "Busque por um termo ou navegue pelo sumário."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            Fechar
          </button>
        </header>

        <div className="border-b border-border px-5 py-4">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={variant === "full" ? "Buscar no manual (ex.: memorando, CNAE, login)" : "Buscar na ajuda (ex.: CNPJ, CNAE, etapas)"}
            className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
          <nav className="mt-3 flex flex-wrap gap-2">
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setOpen((prev) => ({ ...prev, [s.id]: true }));
                  document.getElementById(`help-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-full border border-input px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                {s.title}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma seção encontrada para esse termo.</p>
          ) : null}
          {matches.map((s) => (
            <section key={s.id} id={`help-${s.id}`} className="border-b border-border py-3 last:border-0">
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [s.id]: !isOpen(s.id) }))}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-base font-semibold">
                  <Highlight text={s.title} term={term} />
                </span>
                <span aria-hidden className="text-muted-foreground">
                  {isOpen(s.id) ? "−" : "+"}
                </span>
              </button>
              {isOpen(s.id) ? (
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground">
                  {s.paragraphs?.map((p, idx) => (
                    <p key={idx}>
                      <Highlight text={p} term={term} />
                    </p>
                  ))}
                  {s.steps ? (
                    <ol className="list-decimal space-y-3 pl-5">
                      {s.steps.map((p, idx) => (
                        <li key={idx}>
                          <Highlight text={p} term={term} />
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {s.faq?.map((f, idx) => (
                    <div key={idx}>
                      <p className="font-semibold">
                        <Highlight text={f.q} term={term} />
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        <Highlight text={f.a} term={term} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function HelpButton({ variant = "full" }: { variant?: HelpVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir ajuda"
        title="Ajuda"
        className="inline-flex items-center gap-2 rounded-md border border-navy-foreground/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-navy-foreground/10"
      >
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px]">
          ?
        </span>
        Ajuda
      </button>
      {open ? <HelpPanel variant={variant} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
