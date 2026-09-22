/**
 * Regras puras do Parecer Padrão: sugestão de achados e checklist pré-geração.
 * Não consulta banco e não recalcula nada — só lê o snapshot já compilado.
 */
import {
  AREAS_PLANO,
  type Achado,
  type ChecklistItem,
  type ParecerEdicoes,
  type ParecerSnapshot,
} from "./tipos";

const ACHADO_VAZIO: Achado = {
  titulo: "Achado a ser definido pelo analista",
  impacto: "",
  causa: "",
  decisao: "",
};

const money = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Até 3 achados sugeridos (impacto -> causa -> decisão). Sem dado, fica em branco. */
export function sugerirAchados(snap: ParecerSnapshot): Achado[] {
  const achados: Achado[] = [];

  if (snap.sec5.valorAtual > 0 && Math.abs(snap.sec5.variacaoMediaPct) >= 0.5) {
    achados.push({
      titulo: "Pressão de preço nas vendas",
      impacto: `O preço necessário para manter a margem varia ${pct(
        snap.sec5.variacaoMediaPct,
      )} sobre ${money(snap.sec5.valorAtual)} de vendas analisadas.`,
      causa:
        "Diferença entre os tributos hoje embutidos no preço e a alíquota plena de IBS/CBS aplicável aos itens vendidos.",
      decisao:
        "Definir o que será repassado, absorvido ou diferenciado por perfil de cliente antes da virada.",
    });
  } else if (snap.sec4.creditoTotal > 0) {
    achados.push({
      titulo: "Crédito apurado nas compras",
      impacto: `As compras analisadas geram ${money(snap.sec4.creditoTotal)} de crédito de IBS/CBS sobre ${money(
        snap.sec4.baseTotal,
      )} de base.`,
      causa: "Composição atual de fornecedores e classificação por NCM/NBS dos itens comprados.",
      decisao: "Consolidar compras nos fornecedores que efetivamente transferem crédito.",
    });
  }

  const critico = snap.sec4.fornecedores[0];
  if (critico) {
    achados.push({
      titulo: `Concentração em ${critico.nome ?? critico.cnpj ?? "fornecedor principal"}`,
      impacto: `${money(critico.valorApurado)} de crédito apurado concentrados em um único fornecedor${
        snap.sec4.concentracaoTopPct != null
          ? ` (${pct(snap.sec4.concentracaoTopPct)} do total apurado)`
          : ""
      }.`,
      causa: "Dependência de um fornecedor para parte relevante do crédito do período.",
      decisao: "Revisar contrato, classificação fiscal e alternativas de fornecimento.",
    });
  }

  const disponiveis = snap.sec8.cenarios.filter((c) => c.total != null);
  const melhor = disponiveis.slice().sort((a, b) => (a.total ?? 0) - (b.total ?? 0))[0];
  const atual = snap.sec8.cenarios.find((c) => c.atual);
  if (melhor && atual && !melhor.atual && atual.total != null && melhor.total != null) {
    achados.push({
      titulo: "Possível mudança de regime",
      impacto: `${melhor.label} aparece ${money(atual.total - melhor.total)} abaixo do regime atual no ano analisado.`,
      causa: "Diferença de base e de alíquota entre os regimes com os dados informados na Etapa 1.",
      decisao:
        "Avaliar juridicamente a migração de regime, considerando contexto do negócio e custos de transição.",
    });
  }

  const tres = achados.slice(0, 3);
  while (tres.length < 3) tres.push({ ...ACHADO_VAZIO });
  return tres;
}

function temTexto(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Checklist do manual: sinaliza, nunca bloqueia a geração do rascunho. */
export function avaliarChecklist(
  snap: ParecerSnapshot,
  edicoes: ParecerEdicoes,
  limiarForaPct = 10,
): ChecklistItem[] {
  const carga = snap.sec2.carga;
  const total = carga.reduce((a, l) => a + l.total, 0);
  const fora = carga.reduce((a, l) => a + l.duplicados + l.naoSaoNotas + l.ignorados, 0);
  const foraPct = total > 0 ? (fora / total) * 100 : 0;

  const pendentes = snap.sec2.pendencias.reduce((a, p) => a + p.itens, 0);
  const achados = edicoes.sec3?.achados ?? snap.sec3.achados;
  const achadosEscritos = achados.filter((a) => temTexto(a.impacto) || temTexto(a.decisao)).length;
  const plano = edicoes.sec9 ?? {};
  const planoOk = AREAS_PLANO.some(
    (a) => temTexto(plano[a.id]?.acao) && temTexto(plano[a.id]?.responsavel) && temTexto(plano[a.id]?.prazo),
  );

  return [
    {
      id: "escopo",
      label: "Escopo e período declarados",
      ok: Boolean(snap.sec1.escopo) && temTexto(snap.sec1.objetivo),
      detalhe: temTexto(snap.sec1.objetivo)
        ? "Escopo e objetivo preenchidos no cadastro do Caso."
        : "Falta o objetivo da simulação no cadastro do Caso.",
      alvo: "secao-1",
    },
    {
      id: "regime",
      label: "Regime atual confirmado",
      ok: Boolean(snap.sec1.regimeAtual),
      detalhe: snap.sec1.regimeAtual
        ? `Regime informado: ${snap.sec1.regimeAtual}.`
        : "Nenhum cálculo salvo com regime atual (Etapa 1).",
      alvo: "secao-8",
    },
    {
      id: "carga",
      label: "Painel de carga conferido",
      ok: total > 0 && foraPct <= limiarForaPct,
      detalhe:
        total === 0
          ? "Nenhum documento processado neste Caso."
          : `${fora} de ${total} documentos ficaram fora do cálculo (${foraPct.toFixed(1)}%).`,
      alvo: "secao-2",
    },
    {
      id: "criticos",
      label: "Pelo menos um fornecedor crítico revisado",
      ok: snap.sec4.fornecedores.length > 0 && snap.sec4.pendentes === 0,
      detalhe:
        snap.sec4.fornecedores.length === 0
          ? "Não há fornecedores apurados para revisar."
          : `${snap.sec4.pendentes} item(ns) de maior valor ainda em revisão pendente.`,
      alvo: "secao-4",
    },
    {
      id: "dre",
      label: "DRE e fluxo de caixa gerados",
      ok: snap.sec6.linhas.length > 0 && snap.sec7.resumoAnual.length > 0,
      detalhe:
        snap.sec6.linhas.length > 0 && snap.sec7.resumoAnual.length > 0
          ? "DRE e fluxo mensal disponíveis para o período."
          : "Gere a DRE e o fluxo de caixa do Caso.",
      alvo: "secao-6",
    },
    {
      id: "split",
      label: "Split payment com leitura completa",
      ok: snap.sec7.periodo != null && (snap.sec7.creditoDisponivel > 0 || snap.sec7.debitoRetido > 0),
      detalhe:
        snap.sec7.periodo == null
          ? "Sem período de fluxo para ler a mecânica do split."
          : "Retenção, crédito e efeito líquido disponíveis.",
      alvo: "secao-7",
    },
    {
      id: "recomendacao",
      label: "Recomendação de regime escrita pelo analista",
      ok: temTexto(edicoes.sec8?.recomendacao),
      detalhe: temTexto(edicoes.sec8?.recomendacao)
        ? "Recomendação profissional registrada."
        : "O número do motor de regime não substitui a recomendação escrita.",
      alvo: "secao-8",
    },
    {
      id: "achados",
      label: "Os 3 achados estão escritos",
      ok: achadosEscritos >= 3,
      detalhe: `${achadosEscritos} de 3 achados preenchidos.`,
      alvo: "secao-3",
    },
    {
      id: "plano",
      label: "Plano de ação com responsável e prazo",
      ok: planoOk,
      detalhe: planoOk
        ? "Pelo menos uma ação tem responsável e prazo."
        : "Nenhuma ação tem responsável e prazo definidos.",
      alvo: "secao-9",
    },
    {
      id: "conclusao",
      label: "Conclusão e próxima revisão registradas",
      ok: temTexto(edicoes.sec10?.sintese) && temTexto(edicoes.sec10?.proximaRevisao),
      detalhe:
        temTexto(edicoes.sec10?.sintese) && temTexto(edicoes.sec10?.proximaRevisao)
          ? "Síntese e data da próxima revisão preenchidas."
          : "Falta a síntese do analista ou a data da próxima revisão.",
      alvo: "secao-10",
    },
    {
      id: "pendencias",
      label: "Lacunas de classificação documentadas",
      ok: true,
      detalhe:
        pendentes === 0
          ? "Nenhum item sem classificação pendente."
          : `${pendentes} item(ns) sem dado ou em revisão aparecem listados na Seção 2.`,
      alvo: "secao-2",
    },
  ];
}
