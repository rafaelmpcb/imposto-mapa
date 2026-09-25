import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sugerirAchados } from "@/lib/parecer/compilar";
import {
  LIMITACOES,
  type CaseEscopo,
  type FornecedorDetalheSnap,
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

/**
 * Retrato por fornecedor: notas de compra, histórico mensal, participação no
 * total comprado no mês e principais NCMs. Apenas agrega o que já está gravado.
 */
async function compilarDetalheFornecedores(
  admin: Admin,
  caseId: string,
  regimePorCnpj: Map<string, string>,
): Promise<FornecedorDetalheSnap[]> {
  const [notasRes, itensRes] = await Promise.all([
    admin
      .from("nota_fiscal_compra_xml")
      .select(
        "id,chave_acesso,numero_nota,serie,data_emissao,valor_total,cnpj_emitente,razao_social_emitente",
      )
      .eq("case_id", caseId)
      .eq("status_processamento", "ok")
      .limit(5000),
    admin
      .from("nota_fiscal_compra_xml_item")
      .select(
        "nota_fiscal_compra_xml_id,ncm,descricao,valor_item,valor_base_calculo,valor_credito_ibs_cbs,status_classificacao",
      )
      .eq("case_id", caseId)
      .limit(20000),
  ]);

  const notas = (notasRes.data ?? []) as Record<string, unknown>[];
  if (notas.length === 0) return [];
  const itens = (itensRes.data ?? []) as Record<string, unknown>[];

  type Agg = { base: number; credito: number; itens: number; pendentes: number };
  const porNota = new Map<string, Agg>();
  const ncmPorNota = new Map<string, Map<string, { descricao: string | null; base: number; credito: number }>>();
  for (const it of itens) {
    const id = String(it["nota_fiscal_compra_xml_id"] ?? "");
    if (!id) continue;
    const status = String(it["status_classificacao"] ?? "");
    if (status === "excluido_analista") continue;
    const a = porNota.get(id) ?? { base: 0, credito: 0, itens: 0, pendentes: 0 };
    const base = num(it["valor_base_calculo"]) || num(it["valor_item"]);
    a.base += base;
    a.credito += num(it["valor_credito_ibs_cbs"]);
    a.itens += 1;
    if (PENDENTES.includes(status)) a.pendentes += 1;
    porNota.set(id, a);

    const ncm = String(it["ncm"] ?? "").trim() || "sem NCM";
    const mapa = ncmPorNota.get(id) ?? new Map();
    const atual = mapa.get(ncm) ?? {
      descricao: (it["descricao"] as string | null) ?? null,
      base: 0,
      credito: 0,
    };
    atual.base += base;
    atual.credito += num(it["valor_credito_ibs_cbs"]);
    mapa.set(ncm, atual);
    ncmPorNota.set(id, mapa);
  }

  type Forn = FornecedorDetalheSnap & {
    _meses: Map<string, { valorBase: number; credito: number; notas: number }>;
    _ncms: Map<string, { descricao: string | null; base: number; credito: number }>;
  };
  const fornecedores = new Map<string, Forn>();
  const totalMes = new Map<string, number>();

  for (const n of notas) {
    const id = String(n["id"] ?? "");
    const cnpj = (n["cnpj_emitente"] as string | null) ?? null;
    const nome = (n["razao_social_emitente"] as string | null) ?? null;
    const chave = cnpj ?? nome ?? "sem identificação";
    const agg = porNota.get(id) ?? { base: 0, credito: 0, itens: 0, pendentes: 0 };
    const dataStr = (n["data_emissao"] as string | null) ?? null;
    const competencia = dataStr ? dataStr.slice(0, 7) : "sem data";

    const f =
      fornecedores.get(chave) ??
      ({
        chave,
        cnpj,
        nome,
        regime: cnpj ? (regimePorCnpj.get(cnpj.replace(/\D/g, "")) ?? null) : null,
        valorBase: 0,
        credito: 0,
        itens: 0,
        pendentes: 0,
        notas: [],
        meses: [],
        topNcms: [],
        _meses: new Map(),
        _ncms: new Map(),
      } as Forn);

    f.valorBase += agg.base;
    f.credito += agg.credito;
    f.itens += agg.itens;
    f.pendentes += agg.pendentes;
    f.notas.push({
      chave: (n["chave_acesso"] as string | null) ?? null,
      numero: (n["numero_nota"] as string | null) ?? null,
      serie: (n["serie"] as string | null) ?? null,
      data: dataStr,
      valorTotal: num(n["valor_total"]),
      valorBase: agg.base,
      credito: agg.credito,
      itens: agg.itens,
      pendentes: agg.pendentes,
    });

    const m = f._meses.get(competencia) ?? { valorBase: 0, credito: 0, notas: 0 };
    m.valorBase += agg.base;
    m.credito += agg.credito;
    m.notas += 1;
    f._meses.set(competencia, m);
    totalMes.set(competencia, (totalMes.get(competencia) ?? 0) + agg.base);

    for (const [ncm, v] of ncmPorNota.get(id) ?? []) {
      const cur = f._ncms.get(ncm) ?? { descricao: v.descricao, base: 0, credito: 0 };
      cur.base += v.base;
      cur.credito += v.credito;
      f._ncms.set(ncm, cur);
    }

    fornecedores.set(chave, f);
  }

  return [...fornecedores.values()]
    .sort((a, b) => b.valorBase - a.valorBase)
    .slice(0, 50)
    .map((f) => ({
      chave: f.chave,
      cnpj: f.cnpj,
      nome: f.nome,
      regime: f.regime,
      valorBase: f.valorBase,
      credito: f.credito,
      itens: f.itens,
      pendentes: f.pendentes,
      notas: f.notas
        .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
        .slice(0, 100),
      meses: [...f._meses.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([competencia, m]) => ({
          competencia,
          valorBase: m.valorBase,
          credito: m.credito,
          notas: m.notas,
          participacaoPct:
            (totalMes.get(competencia) ?? 0) > 0
              ? (m.valorBase / (totalMes.get(competencia) ?? 1)) * 100
              : 0,
        })),
      topNcms: [...f._ncms.entries()]
        .sort((a, b) => b[1].base - a[1].base)
        .slice(0, 5)
        .map(([ncm, v]) => ({ ncm, descricao: v.descricao, valorBase: v.base, credito: v.credito })),
    }));
}

/**
 * Retrato por cliente: notas de venda (mercadoria) e de serviço prestado,
 * histórico mensal, participação no faturamento do mês e principais NCM/NBS.
 * `credito` aqui é o crédito de IBS/CBS transferido ao cliente — o mesmo
 * débito já apurado item a item. Nada é recalculado.
 */
async function compilarDetalheClientes(
  admin: Admin,
  caseId: string,
): Promise<FornecedorDetalheSnap[]> {
  const [vendasRes, vendaItensRes, nfseRes, nfseItensRes, carteiraRes] = await Promise.all([
    admin
      .from("nota_fiscal_venda_xml")
      .select(
        "id,chave_acesso,numero_nota,serie,data_emissao,valor_total,cnpj_destinatario,razao_social_destinatario",
      )
      .eq("case_id", caseId)
      .eq("status_processamento", "ok")
      .limit(5000),
    admin
      .from("nota_fiscal_venda_xml_item")
      .select(
        "nota_fiscal_venda_xml_id,ncm,descricao,valor_item,valor_base_calculo,valor_debito_ibs_cbs,status_classificacao",
      )
      .eq("case_id", caseId)
      .limit(20000),
    admin
      .from("nota_servico_nfse")
      .select(
        "id,chave_acesso,numero_nota,serie,data_emissao,valor_total,cnpj_tomador,razao_social_tomador",
      )
      .eq("case_id", caseId)
      .eq("direcao", "prestado")
      .limit(5000),
    admin
      .from("nota_servico_nfse_item_prestado")
      .select(
        "nota_servico_id,nbs,descricao,valor_servico,valor_base_calculo,valor_debito_ibs_cbs,status_classificacao",
      )
      .eq("case_id", caseId)
      .limit(20000),
    admin
      .from("composicao_carteira")
      .select("cnpj,regime")
      .eq("case_id", caseId)
      .eq("tipo", "cliente"),
  ]);

  const regimePorCnpj = new Map<string, string>();
  for (const r of (carteiraRes.data ?? []) as Record<string, unknown>[]) {
    const c = String(r["cnpj"] ?? "").replace(/\D/g, "");
    if (c) regimePorCnpj.set(c, String(r["regime"] ?? "pendente"));
  }

  type Agg = { base: number; debito: number; itens: number; pendentes: number };
  const porNota = new Map<string, Agg>();
  const codPorNota = new Map<
    string,
    Map<string, { descricao: string | null; base: number; debito: number }>
  >();

  const acumularItens = (
    rows: Record<string, unknown>[],
    fkCol: string,
    codCol: string,
    valorCol: string,
  ) => {
    for (const it of rows) {
      const id = String(it[fkCol] ?? "");
      if (!id) continue;
      const status = String(it["status_classificacao"] ?? "");
      if (status === "excluido_analista") continue;
      const base = num(it["valor_base_calculo"]) || num(it[valorCol]);
      const a = porNota.get(id) ?? { base: 0, debito: 0, itens: 0, pendentes: 0 };
      a.base += base;
      a.debito += num(it["valor_debito_ibs_cbs"]);
      a.itens += 1;
      if (PENDENTES.includes(status)) a.pendentes += 1;
      porNota.set(id, a);

      const cod = String(it[codCol] ?? "").trim() || "sem código";
      const mapa = codPorNota.get(id) ?? new Map();
      const cur = mapa.get(cod) ?? {
        descricao: (it["descricao"] as string | null) ?? null,
        base: 0,
        debito: 0,
      };
      cur.base += base;
      cur.debito += num(it["valor_debito_ibs_cbs"]);
      mapa.set(cod, cur);
      codPorNota.set(id, mapa);
    }
  };

  acumularItens(
    (vendaItensRes.data ?? []) as Record<string, unknown>[],
    "nota_fiscal_venda_xml_id",
    "ncm",
    "valor_item",
  );
  acumularItens(
    (nfseItensRes.data ?? []) as Record<string, unknown>[],
    "nota_servico_id",
    "nbs",
    "valor_servico",
  );

  type Cli = FornecedorDetalheSnap & {
    _meses: Map<string, { valorBase: number; credito: number; notas: number }>;
    _cods: Map<string, { descricao: string | null; base: number; debito: number }>;
  };
  const clientes = new Map<string, Cli>();
  const totalMes = new Map<string, number>();

  const notas = [
    ...((vendasRes.data ?? []) as Record<string, unknown>[]).map((n) => ({
      n,
      cnpj: (n["cnpj_destinatario"] as string | null) ?? null,
      nome: (n["razao_social_destinatario"] as string | null) ?? null,
    })),
    ...((nfseRes.data ?? []) as Record<string, unknown>[]).map((n) => ({
      n,
      cnpj: (n["cnpj_tomador"] as string | null) ?? null,
      nome: (n["razao_social_tomador"] as string | null) ?? null,
    })),
  ];
  if (notas.length === 0) return [];

  for (const { n, cnpj, nome } of notas) {
    const id = String(n["id"] ?? "");
    const chave = cnpj ?? nome ?? "sem identificação";
    const agg = porNota.get(id) ?? { base: 0, debito: 0, itens: 0, pendentes: 0 };
    const dataStr = (n["data_emissao"] as string | null) ?? null;
    const competencia = dataStr ? dataStr.slice(0, 7) : "sem data";

    const c =
      clientes.get(chave) ??
      ({
        chave,
        cnpj,
        nome,
        regime: cnpj ? (regimePorCnpj.get(cnpj.replace(/\D/g, "")) ?? null) : null,
        valorBase: 0,
        credito: 0,
        itens: 0,
        pendentes: 0,
        notas: [],
        meses: [],
        topNcms: [],
        _meses: new Map(),
        _cods: new Map(),
      } as Cli);

    const base = agg.base || num(n["valor_total"]);
    c.valorBase += base;
    c.credito += agg.debito;
    c.itens += agg.itens;
    c.pendentes += agg.pendentes;
    c.notas.push({
      chave: (n["chave_acesso"] as string | null) ?? null,
      numero: (n["numero_nota"] as string | null) ?? null,
      serie: (n["serie"] as string | null) ?? null,
      data: dataStr,
      valorTotal: num(n["valor_total"]),
      valorBase: base,
      credito: agg.debito,
      itens: agg.itens,
      pendentes: agg.pendentes,
    });

    const m = c._meses.get(competencia) ?? { valorBase: 0, credito: 0, notas: 0 };
    m.valorBase += base;
    m.credito += agg.debito;
    m.notas += 1;
    c._meses.set(competencia, m);
    totalMes.set(competencia, (totalMes.get(competencia) ?? 0) + base);

    for (const [cod, v] of codPorNota.get(id) ?? []) {
      const cur = c._cods.get(cod) ?? { descricao: v.descricao, base: 0, debito: 0 };
      cur.base += v.base;
      cur.debito += v.debito;
      c._cods.set(cod, cur);
    }

    clientes.set(chave, c);
  }

  return [...clientes.values()]
    .sort((a, b) => b.valorBase - a.valorBase)
    .slice(0, 50)
    .map((c) => ({
      chave: c.chave,
      cnpj: c.cnpj,
      nome: c.nome,
      regime: c.regime,
      valorBase: c.valorBase,
      credito: c.credito,
      itens: c.itens,
      pendentes: c.pendentes,
      notas: c.notas.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")).slice(0, 100),
      meses: [...c._meses.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([competencia, m]) => ({
          competencia,
          valorBase: m.valorBase,
          credito: m.credito,
          notas: m.notas,
          participacaoPct:
            (totalMes.get(competencia) ?? 0) > 0
              ? (m.valorBase / (totalMes.get(competencia) ?? 1)) * 100
              : 0,
        })),
      topNcms: [...c._cods.entries()]
        .sort((a, b) => b[1].base - a[1].base)
        .slice(0, 5)
        .map(([ncm, v]) => ({ ncm, descricao: v.descricao, valorBase: v.base, credito: v.debito })),
    }));
}

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
    reequilibrioRes,
    carteiraRes,
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
    admin.from("contrato_reequilibrio").select("*").eq("case_id", caseId).order("created_at"),
    admin
      .from("composicao_carteira")
      .select("cnpj,nome,regime,tipo")
      .eq("case_id", caseId)
      .eq("tipo", "fornecedor"),
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
  const regimePorCnpj = new Map<string, string>();
  for (const r of ((carteiraRes.data ?? []) as Record<string, unknown>[])) {
    const c = String(r["cnpj"] ?? "").replace(/\D/g, "");
    if (c) regimePorCnpj.set(c, String(r["regime"] ?? "pendente"));
  }
  const fornecedores = [...porFornecedor.values()]
    .map((f) => ({
      ...f,
      regime: f.cnpj ? (regimePorCnpj.get(String(f.cnpj).replace(/\D/g, "")) ?? null) : null,
    }))
    .sort((a, b) => b.valorBase - a.valorBase)
    .slice(0, 50);
  const ncms = [...porNcm.values()].sort((a, b) => b.valorApurado - a.valorApurado).slice(0, 10);
  const creditoTotal = comprasRows.reduce((a, r) => a + num(r["valor_apurado_total"]), 0);
  const baseTotal = comprasRows.reduce((a, r) => a + num(r["valor_base_total"]), 0);

  /* ---------- Seção 4b: detalhe por fornecedor (notas, meses, NCM) ---------- */
  const detalhes = await compilarDetalheFornecedores(admin, caseId, regimePorCnpj);

  /* ---------- Seção 5b: clientes e crédito transferido ---------- */
  const clientesDetalhe = await compilarDetalheClientes(admin, caseId);

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
    const year = num(sim["year_id"]) as YearId;
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

  /* ---------- Submódulo: Gestão de contratos e reequilíbrio ---------- */
  const reequilibrioRows = (reequilibrioRes.data ?? []) as Record<string, unknown>[];
  const contratosReq = reequilibrioRows.map((row) => {
    const res = (row["resultado_json"] ?? {}) as {
      atual?: { precoContrato?: number; margemPrestador?: number; custoLiquidoContratante?: number };
      semReequilibrio?: { margemPrestador?: number };
      cenarioEscolhido?: string;
      cenarios?: {
        id?: string;
        precoSugerido?: number;
        variacaoPrecoPct?: number;
        detalhe?: { custoLiquidoContratante?: number };
      }[];
    };
    const escolhido =
      res.cenarios?.find((c) => c.id === (res.cenarioEscolhido ?? row["cenario"])) ?? res.cenarios?.[2];
    return {
      titulo: String(row["titulo"] ?? "Contrato de prestação continuada"),
      contraparte: (row["contraparte"] as string | null) ?? null,
      papel: String(row["papel"] ?? "prestador"),
      regime: String(row["regime_prestador"] ?? ""),
      perfilContratante: String(row["perfil_contratante"] ?? ""),
      cenario: String(res.cenarioEscolhido ?? row["cenario"] ?? ""),
      status: String(row["status"] ?? "a_revisar"),
      ano: num(row["ano_referencia"]),
      precoAtual: num(res.atual?.precoContrato ?? row["preco_mensal_atual"]),
      precoSugerido: num(escolhido?.precoSugerido),
      variacaoPrecoPct: num(escolhido?.variacaoPrecoPct),
      margemAtual: num(res.atual?.margemPrestador),
      margemSemReequilibrio: num(res.semReequilibrio?.margemPrestador),
      custoContratanteAtual: num(res.atual?.custoLiquidoContratante),
      custoContratanteSugerido: num(escolhido?.detalhe?.custoLiquidoContratante),
    };
  });
  const somaReq = (pick: (c: (typeof contratosReq)[number]) => number) =>
    contratosReq.reduce((a, c) => a + pick(c), 0);
  const reqAtual = somaReq((c) => c.precoAtual);
  const reqSugerido = somaReq((c) => c.precoSugerido);
  const reqMargemAtual = somaReq((c) => c.margemAtual);
  const reqMargemSem = somaReq((c) => c.margemSemReequilibrio);
  const contratosSnap =
    contratosReq.length > 0
      ? {
          contratos: contratosReq,
          totalAtual: reqAtual,
          totalSugerido: reqSugerido,
          variacaoPrecoPct: reqAtual > 0 ? ((reqSugerido - reqAtual) / reqAtual) * 100 : 0,
          margemAtual: reqMargemAtual,
          margemSemReequilibrio: reqMargemSem,
          variacaoMargemPct:
            reqMargemAtual > 0 ? ((reqMargemSem - reqMargemAtual) / reqMargemAtual) * 100 : 0,
        }
      : undefined;

  if (contratosSnap) limitacoes.push(LIMITACOES.contratos);

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
      detalhes,
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
      clientes: clientesDetalhe,
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
    ...(contratosSnap ? { secContratos: contratosSnap } : {}),
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
  if (contratosSnap) {
    sugestoes["juridico"] = `Renegociar ${contratosSnap.contratos.length} contrato(s) de prestação continuada: sem reequilíbrio, a margem do prestador varia ${contratosSnap.variacaoMargemPct.toFixed(
      1,
    )}% e o preço de equilíbrio soma ${contratosSnap.totalSugerido.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}.`;
  }

  if (aluguelSnap) {
    const prefixo = sugestoes["juridico"] ? `${sugestoes["juridico"]} ` : "";
    sugestoes["juridico"] = `${prefixo}Revisar ${aluguelSnap.contratos.length} contrato(s) de locação: sem repactuação, o resultado do locador varia ${aluguelSnap.variacaoLiquidoPct.toFixed(
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
