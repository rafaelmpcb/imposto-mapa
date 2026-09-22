import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALIQUOTA_PLENA_PADRAO_PCT,
  CRONOGRAMA_PADRAO,
  aliquotaComReducao,
  calcularPrecoNecessarioItem,
  projetarPorAno,
  reducaoDoNbs,
  type PerfilCliente,
} from "@/lib/preco/necessario";

export interface PrecoItemRow {
  id: string;
  tipo: "mercadoria" | "servico";
  codigo: string | null;
  descricao: string | null;
  cliente: string | null;
  cnpjCliente: string | null;
  perfil: PerfilCliente;
  valorItem: number;
  tributosAtuais: number;
  valorDesonerado: number;
  aliquotaPlenaAplicada: number;
  precoNecessario: number;
  variacaoPrecoPct: number;
  status: string;
}

export interface PrecoClienteRow {
  cnpj: string | null;
  nome: string | null;
  perfil: PerfilCliente;
  valorAtual: number;
  precoNecessario: number;
  variacaoMediaPct: number;
  itens: number;
}

export interface PrecoAnoRow {
  ano: number;
  fracao: number;
  valorAtual: number;
  precoNecessario: number;
  variacaoPct: number;
}

const perfilDoRegime = (regime: string | undefined): PerfilCliente =>
  regime === "regular" ? "regular" : regime === "simples" ? "simples" : "nao_classificado";

/** Parâmetros do Caso: alíquota plena e curva de rampa da transição. */
export const getPrecoParametros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: param } = await supabaseAdmin
      .from("parametro_cenario_compras")
      .select("aliquota_ibs_cbs_plena_pct")
      .eq("case_id", data.caseId)
      .maybeSingle();
    const { data: crono } = await supabaseAdmin
      .from("cronograma_transicao_ibscbs")
      .select("ano,fracao_aliquota_plena,case_id")
      .or(`case_id.eq.${data.caseId},case_id.is.null`);
    const linhas = (crono ?? []) as {
      ano: number;
      fracao_aliquota_plena: number;
      case_id: string | null;
    }[];
    const doCaso = linhas.filter((l) => l.case_id === data.caseId);
    const base = doCaso.length > 0 ? doCaso : linhas.filter((l) => l.case_id === null);
    const cronograma =
      base.length > 0
        ? base
            .map((l) => ({ ano: Number(l.ano), fracao: Number(l.fracao_aliquota_plena) }))
            .sort((a, b) => a.ano - b.ano)
        : CRONOGRAMA_PADRAO;
    return {
      ok: true as const,
      aliquotaPlenaPct: Number(
        (param as { aliquota_ibs_cbs_plena_pct?: number } | null)?.aliquota_ibs_cbs_plena_pct ??
          ALIQUOTA_PLENA_PADRAO_PCT,
      ),
      personalizado: doCaso.length > 0,
      cronograma,
    };
  });

/** Salva a alíquota plena e a curva de rampa do Caso. */
export const salvarPrecoParametros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      aliquotaPlenaPct: number;
      cronograma: { ano: number; fracao: number }[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin
      .from("parametro_cenario_compras")
      .upsert(
        {
          case_id: data.caseId,
          aliquota_ibs_cbs_plena_pct: data.aliquotaPlenaPct,
        } as never,
        { onConflict: "case_id" },
      );
    if (up.error) throw new Error(up.error.message);

    await supabaseAdmin
      .from("cronograma_transicao_ibscbs")
      .delete()
      .eq("case_id", data.caseId);
    if (data.cronograma.length > 0) {
      const ins = await supabaseAdmin.from("cronograma_transicao_ibscbs").insert(
        data.cronograma.map((c) => ({
          case_id: data.caseId,
          ano: c.ano,
          fracao_aliquota_plena: c.fracao,
        })) as never,
      );
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true as const };
  });

/**
 * Calcula e grava o preço necessário de cada item de venda (mercadoria e
 * serviço prestado) do Caso, junto com a projeção por ano da transição.
 */
export const calcularPrecoNecessario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // parâmetros do Caso
    const { data: param } = await supabaseAdmin
      .from("parametro_cenario_compras")
      .select("aliquota_ibs_cbs_plena_pct")
      .eq("case_id", data.caseId)
      .maybeSingle();
    const plenaPct = Number(
      (param as { aliquota_ibs_cbs_plena_pct?: number } | null)?.aliquota_ibs_cbs_plena_pct ??
        ALIQUOTA_PLENA_PADRAO_PCT,
    );
    const { data: crono } = await supabaseAdmin
      .from("cronograma_transicao_ibscbs")
      .select("ano,fracao_aliquota_plena,case_id")
      .or(`case_id.eq.${data.caseId},case_id.is.null`);
    const linhasCrono = (crono ?? []) as {
      ano: number;
      fracao_aliquota_plena: number;
      case_id: string | null;
    }[];
    const doCaso = linhasCrono.filter((l) => l.case_id === data.caseId);
    const baseCrono = doCaso.length > 0 ? doCaso : linhasCrono.filter((l) => l.case_id === null);
    const cronograma = (
      baseCrono.length > 0
        ? baseCrono.map((l) => ({ ano: Number(l.ano), fracao: Number(l.fracao_aliquota_plena) }))
        : CRONOGRAMA_PADRAO
    ).sort((a, b) => a.ano - b.ano);

    // regime dos clientes na composição de carteira
    const { data: carteira } = await supabaseAdmin
      .from("composicao_carteira")
      .select("cnpj,regime")
      .eq("case_id", data.caseId)
      .eq("tipo", "cliente");
    const regimePorCnpj = new Map<string, string>();
    for (const r of (carteira ?? []) as { cnpj: string; regime: string }[]) {
      regimePorCnpj.set(r.cnpj, r.regime);
    }

    // ---- mercadorias
    const { data: itensMerc } = await supabaseAdmin
      .from("nota_fiscal_venda_xml_item")
      .select("*")
      .eq("case_id", data.caseId)
      .eq("status_classificacao", "ok");
    const merc = (itensMerc ?? []) as Record<string, unknown>[];

    const notaIds = [...new Set(merc.map((i) => String(i["nota_fiscal_venda_xml_id"])))];
    const notas = new Map<string, { nome: string | null; cnpj: string | null }>();
    if (notaIds.length > 0) {
      const { data: cabecalhos } = await supabaseAdmin
        .from("nota_fiscal_venda_xml")
        .select("id,razao_social_destinatario,cnpj_destinatario")
        .in("id", notaIds);
      for (const n of (cabecalhos ?? []) as {
        id: string;
        razao_social_destinatario: string | null;
        cnpj_destinatario: string | null;
      }[]) {
        notas.set(n.id, { nome: n.razao_social_destinatario, cnpj: n.cnpj_destinatario });
      }
    }

    const ncms = [...new Set(merc.map((i) => i["ncm"]).filter(Boolean))] as string[];
    const reducaoPorNcm = new Map<string, number>();
    if (ncms.length > 0) {
      const { data: excecoes } = await supabaseAdmin
        .from("ncm_excecao_ibscbs")
        .select("ncm,reducao_pct")
        .in("ncm", ncms);
      for (const e of (excecoes ?? []) as { ncm: string; reducao_pct: number }[]) {
        const atual = reducaoPorNcm.get(e.ncm);
        if (atual === undefined || Number(e.reducao_pct) < atual) {
          reducaoPorNcm.set(e.ncm, Number(e.reducao_pct));
        }
      }
    }

    // ---- serviços prestados
    const { data: itensServ } = await supabaseAdmin
      .from("nota_servico_nfse_item_prestado")
      .select("*")
      .eq("case_id", data.caseId)
      .eq("status_classificacao", "ok");
    const serv = (itensServ ?? []) as Record<string, unknown>[];

    const servNotaIds = [...new Set(serv.map((i) => String(i["nota_servico_id"])))];
    const servNotas = new Map<string, { nome: string | null; cnpj: string | null }>();
    if (servNotaIds.length > 0) {
      const { data: cabecalhos } = await supabaseAdmin
        .from("nota_servico_nfse")
        .select("id,razao_social_tomador,cnpj_tomador")
        .in("id", servNotaIds);
      for (const n of (cabecalhos ?? []) as {
        id: string;
        razao_social_tomador: string | null;
        cnpj_tomador: string | null;
      }[]) {
        servNotas.set(n.id, { nome: n.razao_social_tomador, cnpj: n.cnpj_tomador });
      }
    }

    const nbsList = [...new Set(serv.map((i) => i["nbs"]).filter(Boolean))] as string[];
    const reducaoPorNbs = new Map<string, number>();
    if (nbsList.length > 0) {
      const { data: excecoes } = await supabaseAdmin
        .from("nbs_excecao_ibscbs")
        .select("nbs,aliquota_ibs_2026,aliquota_cbs_2026")
        .in("nbs", nbsList);
      for (const e of (excecoes ?? []) as {
        nbs: string;
        aliquota_ibs_2026: number;
        aliquota_cbs_2026: number;
      }[]) {
        const red = reducaoDoNbs(e.aliquota_ibs_2026, e.aliquota_cbs_2026);
        const atual = reducaoPorNbs.get(e.nbs);
        if (atual === undefined || red < atual) reducaoPorNbs.set(e.nbs, red);
      }
    }

    const precosMerc: Record<string, unknown>[] = [];
    const precosServ: Record<string, unknown>[] = [];
    const projecoes: Record<string, unknown>[] = [];

    for (const item of merc) {
      const itemId = String(item["id"]);
      const valor = Number(item["valor_item"] ?? 0);
      const reducao = reducaoPorNcm.get(String(item["ncm"] ?? "")) ?? 0;
      const aliquota = aliquotaComReducao(plenaPct, reducao);
      const calc = calcularPrecoNecessarioItem(
        valor,
        [item["valor_icms"], item["valor_ipi"], item["valor_pis"], item["valor_cofins"]].map((v) =>
          Number(v ?? 0),
        ),
        aliquota,
      );
      const nota = notas.get(String(item["nota_fiscal_venda_xml_id"]));
      precosMerc.push({
        case_id: data.caseId,
        item_id: itemId,
        tributos_atuais_total: calc.tributosAtuaisTotal,
        valor_desonerado: calc.valorDesonerado,
        aliquota_plena_aplicada: calc.aliquotaPlenaAplicada,
        preco_necessario: calc.precoNecessario,
        variacao_preco_pct: calc.variacaoPrecoPct,
        regime_cliente_snapshot: nota?.cnpj ? (regimePorCnpj.get(nota.cnpj) ?? null) : null,
        status_preco: calc.status,
      });
      for (const p of projetarPorAno(valor, calc.valorDesonerado, aliquota, cronograma)) {
        projecoes.push({
          case_id: data.caseId,
          item_id: itemId,
          tipo_item: "mercadoria",
          ano: p.ano,
          preco_necessario_ano: p.precoNecessarioAno,
          variacao_preco_pct_ano: p.variacaoPctAno,
        });
      }
    }

    for (const item of serv) {
      const itemId = String(item["id"]);
      const valor = Number(item["valor_servico"] ?? 0);
      const reducao = reducaoPorNbs.get(String(item["nbs"] ?? "")) ?? 0;
      const aliquota = aliquotaComReducao(plenaPct, reducao);
      const calc = calcularPrecoNecessarioItem(valor, [Number(item["valor_iss"] ?? 0)], aliquota);
      const nota = servNotas.get(String(item["nota_servico_id"]));
      precosServ.push({
        case_id: data.caseId,
        item_id: itemId,
        tributos_atuais_total: calc.tributosAtuaisTotal,
        valor_desonerado: calc.valorDesonerado,
        aliquota_plena_aplicada: calc.aliquotaPlenaAplicada,
        preco_necessario: calc.precoNecessario,
        variacao_preco_pct: calc.variacaoPrecoPct,
        regime_cliente_snapshot: nota?.cnpj ? (regimePorCnpj.get(nota.cnpj) ?? null) : null,
        status_preco: calc.status,
      });
      for (const p of projetarPorAno(valor, calc.valorDesonerado, aliquota, cronograma)) {
        projecoes.push({
          case_id: data.caseId,
          item_id: itemId,
          tipo_item: "servico",
          ano: p.ano,
          preco_necessario_ano: p.precoNecessarioAno,
          variacao_preco_pct_ano: p.variacaoPctAno,
        });
      }
    }

    await supabaseAdmin
      .from("preco_necessario_projecao_anual")
      .delete()
      .eq("case_id", data.caseId);
    await supabaseAdmin
      .from("nota_fiscal_venda_xml_item_preco")
      .delete()
      .eq("case_id", data.caseId);
    await supabaseAdmin
      .from("nota_servico_nfse_item_prestado_preco")
      .delete()
      .eq("case_id", data.caseId);

    if (precosMerc.length > 0) {
      const ins = await supabaseAdmin
        .from("nota_fiscal_venda_xml_item_preco")
        .insert(precosMerc as never);
      if (ins.error) throw new Error(ins.error.message);
    }
    if (precosServ.length > 0) {
      const ins = await supabaseAdmin
        .from("nota_servico_nfse_item_prestado_preco")
        .insert(precosServ as never);
      if (ins.error) throw new Error(ins.error.message);
    }
    for (let i = 0; i < projecoes.length; i += 500) {
      const ins = await supabaseAdmin
        .from("preco_necessario_projecao_anual")
        .insert(projecoes.slice(i, i + 500) as never);
      if (ins.error) throw new Error(ins.error.message);
    }

    return {
      ok: true as const,
      itens: precosMerc.length + precosServ.length,
      anos: cronograma.length,
    };
  });

/** Resultado do preço necessário, já agregado para o painel. */
export const getPrecoNecessario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: precoMerc }, { data: precoServ }, { data: projecao }] = await Promise.all([
      supabaseAdmin.from("nota_fiscal_venda_xml_item_preco").select("*").eq("case_id", data.caseId),
      supabaseAdmin
        .from("nota_servico_nfse_item_prestado_preco")
        .select("*")
        .eq("case_id", data.caseId),
      supabaseAdmin
        .from("preco_necessario_projecao_anual")
        .select("ano,preco_necessario_ano,item_id,tipo_item")
        .eq("case_id", data.caseId),
    ]);

    const linhasMerc = (precoMerc ?? []) as Record<string, unknown>[];
    const linhasServ = (precoServ ?? []) as Record<string, unknown>[];
    if (linhasMerc.length === 0 && linhasServ.length === 0) {
      return { ok: true as const, itens: [] as PrecoItemRow[], clientes: [], anos: [] };
    }

    const { data: carteira } = await supabaseAdmin
      .from("composicao_carteira")
      .select("cnpj,regime")
      .eq("case_id", data.caseId)
      .eq("tipo", "cliente");
    const regimePorCnpj = new Map<string, string>();
    for (const r of (carteira ?? []) as { cnpj: string; regime: string }[]) {
      regimePorCnpj.set(r.cnpj, r.regime);
    }

    const itens: PrecoItemRow[] = [];

    if (linhasMerc.length > 0) {
      const ids = linhasMerc.map((l) => String(l["item_id"]));
      const { data: origem } = await supabaseAdmin
        .from("nota_fiscal_venda_xml_item")
        .select("id,ncm,descricao,valor_item,nota_fiscal_venda_xml_id")
        .in("id", ids);
      const origemRows = (origem ?? []) as {
        id: string;
        ncm: string | null;
        descricao: string | null;
        valor_item: number;
        nota_fiscal_venda_xml_id: string;
      }[];
      const notaIds = [...new Set(origemRows.map((o) => o.nota_fiscal_venda_xml_id))];
      const notas = new Map<string, { nome: string | null; cnpj: string | null }>();
      if (notaIds.length > 0) {
        const { data: cab } = await supabaseAdmin
          .from("nota_fiscal_venda_xml")
          .select("id,razao_social_destinatario,cnpj_destinatario")
          .in("id", notaIds);
        for (const n of (cab ?? []) as {
          id: string;
          razao_social_destinatario: string | null;
          cnpj_destinatario: string | null;
        }[]) {
          notas.set(n.id, { nome: n.razao_social_destinatario, cnpj: n.cnpj_destinatario });
        }
      }
      const porId = new Map(origemRows.map((o) => [o.id, o]));
      for (const l of linhasMerc) {
        const o = porId.get(String(l["item_id"]));
        if (!o) continue;
        const nota = notas.get(o.nota_fiscal_venda_xml_id);
        itens.push({
          id: o.id,
          tipo: "mercadoria",
          codigo: o.ncm,
          descricao: o.descricao,
          cliente: nota?.nome ?? null,
          cnpjCliente: nota?.cnpj ?? null,
          perfil: perfilDoRegime(nota?.cnpj ? regimePorCnpj.get(nota.cnpj) : undefined),
          valorItem: Number(o.valor_item ?? 0),
          tributosAtuais: Number(l["tributos_atuais_total"] ?? 0),
          valorDesonerado: Number(l["valor_desonerado"] ?? 0),
          aliquotaPlenaAplicada: Number(l["aliquota_plena_aplicada"] ?? 0),
          precoNecessario: Number(l["preco_necessario"] ?? 0),
          variacaoPrecoPct: Number(l["variacao_preco_pct"] ?? 0),
          status: String(l["status_preco"] ?? "ok"),
        });
      }
    }

    if (linhasServ.length > 0) {
      const ids = linhasServ.map((l) => String(l["item_id"]));
      const { data: origem } = await supabaseAdmin
        .from("nota_servico_nfse_item_prestado")
        .select("id,nbs,descricao,valor_servico,nota_servico_id")
        .in("id", ids);
      const origemRows = (origem ?? []) as {
        id: string;
        nbs: string | null;
        descricao: string | null;
        valor_servico: number;
        nota_servico_id: string;
      }[];
      const notaIds = [...new Set(origemRows.map((o) => o.nota_servico_id))];
      const notas = new Map<string, { nome: string | null; cnpj: string | null }>();
      if (notaIds.length > 0) {
        const { data: cab } = await supabaseAdmin
          .from("nota_servico_nfse")
          .select("id,razao_social_tomador,cnpj_tomador")
          .in("id", notaIds);
        for (const n of (cab ?? []) as {
          id: string;
          razao_social_tomador: string | null;
          cnpj_tomador: string | null;
        }[]) {
          notas.set(n.id, { nome: n.razao_social_tomador, cnpj: n.cnpj_tomador });
        }
      }
      const porId = new Map(origemRows.map((o) => [o.id, o]));
      for (const l of linhasServ) {
        const o = porId.get(String(l["item_id"]));
        if (!o) continue;
        const nota = notas.get(o.nota_servico_id);
        itens.push({
          id: o.id,
          tipo: "servico",
          codigo: o.nbs,
          descricao: o.descricao,
          cliente: nota?.nome ?? null,
          cnpjCliente: nota?.cnpj ?? null,
          perfil: perfilDoRegime(nota?.cnpj ? regimePorCnpj.get(nota.cnpj) : undefined),
          valorItem: Number(o.valor_servico ?? 0),
          tributosAtuais: Number(l["tributos_atuais_total"] ?? 0),
          valorDesonerado: Number(l["valor_desonerado"] ?? 0),
          aliquotaPlenaAplicada: Number(l["aliquota_plena_aplicada"] ?? 0),
          precoNecessario: Number(l["preco_necessario"] ?? 0),
          variacaoPrecoPct: Number(l["variacao_preco_pct"] ?? 0),
          status: String(l["status_preco"] ?? "ok"),
        });
      }
    }

    // resumo por cliente
    const porCliente = new Map<string, PrecoClienteRow>();
    for (const i of itens) {
      const chave = i.cnpjCliente ?? `sem-cnpj:${i.cliente ?? "—"}`;
      const atual = porCliente.get(chave) ?? {
        cnpj: i.cnpjCliente,
        nome: i.cliente,
        perfil: i.perfil,
        valorAtual: 0,
        precoNecessario: 0,
        variacaoMediaPct: 0,
        itens: 0,
      };
      atual.valorAtual += i.valorItem;
      atual.precoNecessario += i.precoNecessario;
      atual.itens += 1;
      if (!atual.nome && i.cliente) atual.nome = i.cliente;
      porCliente.set(chave, atual);
    }
    const clientes = [...porCliente.values()]
      .map((c) => ({
        ...c,
        valorAtual: Math.round(c.valorAtual * 100) / 100,
        precoNecessario: Math.round(c.precoNecessario * 100) / 100,
        variacaoMediaPct:
          c.valorAtual > 0 ? (c.precoNecessario - c.valorAtual) / c.valorAtual : 0,
      }))
      .sort((a, b) => b.precoNecessario - a.precoNecessario);

    // série por ano
    const valorAtualTotal = itens.reduce((acc, i) => acc + i.valorItem, 0);
    const porAno = new Map<number, number>();
    for (const p of (projecao ?? []) as { ano: number; preco_necessario_ano: number }[]) {
      porAno.set(Number(p.ano), (porAno.get(Number(p.ano)) ?? 0) + Number(p.preco_necessario_ano));
    }
    const anos: PrecoAnoRow[] = [...porAno.entries()]
      .map(([ano, preco]) => ({
        ano,
        fracao: 0,
        valorAtual: Math.round(valorAtualTotal * 100) / 100,
        precoNecessario: Math.round(preco * 100) / 100,
        variacaoPct: valorAtualTotal > 0 ? (preco - valorAtualTotal) / valorAtualTotal : 0,
      }))
      .sort((a, b) => a.ano - b.ano);

    return { ok: true as const, itens, clientes, anos };
  });
