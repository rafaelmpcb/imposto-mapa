import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sugerirAchados } from "@/lib/parecer/compilar";
import {
  LIMITACOES,
  type CaseEscopo,
  type ParecerEdicoes,
  type ParecerSnapshot,
  type ParecerStatus,
  type ParecerVersao,
} from "@/lib/parecer/tipos";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const num = (v: unknown) => Number(v ?? 0) || 0;

const PENDENTES = ["ambiguo_revisao_pendente", "sem_dado", "marcado_revisao"];

const REGIME_LABEL: Record<string, string> = {
  pf: "Pessoa Física (CLT)",
  mei: "MEI",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
};

/** Lê as tabelas de origem e monta o retrato das 10 seções. Não recalcula nada. */
async function compilarSnapshot(admin: Admin, caseId: string): Promise<ParecerSnapshot> {
  const [
    caseRes,
    simRes,
    cargaRes,
    despesasRes,
    cenarioRes,
    fluxoParamRes,
    cronogramaRes,
    dreRes,
    fluxoRes,
    comprasRes,
    vendasRes,
    servicosRes,
    precoMercRes,
    precoServRes,
    precoAnoRes,
    contratosRes,
  ] = await Promise.all([
    admin.from("cases").select("*").eq("id", caseId).maybeSingle(),
    admin
      .from("simulations")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin.from("vw_painel_carga").select("*").eq("case_id", caseId),
    admin.from("despesa_operacional_anual").select("ano,valor").eq("case_id", caseId).order("ano"),
    admin.from("parametro_cenario_compras").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("parametro_fluxo_caixa").select("*").eq("case_id", caseId).maybeSingle(),
    admin
      .from("cronograma_transicao_ibscbs")
      .select("ano,fracao_aliquota_plena,updated_at")
      .order("ano")
      .limit(50),
    admin.from("dre_projecao_anual").select("*").eq("case_id", caseId).order("ano"),
    admin
      .from("fluxo_caixa_projecao_mensal")
      .select("*")
      .eq("case_id", caseId)
      .order("ano")
      .order("mes"),
    admin.from("vw_concentracao_compras_ncm").select("*").eq("case_id", caseId),
    admin.from("vw_concentracao_vendas_ncm").select("*").eq("case_id", caseId),
    admin.from("vw_concentracao_servicos_nbs").select("*").eq("case_id", caseId),
    admin.from("nota_fiscal_venda_xml_item_preco").select("*").eq("case_id", caseId),
    admin.from("nota_servico_nfse_item_prestado_preco").select("*").eq("case_id", caseId),
    admin.from("preco_necessario_projecao_anual").select("*").eq("case_id", caseId).order("ano"),
    admin.from("contrato_aluguel").select("*").eq("case_id", caseId).order("created_at"),
  ]);

  const caseRow = caseRes.data as Record<string, unknown> | null;
  const sim = (simRes.data ?? [])[0] as Record<string, unknown> | undefined;
  const simInput = (sim?.["input"] ?? {}) as Record<string, unknown>;

  /* ---------- Seção 2: pendências e exceções por fluxo ---------- */
  const fluxosItens: { tabela: string; label: string; valorCol: string }[] = [
    { tabela: "nota_fiscal_compra_xml_item", label: "Compras (mercadoria)", valorCol: "valor_item" },
    { tabela: "nota_fiscal_venda_xml_item", label: "Vendas (mercadoria)", valorCol: "valor_item" },
    { tabela: "nota_servico_nfse_item", label: "Serviços tomados", valorCol: "valor_servico" },
    { tabela: "nota_servico_nfse_item_prestado", label: "Serviços prestados", valorCol: "valor_servico" },
  ];

  const pendencias: ParecerSnapshot["sec2"]["pendencias"] = [];
  const excecoesMap = new Map<string, number>();
  for (const fluxo of fluxosItens) {
    const res = await (admin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    })
      .from(fluxo.tabela)
      .select(`status_classificacao,fonte,${fluxo.valorCol}`)
      .eq("case_id", caseId)
      .limit(5000);
    const rows = ((res.data ?? []) as Record<string, unknown>[]);
    const pend = rows.filter((r) => PENDENTES.includes(String(r["status_classificacao"] ?? "")));
    if (pend.length > 0) {
      pendencias.push({
        fluxo: fluxo.label,
        itens: pend.length,
        valor: pend.reduce((a, r) => a + num(r[fluxo.valorCol]), 0),
      });
    }
    for (const r of rows) {
      const fonte = String(r["fonte"] ?? "").trim();
      if (!fonte || fonte === "regime_geral") continue;
      excecoesMap.set(fonte, (excecoesMap.get(fonte) ?? 0) + 1);
    }
  }

  const carga = (cargaRes.data ?? []).map((r) => ({
    tipo: String(r["tipo_documento"] ?? ""),
    validos: num(r["validos"]),
    duplicados: num(r["duplicados"]),
    naoSaoNotas: num(r["nao_sao_notas"]),
    ignorados: num(r["ignorados"]),
    manuais: num(r["manuais"]),
    total: num(r["total_recebido"]),
  }));

  const temServicos = (servicosRes.data ?? []).length > 0;
  const regimeAtual = sim ? (REGIME_LABEL[String(sim["taxpayer_type"])] ?? String(sim["taxpayer_type"])) : null;

  const limitacoes: string[] = [LIMITACOES.aliquota];
  if (sim?.["taxpayer_type"] === "real") limitacoes.push(LIMITACOES.real);
  limitacoes.push(LIMITACOES.simples);
  if ((dreRes.data ?? []).length > 0) limitacoes.push(LIMITACOES.dre);
  if ((fluxoRes.data ?? []).length > 0) limitacoes.push(LIMITACOES.fluxo, LIMITACOES.split);
  if ((precoMercRes.data ?? []).length + (precoServRes.data ?? []).length > 0) {
    limitacoes.push(LIMITACOES.preco);
  }

  const cronograma = cronogramaRes.data ?? [];
  const parametros = [
    {
      label: "Alíquota plena de IBS/CBS usada nos cenários",
      valor: cenarioRes.data
        ? `${num(cenarioRes.data["aliquota_ibs_cbs_plena_pct"]).toLocaleString("pt-BR")}%`
        : "não definida (padrão do sistema)",
      atualizadoEm: (cenarioRes.data?.["updated_at"] as string | undefined) ?? null,
    },
    {
      label: "Cronograma de transição (anos cadastrados)",
      valor: cronograma.length > 0 ? `${cronograma.length} anos` : "padrão do sistema",
      atualizadoEm: (cronograma[0]?.["updated_at"] as string | undefined) ?? null,
    },
    {
      label: "Prazos de fluxo de caixa (recebimento / pagamento / compensação)",
      valor: fluxoParamRes.data
        ? `${num(fluxoParamRes.data["prazo_medio_recebimento_dias"])} / ${num(
            fluxoParamRes.data["prazo_medio_pagamento_fornecedores_dias"],
          )} / ${num(fluxoParamRes.data["periodicidade_compensacao_credito_dias"])} dias`
        : "30 / 30 / 30 dias (padrão)",
      atualizadoEm: (fluxoParamRes.data?.["atualizado_em"] as string | undefined) ?? null,
    },
  ];

  /* ---------- Seção 4: compras ---------- */
  const comprasRows = (comprasRes.data ?? []) as Record<string, unknown>[];
  const porFornecedor = new Map<string, ParecerSnapshot["sec4"]["fornecedores"][number]>();
  const porNcm = new Map<string, ParecerSnapshot["sec4"]["fornecedores"][number]>();
  for (const r of comprasRows) {
    const cnpj = (r["cnpj_contraparte"] as string | null) ?? null;
    const chaveF = cnpj ?? String(r["nome_contraparte"] ?? "sem identificação");
    const f = porFornecedor.get(chaveF) ?? {
      codigo: "",
      cnpj,
      nome: (r["nome_contraparte"] as string | null) ?? null,
      valorBase: 0,
      valorApurado: 0,
      itens: 0,
      pendentes: 0,
    };
    f.valorBase += num(r["valor_base_total"]);
    f.valorApurado += num(r["valor_apurado_total"]);
    f.itens += num(r["n_itens"]);
    f.pendentes += num(r["n_itens_pendentes"]);
    porFornecedor.set(chaveF, f);

    const codigo = String(r["codigo"] ?? "");
    const n = porNcm.get(codigo) ?? {
      codigo,
      cnpj: null,
      nome: null,
      valorBase: 0,
      valorApurado: 0,
      itens: 0,
      pendentes: 0,
    };
    n.valorBase += num(r["valor_base_total"]);
    n.valorApurado += num(r["valor_apurado_total"]);
    n.itens += num(r["n_itens"]);
    n.pendentes += num(r["n_itens_pendentes"]);
    porNcm.set(codigo, n);
  }
  const fornecedores = [...porFornecedor.values()].sort((a, b) => b.valorApurado - a.valorApurado).slice(0, 10);
  const ncms = [...porNcm.values()].sort((a, b) => b.valorApurado - a.valorApurado).slice(0, 10);
  const creditoTotal = comprasRows.reduce((a, r) => a + num(r["valor_apurado_total"]), 0);
  const baseTotal = comprasRows.reduce((a, r) => a + num(r["valor_base_total"]), 0);

  /* ---------- Seção 5: preço necessário ---------- */
  const precoRows = [
    ...((precoMercRes.data ?? []) as Record<string, unknown>[]),
    ...((precoServRes.data ?? []) as Record<string, unknown>[]),
  ];
  const valorAtual = precoRows.reduce((a, r) => a + num(r["valor_desonerado"]) + num(r["tributos_atuais_total"]), 0);
  const precoNecessarioTotal = precoRows.reduce((a, r) => a + num(r["preco_necessario"]), 0);
  const variacaoMediaPct =
    precoRows.length > 0
      ? precoRows.reduce((a, r) => a + num(r["variacao_preco_pct"]), 0) / precoRows.length
      : 0;
  const perfilMap = new Map<string, { perfil: string; valorAtual: number; precoNecessario: number; itens: number }>();
  for (const r of precoRows) {
    const perfil = String(r["regime_cliente_snapshot"] ?? "não identificado");
    const acc = perfilMap.get(perfil) ?? { perfil, valorAtual: 0, precoNecessario: 0, itens: 0 };
    acc.valorAtual += num(r["valor_desonerado"]) + num(r["tributos_atuais_total"]);
    acc.precoNecessario += num(r["preco_necessario"]);
    acc.itens += 1;
    perfilMap.set(perfil, acc);
  }
  const anoMap = new Map<number, { ano: number; precoNecessario: number; soma: number; n: number }>();
  for (const r of (precoAnoRes.data ?? []) as Record<string, unknown>[]) {
    const ano = num(r["ano"]);
    const acc = anoMap.get(ano) ?? { ano, precoNecessario: 0, soma: 0, n: 0 };
    acc.precoNecessario += num(r["preco_necessario_ano"]);
    acc.soma += num(r["variacao_preco_pct_ano"]);
    acc.n += 1;
    anoMap.set(ano, acc);
  }

  /* ---------- Seção 6 e 7 ---------- */
  const dreLinhas = ((dreRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    ano: num(r["ano"]),
    cenario: String(r["cenario"] ?? ""),
    receitaBruta: num(r["receita_bruta"]),
    custo: num(r["custo"]),
    lucroBruto: num(r["lucro_bruto"]),
    despesas: num(r["despesas_operacionais"]),
    ircs: r["ircs"] == null ? null : num(r["ircs"]),
    resultadoLiquido: r["resultado_liquido"] == null ? null : num(r["resultado_liquido"]),
  }));

  const meses = (fluxoRes.data ?? []) as Record<string, unknown>[];
  const resumoAnualMap = new Map<number, { ano: number; retido: number; credito: number; liquido: number }>();
  for (const m of meses) {
    const ano = num(m["ano"]);
    const acc = resumoAnualMap.get(ano) ?? { ano, retido: 0, credito: 0, liquido: 0 };
    acc.retido += num(m["debito_ibscbs_retido"]);
    acc.credito += num(m["credito_ibscbs_disponivel"]);
    acc.liquido += num(m["debito_liquido_recolhido"]);
    resumoAnualMap.set(ano, acc);
  }
  const ultimo = meses[meses.length - 1];
  const dreProjetada = dreLinhas.filter((l) => l.cenario === "projetado");
  const dreDoAno = ultimo ? dreProjetada.find((l) => l.ano === num(ultimo["ano"])) : undefined;

  /* ---------- Seção 8: regimes ---------- */
  let cenarios: ParecerSnapshot["sec8"]["cenarios"] = [];
  let anoBase: number | null = null;
  if (sim) {
    const { compareRegimes, defaultInput } = await import("@/lib/tax/calc");
    const year = num(sim["year_id"]) as 2026 | 2027 | 2033;
    anoBase = year;
    try {
      const input = { ...defaultInput(), ...(simInput as object) } as Parameters<typeof compareRegimes>[0];
      cenarios = compareRegimes(input, year).map((item) => ({
        label: item.label,
        total: item.total,
        rate: item.rate,
        atual: item.isCurrent,
        ...(item.estimateNote ? { nota: item.estimateNote } : {}),
      }));
    } catch {
      cenarios = [];
    }
  }

  /* ---------- Submódulo: Contratos e Aluguéis ---------- */
  const contratoRows = (contratosRes.data ?? []) as Record<string, unknown>[];
  const contratos = contratoRows.map((row) => {
    const res = (row["resultado_json"] ?? {}) as {
      cenarios?: { valorContrato?: number; liquidoLocador?: number; custoEfetivoLocatario?: number }[];
      repactuacao?: { aluguelSugerido?: number; variacaoAluguelPct?: number };
    };
    const atual = res.cenarios?.[0];
    const sem = res.cenarios?.[1];
    return {
      titulo: String(row["titulo"] ?? "Contrato de locação"),
      contraparte: (row["contraparte"] as string | null) ?? null,
      papel: String(row["papel"] ?? "locador"),
      regime: String(row["regime_locador"] ?? ""),
      criterio: String(row["criterio"] ?? ""),
      ano: num(row["ano_referencia"]),
      aluguelAtual: num(atual?.valorContrato ?? row["aluguel_mensal"]),
      aluguelSugerido: num(res.repactuacao?.aluguelSugerido),
      variacaoAluguelPct: num(res.repactuacao?.variacaoAluguelPct),
      liquidoAtual: num(atual?.liquidoLocador),
      liquidoSemRepactuacao: num(sem?.liquidoLocador),
      custoAtualLocatario: num(atual?.custoEfetivoLocatario),
      custoSemRepactuacao: num(sem?.custoEfetivoLocatario),
    };
  });
  const soma = (pick: (c: (typeof contratos)[number]) => number) =>
    contratos.reduce((a, c) => a + pick(c), 0);
  const totalAtual = soma((c) => c.aluguelAtual);
  const liquidoAtualTotal = soma((c) => c.liquidoAtual);
  const liquidoSemRepacTotal = soma((c) => c.liquidoSemRepactuacao);
  const totalSugerido = soma((c) => c.aluguelSugerido);
  const aluguelSnap =
    contratos.length > 0
      ? {
          contratos,
          totalAtual,
          totalSugerido,
          variacaoAluguelPct:
            totalAtual > 0 ? ((totalSugerido - totalAtual) / totalAtual) * 100 : 0,
          liquidoAtual: liquidoAtualTotal,
          liquidoSemRepactuacao: liquidoSemRepacTotal,
          variacaoLiquidoPct:
            liquidoAtualTotal > 0
              ? ((liquidoSemRepacTotal - liquidoAtualTotal) / liquidoAtualTotal) * 100
              : 0,
        }
      : undefined;

  if (aluguelSnap) limitacoes.push(LIMITACOES.aluguel);

  const snap: ParecerSnapshot = {
    geradoEm: new Date().toISOString(),
    sec1: {
      cliente: (caseRow?.["client_name"] as string | null) ?? null,
      cnpj: (caseRow?.["cnpj"] as string | null) ?? null,
      regimeAtual,
      escopo: ((caseRow?.["escopo"] as CaseEscopo | undefined) ?? "completo") as CaseEscopo,
      objetivo: (caseRow?.["objetivo"] as string | null) ?? null,
      anoBase,
    },
    sec2: {
      carga,
      pendencias,
      despesas: ((despesasRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        ano: num(r["ano"]),
        valor: num(r["valor"]),
      })),
      issOrigem: temServicos
        ? "ISS lido dos documentos de serviço processados (NFS-e); quando ausente no documento, o item entra como estimativa e fica na fila de revisão."
        : null,
      parametros,
      excecoes: [...excecoesMap.entries()].map(([fonte, itens]) => ({ fonte, itens })),
      limitacoes,
    },
    sec3: { achados: [] },
    sec4: {
      creditoTotal,
      baseTotal,
      fornecedores,
      ncms,
      pendentes: comprasRows.reduce((a, r) => a + num(r["n_itens_pendentes"]), 0),
      concentracaoTopPct:
        creditoTotal > 0 && fornecedores[0] ? (fornecedores[0].valorApurado / creditoTotal) * 100 : null,
    },
    sec5: {
      valorAtual,
      precoNecessario: precoNecessarioTotal,
      variacaoMediaPct,
      porPerfil: [...perfilMap.values()],
      porAno: [...anoMap.values()].map((a) => ({
        ano: a.ano,
        precoNecessario: a.precoNecessario,
        variacaoPct: a.n > 0 ? a.soma / a.n : 0,
      })),
    },
    sec6: { linhas: dreLinhas },
    sec7: {
      periodo: ultimo ? { ano: num(ultimo["ano"]), mes: num(ultimo["mes"]) } : null,
      vendasBrutas: dreDoAno ? dreDoAno.receitaBruta / 12 : 0,
      debitoRetido: ultimo ? num(ultimo["debito_ibscbs_retido"]) : 0,
      creditoDisponivel: ultimo ? num(ultimo["credito_ibscbs_disponivel"]) : 0,
      debitoLiquido: ultimo ? num(ultimo["debito_liquido_recolhido"]) : 0,
      resultadoLiquidoAno: dreDoAno?.resultadoLiquido ?? null,
      resumoAnual: [...resumoAnualMap.values()],
    },
    sec8: {
      regimeAtual,
      anoBase,
      cenarios,
      resultadoLiquido: dreDoAno?.resultadoLiquido ?? null,
    },
    ...(aluguelSnap ? { secAluguel: aluguelSnap } : {}),
    sec9: { sugestoes: {} },
    sec10: { limitacoes },
  };

  snap.sec3.achados = sugerirAchados(snap);

  const sugestoes: Record<string, string> = {};
  if (fornecedores.length > 0) {
    sugestoes["compras"] = `Revisar o fornecedor ${
      fornecedores[0]?.nome ?? fornecedores[0]?.cnpj ?? "de maior valor"
    }, que concentra a maior parcela do crédito apurado.`;
  }
  if (Math.abs(variacaoMediaPct) >= 0.5) {
    sugestoes["vendas"] = `Definir política de repasse: o preço necessário varia em média ${variacaoMediaPct.toFixed(
      1,
    )}% nos itens analisados.`;
  }
  if (aluguelSnap) {
    sugestoes["juridico"] = `Revisar ${aluguelSnap.contratos.length} contrato(s) de locação: sem repactuação, o resultado do locador varia ${aluguelSnap.variacaoLiquidoPct.toFixed(
      1,
    )}% e o aluguel de equilíbrio fica em ${aluguelSnap.totalSugerido.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })} por mês.`;
  }
  snap.sec9.sugestoes = sugestoes;

  return snap;
}

function toVersao(row: Record<string, unknown>): ParecerVersao {
  return {
    id: row["id"] as string,
    case_id: row["case_id"] as string,
    versao: Number(row["versao"]),
    status: row["status"] as ParecerStatus,
    dados: (row["dados_compilados_json"] ?? {}) as ParecerSnapshot,
    edicoes: (row["edicoes_analista_json"] ?? {}) as ParecerEdicoes,
    gerado_em: row["gerado_em"] as string,
    finalizado_em: (row["finalizado_em"] as string | null) ?? null,
    share_enabled: Boolean(row["share_enabled"]),
    share_token: (row["share_token"] as string | null) ?? null,
  };

}

/** Lista as versões do parecer de um Caso (mais recente primeiro). */
export const listPareceres = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [res, caseRes, simRes] = await Promise.all([
      supabaseAdmin
        .from("parecer_padrao")
        .select("*")
        .eq("case_id", data.caseId)
        .order("versao", { ascending: false }),
      supabaseAdmin.from("cases").select("escopo,objetivo").eq("id", data.caseId).maybeSingle(),
      supabaseAdmin.from("simulations").select("id").eq("case_id", data.caseId).limit(1),
    ]);
    if (res.error) throw new Error(res.error.message);
    return {
      ok: true as const,
      versoes: (res.data ?? []).map((r) => toVersao(r as Record<string, unknown>)),
      escopo: ((caseRes.data?.["escopo"] as CaseEscopo | undefined) ?? "completo") as CaseEscopo,
      objetivo: (caseRes.data?.["objetivo"] as string | null) ?? null,
      temEtapa1: (simRes.data ?? []).length > 0,
    };
  });

/** Grava escopo e objetivo no cadastro do Caso. */
export const salvarEscopoCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; escopo: CaseEscopo; objetivo: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cases")
      .update({ escopo: data.escopo, objetivo: data.objetivo.trim() || null })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Gera uma nova versão do parecer com o retrato atual dos dados. */
export const gerarParecer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sim = await supabaseAdmin.from("simulations").select("id").eq("case_id", data.caseId).limit(1);
    if ((sim.data ?? []).length === 0) {
      return {
        ok: false as const,
        motivo:
          "Este Caso ainda não tem cálculo salvo do motor de regime (Etapa 1). Rode e salve a simulação antes de gerar o parecer.",
      };
    }

    const snapshot = await compilarSnapshot(supabaseAdmin, data.caseId);

    const ultimaRes = await supabaseAdmin
      .from("parecer_padrao")
      .select("versao,edicoes_analista_json")
      .eq("case_id", data.caseId)
      .order("versao", { ascending: false })
      .limit(1);
    const ultima = (ultimaRes.data ?? [])[0] as Record<string, unknown> | undefined;

    const insert = await supabaseAdmin
      .from("parecer_padrao")
      .insert({
        case_id: data.caseId,
        versao: ultima ? Number(ultima["versao"]) + 1 : 1,
        status: "rascunho",
        dados_compilados_json: snapshot as unknown as never,
        edicoes_analista_json: (ultima?.["edicoes_analista_json"] ?? {}) as never,
        gerado_por: context.userId,
      })
      .select("*")
      .single();
    if (insert.error) throw new Error(insert.error.message);

    return { ok: true as const, versao: toVersao(insert.data as Record<string, unknown>) };
  });

/** Salva os textos escritos pelo analista por seção. */
export const salvarEdicoesParecer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; edicoes: ParecerEdicoes; status?: ParecerStatus }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      edicoes_analista_json: data.edicoes as unknown as never,
    };
    if (data.status) patch["status"] = data.status;
    const { error } = await supabaseAdmin.from("parecer_padrao").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Marca a versão como finalizada. O checklist é avaliado na tela, como aviso. */
export const finalizarParecer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; edicoes: ParecerEdicoes }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("parecer_padrao")
      .update({
        edicoes_analista_json: data.edicoes as unknown as never,
        status: "finalizado",
        finalizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Liga ou desliga o link dedicado de apresentação do parecer. */
export const setParecerShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; enabled: boolean }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const atual = await supabaseAdmin
      .from("parecer_padrao")
      .select("share_token")
      .eq("id", data.id)
      .maybeSingle();
    const existente = (atual.data?.["share_token"] as string | null) ?? null;
    const token = data.enabled ? (existente ?? crypto.randomUUID().replace(/-/g, "")) : null;
    const { error } = await supabaseAdmin
      .from("parecer_padrao")
      .update({ share_enabled: data.enabled, share_token: token } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, token };
  });

/** Leitura pública do relatório dedicado, apenas quando o link está ativo. */
export const getParecerCompartilhado = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("parecer_padrao")
      .select("*")
      .eq("share_token", data.token)
      .eq("share_enabled", true)
      .maybeSingle();
    if (res.error || !res.data) return { found: false as const };
    return { found: true as const, versao: toVersao(res.data as Record<string, unknown>) };
  });
