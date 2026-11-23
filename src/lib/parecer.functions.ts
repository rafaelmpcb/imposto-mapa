import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { estaPendente, EXCLUIDO_ANALISTA } from "@/lib/apuracao/liquido";
import { computeDre } from "@/lib/dre.functions";
import { sugerirAchados } from "@/lib/parecer/compilar";
import { CRONOGRAMA_PADRAO } from "@/lib/preco/necessario";
import { fetchAllRows } from "@/lib/supabase-paginate";
import type { YearId } from "@/lib/tax/constants";
import { CBS_SHARE, REFERENCE_RATE } from "@/lib/tax/constants";
import {
  LIMITACOES,
  type CaseEscopo,
  type FornecedorDetalheSnap,
  type ParecerEdicoes,
  type ParecerSnapshot,
  type ParecerStatus,
  type ParecerVersao,
  type ServicoTomadoSnap,
} from "@/lib/parecer/tipos";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const num = (v: unknown) => Number(v ?? 0) || 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

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
  const [notas, itens] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_compra_xml")
        .select(
          "id,chave_acesso,numero_nota,serie,data_emissao,valor_total,cnpj_emitente,razao_social_emitente",
        )
        .eq("case_id", caseId)
        .eq("status_processamento", "ok")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_compra_xml_item")
        .select(
          "nota_fiscal_compra_xml_id,ncm,descricao,valor_item,valor_base_calculo,valor_credito_ibs_cbs,status_classificacao",
        )
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
  ]);

  if (notas.length === 0) return [];

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
    // Mesmo motivo do compilarDetalheClientes: agrupa pela raiz do CNPJ, não
    // pelo CNPJ completo, para matriz e filiais do mesmo fornecedor não
    // virarem "fornecedores" separados.
    const chave = cnpj ? cnpj.slice(0, 8) : (nome ?? "sem identificação");
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
  const [vendas, vendaItens, nfse, nfseItens, carteira] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_venda_xml")
        .select(
          "id,chave_acesso,numero_nota,serie,data_emissao,valor_total,cnpj_destinatario,razao_social_destinatario",
        )
        .eq("case_id", caseId)
        .eq("status_processamento", "ok")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_venda_xml_item")
        .select(
          "nota_fiscal_venda_xml_id,ncm,descricao,valor_item,valor_base_calculo,valor_debito_ibs_cbs,status_classificacao",
        )
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_servico_nfse")
        .select(
          "id,chave_acesso,numero_nota,serie,data_emissao,valor_total,cnpj_tomador,razao_social_tomador",
        )
        .eq("case_id", caseId)
        .eq("direcao", "prestado")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_servico_nfse_item_prestado")
        .select(
          "nota_servico_id,nbs,descricao,valor_servico,valor_base_calculo,valor_debito_ibs_cbs,status_classificacao",
        )
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("composicao_carteira")
        .select("id,cnpj,regime")
        .eq("case_id", caseId)
        .eq("tipo", "cliente")
        .order("id")
        .range(from, to),
    ),
  ]);
  const vendasRes = { data: vendas };
  const vendaItensRes = { data: vendaItens };
  const nfseRes = { data: nfse };
  const nfseItensRes = { data: nfseItens };

  const regimePorCnpj = new Map<string, string>();
  for (const r of carteira) {
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
    // Agrupa pela raiz do CNPJ (8 primeiros dígitos = mesma empresa), não
    // pelo CNPJ completo — senão matriz e cada filial entram como "clientes"
    // separados (ex.: a mesma rede aparecendo 3x com 3 CNPJs diferentes).
    const chave = cnpj ? cnpj.slice(0, 8) : (nome ?? "sem identificação");
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

/**
 * Carga por tributo individual (ICMS, IPI, PIS/COFINS, ISS — hoje — x
 * IBS/CBS — reforma), separada em compras e vendas. Mesma pergunta que
 * "quanto mudou no total", só que aberta imposto a imposto: serve pra
 * sustentar o número diante do cliente quando ele perguntar "de onde vem
 * essa diferença". Os valores "de hoje" já estavam sendo lidos do XML desde
 * sempre (NfeItem.vICMS/vIPI/vPIS/vCOFINS, NfseServicoItem.vISS/vPIS/vCOFINS)
 * mas nunca tinham sido persistidos nem agregados — só o IBS/CBS (a coluna
 * de crédito/débito) chegava até aqui.
 *
 * "Depois" usa a mesma fração de transição do ano (hoje*(1−f) + pleno*f) que
 * a DRE (Seção 6) usa para montar "deducoes"/"custo" — a mesma resolução de
 * rampa de dre.functions.ts (override do Caso em cronograma_transicao_ibscbs,
 * senão o cronograma global, senão CRONOGRAMA_PADRAO) — assim a soma das
 * linhas aqui bate com o valor da DRE do mesmo ano, em vez de mostrar sempre
 * o regime pleno (2033) independente do ano selecionado no relatório.
 */
async function compilarCargaPorTributo(
  admin: Admin,
  caseId: string,
): Promise<ParecerSnapshot["secCargaTributaria"]> {
  // Mesmo filtro de válido que a DRE (dre.functions.ts) usa: item pendente de
  // revisão ou excluído pelo analista fica fora da soma nos dois lugares —
  // senão a carga por tributo conta itens que a DRE já não está contando.
  const somar = (rows: Record<string, unknown>[], col: string) =>
    rows.reduce((a, r) => {
      const status = String(r["status_classificacao"] ?? "");
      if (estaPendente(status) || status === EXCLUIDO_ANALISTA) return a;
      return a + num(r[col]);
    }, 0);

  const [comprasNfe, vendasNfe, servTomado, servPrestado, cronoRes] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_compra_xml_item")
        .select("valor_icms,valor_ipi,valor_pis,valor_cofins,valor_credito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_venda_xml_item")
        .select("valor_icms,valor_ipi,valor_pis,valor_cofins,valor_debito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_servico_nfse_item")
        .select("valor_iss,valor_pis,valor_cofins,valor_credito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_servico_nfse_item_prestado")
        .select("valor_iss,valor_pis,valor_cofins,valor_debito_ibs_cbs,status_classificacao")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    admin
      .from("cronograma_transicao_ibscbs")
      .select("ano,fracao_aliquota_plena,case_id")
      .or(`case_id.eq.${caseId},case_id.is.null`),
  ]);

  const cronoLinhas = ((cronoRes.data ?? []) as Record<string, unknown>[]).map((l) => ({
    ano: Number(l["ano"]),
    fracao: Number(l["fracao_aliquota_plena"]),
    doCaso: l["case_id"] === caseId,
  }));
  const proprios = cronoLinhas.filter((l) => l.doCaso);
  const baseRampa = proprios.length > 0 ? proprios : cronoLinhas.filter((l) => !l.doCaso);
  const rampa = baseRampa.length > 0 ? baseRampa : CRONOGRAMA_PADRAO.map((c) => ({ ...c, doCaso: false }));
  const fracaoPorAno = new Map<number, number>(rampa.map((r) => [r.ano, r.fracao]));
  if (!fracaoPorAno.has(2026)) fracaoPorAno.set(2026, 0);

  const linha = (
    tributo: string,
    antes: number,
    depois: number,
  ): { tributo: string; antes: number; depois: number } => ({
    tributo,
    antes: round2(antes),
    depois: round2(depois),
  });

  const pleno = {
    comprasIcms: somar(comprasNfe, "valor_icms"),
    comprasIpi: somar(comprasNfe, "valor_ipi"),
    comprasPisCofins:
      somar(comprasNfe, "valor_pis") +
      somar(comprasNfe, "valor_cofins") +
      somar(servTomado, "valor_pis") +
      somar(servTomado, "valor_cofins"),
    comprasIss: somar(servTomado, "valor_iss"),
    comprasIbsCbs: somar(comprasNfe, "valor_credito_ibs_cbs") + somar(servTomado, "valor_credito_ibs_cbs"),
    vendasIcms: somar(vendasNfe, "valor_icms"),
    vendasIpi: somar(vendasNfe, "valor_ipi"),
    // A DRE (dre.functions.ts) só conta PIS/COFINS de mercadoria na dedução —
    // em serviço prestado/tomado ela usa só o ISS, não soma valor_pis/
    // valor_cofins do NFS-e. Para a tabela bater com o total da DRE, a parte
    // de serviço entra como linha à parte, sem entrar na troca por IBS/CBS.
    vendasPisCofinsMercadoria: somar(vendasNfe, "valor_pis") + somar(vendasNfe, "valor_cofins"),
    vendasPisCofinsServico: somar(servPrestado, "valor_pis") + somar(servPrestado, "valor_cofins"),
    vendasIss: somar(servPrestado, "valor_iss"),
    vendasIbsCbs: somar(vendasNfe, "valor_debito_ibs_cbs") + somar(servPrestado, "valor_debito_ibs_cbs"),
  };

  // Nas compras, ao contrário das vendas, o tributo antigo (ICMS/PIS/COFINS/
  // ISS) não "sai" da conta ano a ano — ele continua embutido no preço pago
  // ao fornecedor, igual na DRE (custo = custoCompras − créditoPleno×f, sem
  // desconto do tributo antigo). O que muda de fato é só o crédito de
  // IBS/CBS que a empresa passa a recuperar, crescendo com a fração do ano.
  const montarDoAno = (f: number) => {
    const compras = [
      linha("ICMS", pleno.comprasIcms, pleno.comprasIcms),
      linha("IPI", pleno.comprasIpi, pleno.comprasIpi),
      linha("PIS/COFINS", pleno.comprasPisCofins, pleno.comprasPisCofins),
      linha("ISS", pleno.comprasIss, pleno.comprasIss),
      linha("IBS/CBS (crédito recuperável)", 0, pleno.comprasIbsCbs * f),
    ].filter((l) => l.antes > 0 || l.depois > 0);
    const vendas = [
      linha("ICMS", pleno.vendasIcms, pleno.vendasIcms * (1 - f)),
      linha("IPI", pleno.vendasIpi, pleno.vendasIpi * (1 - f)),
      linha("PIS/COFINS (mercadorias)", pleno.vendasPisCofinsMercadoria, pleno.vendasPisCofinsMercadoria * (1 - f)),
      linha("PIS/COFINS (serviços)", pleno.vendasPisCofinsServico, pleno.vendasPisCofinsServico),
      linha("ISS", pleno.vendasIss, pleno.vendasIss * (1 - f)),
      linha("IBS/CBS (reforma)", 0, pleno.vendasIbsCbs * f),
    ].filter((l) => l.antes > 0 || l.depois > 0);
    return { compras, vendas };
  };

  const anosOrdenados = [...fracaoPorAno.keys()].sort((a, b) => a - b);
  const porAno = anosOrdenados.map((ano) => ({ ano, ...montarDoAno(fracaoPorAno.get(ano) ?? 0) }));
  const doAnoBase = porAno[0] ?? montarDoAno(0);

  return { compras: doAnoBase.compras, vendas: doAnoBase.vendas, porAno };
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
    fluxoRes,
    comprasRes,
    vendasRes,
    servicosRes,
    precoMerc,
    precoServ,
    precoAno,
    contratosRes,
    reequilibrioRes,
    carteiraRes,
    spedRes,
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
    admin
      .from("fluxo_caixa_projecao_mensal")
      .select("*")
      .eq("case_id", caseId)
      .order("ano")
      .order("mes"),
    admin.from("vw_concentracao_compras_ncm").select("*").eq("case_id", caseId),
    admin.from("vw_concentracao_vendas_ncm").select("*").eq("case_id", caseId),
    admin.from("vw_concentracao_servicos_nbs").select("*").eq("case_id", caseId),
    // O PostgREST limita toda resposta a 1000 linhas mesmo com .limit() maior
    // (config. do projeto) — um caso real com centenas de itens × vários anos
    // de projeção passa disso fácil (ex.: 505 itens × 7 anos = 3.535 linhas),
    // então pagina de verdade em vez de só pedir um limite maior. Antes disso,
    // sumiam os anos finais da rampa (2029-2033) do relatório em silêncio.
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_fiscal_venda_xml_item_preco")
        .select("*")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("nota_servico_nfse_item_prestado_preco")
        .select("*")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      admin
        .from("preco_necessario_projecao_anual")
        .select("*")
        .eq("case_id", caseId)
        .order("id")
        .range(from, to),
    ),
    admin.from("contrato_aluguel").select("*").eq("case_id", caseId).order("created_at"),
    admin.from("contrato_reequilibrio").select("*").eq("case_id", caseId).order("created_at"),
    admin
      .from("composicao_carteira")
      .select("cnpj,nome,regime,tipo,valor_movimentado,servico_tomado")
      .eq("case_id", caseId)
      .eq("tipo", "fornecedor"),
    admin
      .from("sped_apuracao" as never)
      .select("tipo,periodo_ini,resumo")
      .eq("case_id" as never, caseId as never)
      .order("periodo_ini" as never),
  ]);
  const precoMercRes = { data: precoMerc };
  const precoServRes = { data: precoServ };
  const precoAnoRes = { data: precoAno };

  // DRE calculado agora, não lido de uma foto gravada antes — senão o
  // relatório mostra receita/despesa de antes do último upload de notas até
  // alguém abrir a aba DRE e disparar o recálculo que grava essa tabela.
  const dreCalculado = await computeDre(admin, caseId);

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
  if (dreCalculado.linhas.length > 0) limitacoes.push(LIMITACOES.dre);
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
    // Mesmo motivo das outras agregações por CNPJ neste arquivo: agrupa pela
    // raiz (matriz + filiais = mesma empresa), não pelo CNPJ completo.
    const chaveF = cnpj ? cnpj.slice(0, 8) : String(r["nome_contraparte"] ?? "sem identificação");
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

  /* ---------- Seção 4c: serviços tomados (XML apurado + planilha estimada) ----------
   * vw_concentracao_servicos_nbs já traz tomado e prestado juntos (campo
   * "direcao"); aqui só o lado tomado interessa. A planilha de contas a
   * pagar (composicao_carteira.servico_tomado = true) cobre o fornecedor que
   * não tem XML. Só valor e regime são apurados aqui — o crédito em si é
   * calculado na tela, ano a ano (a aba "Serviços tomados" depende do ano
   * selecionado), pela mesma alíquota de IBS/CBS do motor de regimes.
   * Quando o mesmo fornecedor aparece nos dois, o XML prevalece.
   */
  const porFornecedorServico = new Map<string, ServicoTomadoSnap>();
  for (const r of (servicosRes.data ?? []) as Record<string, unknown>[]) {
    if (r["direcao"] !== "tomado") continue;
    const cnpj = (r["cnpj_contraparte"] as string | null) ?? null;
    const chave = cnpj ? cnpj.slice(0, 8) : String(r["nome_contraparte"] ?? "sem identificação");
    const f = porFornecedorServico.get(chave) ?? {
      cnpj,
      nome: (r["nome_contraparte"] as string | null) ?? null,
      valorBase: 0,
      regime: cnpj ? (regimePorCnpj.get(cnpj.replace(/\D/g, "")) ?? null) : null,
      fonte: "xml" as const,
    };
    f.valorBase += num(r["valor_base_total"]);
    porFornecedorServico.set(chave, f);
  }
  for (const r of (carteiraRes.data ?? []) as Record<string, unknown>[]) {
    if (r["servico_tomado"] !== true) continue;
    const cnpjDigits = String(r["cnpj"] ?? "").replace(/\D/g, "");
    const cnpj = cnpjDigits || null;
    const chave = cnpj ? cnpj.slice(0, 8) : String(r["nome"] ?? "sem identificação");
    if (porFornecedorServico.has(chave)) continue;
    porFornecedorServico.set(chave, {
      cnpj,
      nome: (r["nome"] as string | null) ?? null,
      valorBase: num(r["valor_movimentado"]),
      regime: String(r["regime"] ?? "pendente"),
      fonte: "planilha",
    });
  }
  const servicosTomadosTodos = [...porFornecedorServico.values()];
  const servicosTomadosFornecedores = servicosTomadosTodos
    .slice()
    .sort((a, b) => b.valorBase - a.valorBase)
    .slice(0, 50);
  const servicosTomadosBaseTotal = servicosTomadosTodos.reduce((a, f) => a + f.valorBase, 0);

  /* ---------- Seção 5b: clientes e crédito transferido ---------- */
  const clientesDetalhe = await compilarDetalheClientes(admin, caseId);

  /* ---------- Carga por tributo individual (compras e vendas) ---------- */
  const cargaTributaria = await compilarCargaPorTributo(admin, caseId);

  /* ---------- Seção 5: preço necessário ---------- */
  const precoRows = [
    ...((precoMercRes.data ?? []) as Record<string, unknown>[]),
    ...((precoServRes.data ?? []) as Record<string, unknown>[]),
  ];
  const desoneradoTotal = precoRows.reduce((a, r) => a + num(r["valor_desonerado"]), 0);
  const tributosAtuaisTotal = precoRows.reduce((a, r) => a + num(r["tributos_atuais_total"]), 0);
  const valorAtual = desoneradoTotal + tributosAtuaisTotal;
  const precoNecessarioTotal = precoRows.reduce((a, r) => a + num(r["preco_necessario"]), 0);
  const variacaoMediaPct =
    precoRows.length > 0
      ? precoRows.reduce((a, r) => a + num(r["variacao_preco_pct"]), 0) / precoRows.length
      : 0;
  // Média ponderada pelo valor líquido de cada item, em vez de reconstruída a
  // partir de só 2 pontos da rampa anual (que falha quando esses 2 pontos têm
  // a mesma fração, como 2027/2028 antes de a rampa do IBS começar em 2029).
  const aliquotaPlenaMedia =
    desoneradoTotal > 0
      ? precoRows.reduce(
          (a, r) => a + num(r["aliquota_plena_aplicada"]) * num(r["valor_desonerado"]),
          0,
        ) / desoneradoTotal
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
  const dreLinhas = dreCalculado.linhas.map((l) => ({
    ano: l.ano,
    cenario: l.cenario,
    receitaBruta: l.receitaBruta,
    deducoes: l.deducoes,
    receitaLiquida: l.receitaLiquida,
    custo: l.custo,
    lucroBruto: l.lucroBruto,
    despesas: l.despesasOperacionais,
    resultadoAntesIrcs: l.resultadoAntesIrcs,
    ircs: l.ircs,
    resultadoLiquido: l.resultadoLiquido,
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
  let cenariosPorAno: ParecerSnapshot["sec8"]["porAno"] = [];
  let atualHojeXReforma: ParecerSnapshot["sec8"]["atualHojeXReforma"] = null;
  let atualHojeXReformaPorAno: ParecerSnapshot["sec8"]["atualHojeXReformaPorAno"] = [];
  let ponteLucroRealPorAno: ParecerSnapshot["sec8"]["ponteLucroRealPorAno"] = [];
  let anoBase: number | null = null;
  if (sim) {
    const { compareRegimes, defaultInput, simulate, DEFAULT_PROFIT_MARGIN } = await import("@/lib/tax/calc");
    const { TRANSITION_YEARS } = await import("@/lib/tax/constants");
    const { categorizarLinhas } = await import("@/lib/parecer/impostos");
    const year = num(sim["year_id"]) as YearId;
    anoBase = year;
    try {
      const input = { ...defaultInput(), ...(simInput as object) } as Parameters<typeof compareRegimes>[0];
      const mapear = (ano: YearId) =>
        compareRegimes(input, ano).map((item) => ({
          label: item.label,
          total: item.total,
          rate: item.rate,
          atual: item.isCurrent,
          ...(item.estimateNote ? { nota: item.estimateNote } : {}),
          porImposto: categorizarLinhas(item.lines),
        }));
      cenarios = mapear(year);
      // Recalcula a mesma comparação para cada ano da transição — a aba
      // "Regimes" do relatório tem seletor de ano (igual ao simulador
      // simples) e precisa reagir a ele, não mostrar sempre o ano em que a
      // simulação original foi rodada.
      cenariosPorAno = TRANSITION_YEARS.map(({ id: ano }) => ({ ano, cenarios: mapear(ano) }));

      // Comparação "hoje x reforma" do regime atual — mesma leitura de
      // simulate() que o simulador simples usa na tela de resultado, só que
      // recalculada aqui para alimentar o relatório.
      const mapearAtual = (ano: YearId) => {
        const r = simulate(input, ano);
        return {
          ano,
          hoje: { total: r.current.total, rate: r.current.rate },
          reforma: { total: r.reform.total, rate: r.reform.rate },
        };
      };
      atualHojeXReformaPorAno = TRANSITION_YEARS.map(({ id: ano }) => mapearAtual(ano));
      const doAnoBase = atualHojeXReformaPorAno.find((a) => a.ano === year);
      atualHojeXReforma = doAnoBase ? { hoje: doAnoBase.hoje, reforma: doAnoBase.reforma } : null;

      // Ponte "hoje x com a reforma" do Lucro Real especificamente — mesma
      // estimativa de margem que compareRegimes() usa quando o Real não é o
      // regime atual, para alimentar o gráfico de cascata.
      const realInput: typeof input =
        input.taxpayerType === "real"
          ? input
          : {
              ...input,
              taxpayerType: "real",
              profitMargin:
                Number.isFinite(input.profitMargin) && input.profitMargin > 0
                  ? Math.min(100, input.profitMargin)
                  : DEFAULT_PROFIT_MARGIN,
            };
      ponteLucroRealPorAno = TRANSITION_YEARS.map(({ id: ano }) => {
        const r = simulate(realInput, ano);
        return {
          ano,
          hojeTotal: r.current.total,
          reformaTotal: r.reform.total,
          hoje: categorizarLinhas(r.current.lines),
          reforma: categorizarLinhas(r.reform.lines),
        };
      });
    } catch {
      cenarios = [];
      cenariosPorAno = [];
      atualHojeXReforma = null;
      atualHojeXReformaPorAno = [];
      ponteLucroRealPorAno = [];
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

  /* ---------- Submódulo: Saldo credor acumulado (ICMS e PIS/COFINS) ---------- */
  // Só traz o saldo declarado no SPED — o cronograma das 240 parcelas e a
  // comparação com cessão a terceiro (src/lib/saldos/calculo.ts) rodam no
  // cliente, a partir deste número e das premissas editáveis do analista.
  const spedRows = (spedRes.data ?? []) as {
    tipo: "icms_ipi" | "contribuicoes";
    periodo_ini: string;
    resumo: {
      icms?: { saldoCredorTransportar?: number };
      contrib?: {
        regime?: "nao_cumulativo" | "cumulativo" | "misto" | null;
        pis?: { saldoCredorFinal?: number };
        cofins?: { saldoCredorFinal?: number };
      };
    };
  }[];
  const periodoChave = (iso: string) => iso.slice(0, 7); // YYYY-MM
  const porPeriodoMap = new Map<string, { saldoIcms: number | null; saldoPisCofins: number | null }>();
  for (const row of spedRows) {
    const chave = periodoChave(row.periodo_ini);
    const atual = porPeriodoMap.get(chave) ?? { saldoIcms: null, saldoPisCofins: null };
    if (row.tipo === "icms_ipi") {
      atual.saldoIcms = num(row.resumo?.icms?.saldoCredorTransportar);
    } else {
      atual.saldoPisCofins =
        num(row.resumo?.contrib?.pis?.saldoCredorFinal) + num(row.resumo?.contrib?.cofins?.saldoCredorFinal);
    }
    porPeriodoMap.set(chave, atual);
  }
  const porPeriodo = [...porPeriodoMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, v]) => ({ periodo, ...v }));
  const ultimoIcms = spedRows.filter((r) => r.tipo === "icms_ipi").at(-1);
  const ultimoContrib = spedRows.filter((r) => r.tipo === "contribuicoes").at(-1);
  // CBS devida por mês, aproximada pela fatia CBS_SHARE do débito combinado
  // de IBS+CBS que o fluxo de caixa (Seção 7) já projeta — o motor nunca
  // separa CBS de IBS, então isto é uma estimativa proporcional, não um
  // valor exato de CBS isolado.
  const cbsShareDoCombinado = REFERENCE_RATE > 0 ? CBS_SHARE / REFERENCE_RATE : 0;
  const cbsMensal = meses
    .map((m) => ({
      ano: num(m["ano"]),
      mes: num(m["mes"]),
      valor: num(m["debito_ibscbs_retido"]) * cbsShareDoCombinado,
    }))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    .map((m) => ({ periodo: `${m.ano}-${String(m.mes).padStart(2, "0")}`, valor: m.valor }));
  const saldoCredorSnap =
    spedRows.length > 0
      ? {
          saldoIcmsAtual: num(ultimoIcms?.resumo?.icms?.saldoCredorTransportar),
          saldoPisCofinsAtual:
            num(ultimoContrib?.resumo?.contrib?.pis?.saldoCredorFinal) +
            num(ultimoContrib?.resumo?.contrib?.cofins?.saldoCredorFinal),
          competenciaIcms: ultimoIcms ? periodoChave(ultimoIcms.periodo_ini) : null,
          competenciaPisCofins: ultimoContrib ? periodoChave(ultimoContrib.periodo_ini) : null,
          porPeriodo,
          cbsMensal,
        }
      : undefined;

  if (saldoCredorSnap) limitacoes.push(LIMITACOES.saldoCredor);

  /* ---------- Cruzamento: regime de PIS/COFINS declarado no SPED x o
   * assumido na simulação. Se a empresa apurou PIS/COFINS de um jeito e a
   * simulação rodou assumindo outro (ex.: SPED diz cumulativo, simulação
   * assumiu Lucro Real = não cumulativo), as alíquotas de PIS/COFINS usadas
   * na comparação de regimes estão erradas para essa empresa. Só compara
   * quando o regime do Caso é Presumido ou Real — Simples/MEI/PF não têm
   * esse paralelo direto com o regime do SPED de Contribuições. ---------- */
  const regimeSpedContrib = ultimoContrib?.resumo?.contrib?.regime;
  let avisoRegimeSped: string | null = null;
  if (regimeSpedContrib && regimeSpedContrib !== "misto" && sim) {
    const tipo = String(sim["taxpayer_type"]);
    const esperado = tipo === "real" ? "nao_cumulativo" : tipo === "presumido" ? "cumulativo" : null;
    if (esperado && regimeSpedContrib !== esperado) {
      const rotulo = (r: string) => (r === "nao_cumulativo" ? "não cumulativo" : "cumulativo");
      avisoRegimeSped =
        `O SPED de Contribuições declara regime de PIS/COFINS ${rotulo(regimeSpedContrib)}, mas a ` +
        `simulação foi rodada assumindo ${REGIME_LABEL[tipo] ?? tipo} (regime ${rotulo(esperado)}). ` +
        `Isso pode indicar erro de enquadramento na simulação, ou que a empresa apura PIS/COFINS fora ` +
        `do padrão do regime — confirme antes de usar a comparação de regimes deste relatório.`;
    }
  }

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
    sec4b: {
      baseTotal: servicosTomadosBaseTotal,
      fornecedores: servicosTomadosFornecedores,
    },
    sec5: {
      valorAtual,
      precoNecessario: precoNecessarioTotal,
      variacaoMediaPct,
      desonerado: desoneradoTotal,
      tributosAtuais: tributosAtuaisTotal,
      aliquotaPlenaMedia,
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
      porAno: cenariosPorAno,
      atualHojeXReforma,
      atualHojeXReformaPorAno,
      ponteLucroRealPorAno,
      resultadoLiquido: dreDoAno?.resultadoLiquido ?? null,
    },
    ...(aluguelSnap ? { secAluguel: aluguelSnap } : {}),
    ...(contratosSnap ? { secContratos: contratosSnap } : {}),
    ...(saldoCredorSnap ? { secSaldoCredor: saldoCredorSnap } : {}),
    ...(avisoRegimeSped ? { avisoRegimeSped } : {}),
    secCargaTributaria: cargaTributaria,
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
    const token = data.enabled ? (existente ?? crypto.randomUUID().replace(/-/g, "").slice(0, 10)) : null;
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
