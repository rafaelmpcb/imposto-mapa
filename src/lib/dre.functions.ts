import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXCLUIDO_ANALISTA, estaPendente } from "@/lib/apuracao/liquido";
import {
  ircsPorAno,
  montarDre,
  round2,
  type CenarioDre,
  type DreInsumos,
  type DreLinhaAno,
} from "@/lib/dre/calculo";
import { CRONOGRAMA_PADRAO } from "@/lib/preco/necessario";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { simulate, type SimulationInput } from "@/lib/tax/calc";
import { YEARS, type YearId } from "@/lib/tax/constants";

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export interface DrePayload {
  linhas: DreLinhaAno[];
  insumos: DreInsumos;
  despesasPorAno: Record<number, number>;
  /** Sugestão de despesa anual vinda da folha informada na simulação do Caso. */
  sugestaoDespesaAnual: number | null;
  /**
   * Sugestão vinda da composição de carteira (fornecedores): valor movimentado
   * que NÃO está em nenhuma NF-e/NFS-e de compra já processada no Caso (pelo
   * CNPJ do fornecedor) — ou seja, despesa real mas sem documento fiscal no
   * sistema. Evita contar de novo o que já compõe o custo de compras.
   */
  sugestaoDespesaCarteira: number | null;
  /** Verdadeiro quando o Caso não tem simulação salva (IR/CS indisponível). */
  semSimulacao: boolean;
  /** Regime identificado na simulação do Caso. */
  regime: string | null;
  anos: { ano: number; fracao: number }[];
}

const somaValida = (
  linhas: { valor: number; tributo: number; status: string }[],
): { valor: number; tributo: number } => {
  let valor = 0;
  let tributo = 0;
  for (const l of linhas) {
    if (estaPendente(l.status) || l.status === EXCLUIDO_ANALISTA) continue;
    valor += l.valor;
    tributo += l.tributo;
  }
  return { valor: round2(valor), tributo: round2(tributo) };
};

const ircsDaSimulacao = (input: SimulationInput, ano: YearId) => {
  const res = simulate(input, ano);
  const soma = (linhas: { label: string; value: number }[]) =>
    linhas
      .filter((l) => /IRPJ|CSLL/i.test(l.label))
      .reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  return { atual: soma(res.current.lines), projetado: soma(res.reform.lines) };
};

/**
 * DRE ano a ano do Caso: lê as notas e a composição de carteira já gravadas,
 * monta as linhas e persiste em dre_projecao_anual (cache usado pela própria
 * tela do DRE). Extraída da antiga handler de getDre para que o relatório
 * (parecer.functions.ts) também possa chamá-la e nunca mostrar um DRE
 * desatualizado em relação às notas mais recentes — antes disso, o relatório
 * só lia a tabela gravada, que ficava parada até alguém abrir a aba DRE.
 */
export async function computeDre(supabaseAdmin: Admin, caseId: string): Promise<DrePayload> {
  const [
      vendaItens,
      servicoPrestado,
      compraItens,
      servicoTomado,
      precoMercadoria,
      precoServico,
      despesas,
      crono,
      simulacao,
      carteiraFornecedores,
      comprasHeaders,
      servicosTomadosHeaders,
    ] = await Promise.all([
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_fiscal_venda_xml_item")
          .select(
            "id,valor_item,valor_debito_ibs_cbs,status_classificacao,valor_icms,valor_ipi,valor_pis,valor_cofins",
          )
          .eq("case_id", caseId)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_servico_nfse_item_prestado" as "nota_servico_nfse_item")
          .select("id,valor_servico,valor_debito_ibs_cbs,status_classificacao,valor_iss")
          .eq("case_id", caseId)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_fiscal_compra_xml_item")
          .select("valor_item,valor_credito_ibs_cbs,status_classificacao")
          .eq("case_id", caseId)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_servico_nfse_item")
          .select("valor_servico,valor_credito_ibs_cbs,status_classificacao")
          .eq("case_id", caseId)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_fiscal_venda_xml_item_preco")
          .select("item_id,valor_desonerado")
          .eq("case_id", caseId)
          .order("item_id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_servico_nfse_item_prestado_preco")
          .select("item_id,valor_desonerado")
          .eq("case_id", caseId)
          .order("item_id")
          .range(from, to),
      ),
      supabaseAdmin
        .from("despesa_operacional_anual")
        .select("ano,valor")
        .eq("case_id", caseId),
      supabaseAdmin
        .from("cronograma_transicao_ibscbs")
        .select("ano,fracao_aliquota_plena,case_id")
        .or(`case_id.eq.${caseId},case_id.is.null`),
      supabaseAdmin
        .from("simulations")
        .select("input,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("composicao_carteira")
          .select("cnpj,valor_movimentado")
          .eq("case_id", caseId)
          .eq("tipo", "fornecedor")
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_fiscal_compra_xml")
          .select("cnpj_emitente,valor_total")
          .eq("case_id", caseId)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("nota_servico_nfse")
          .select("cnpj_prestador,valor_total")
          .eq("case_id", caseId)
          .eq("direcao", "tomado")
          .order("id")
          .range(from, to),
      ),
    ]);

    const rows = (r: { data: unknown }) => (r.data ?? []) as Record<string, unknown>[];
    const arr = (r: unknown[]) => r as Record<string, unknown>[];
    const n = (v: unknown) => Number(v ?? 0);

    const desonerados = new Map<string, number>();
    for (const p of [...arr(precoMercadoria), ...arr(precoServico)]) {
      desonerados.set(String(p["item_id"]), n(p["valor_desonerado"]));
    }

    const vendas = arr(vendaItens).map((i) => ({
      id: String(i["id"]),
      valor: n(i["valor_item"]),
      tributo: n(i["valor_debito_ibs_cbs"]),
      atuais: n(i["valor_icms"]) + n(i["valor_ipi"]) + n(i["valor_pis"]) + n(i["valor_cofins"]),
      status: String(i["status_classificacao"] ?? "sem_dado"),
    }));
    const prestados = arr(servicoPrestado).map((i) => ({
      id: String(i["id"]),
      valor: n(i["valor_servico"]),
      tributo: n(i["valor_debito_ibs_cbs"]),
      atuais: n(i["valor_iss"]),
      status: String(i["status_classificacao"] ?? "sem_dado"),
    }));

    const receita = somaValida([...vendas, ...prestados]);
    const tributosAtuais = round2(
      [...vendas, ...prestados]
        .filter((i) => !estaPendente(i.status) && i.status !== EXCLUIDO_ANALISTA)
        .reduce((acc, i) => acc + i.atuais, 0),
    );
    const receitaDesonerada = round2(
      [...vendas, ...prestados]
        .filter((i) => !estaPendente(i.status) && i.status !== EXCLUIDO_ANALISTA)
        .reduce(
          (acc, i) => acc + (desonerados.get(i.id) ?? Math.max(0, i.valor - i.atuais)),
          0,
        ),
    );

    const compras = somaValida([
      ...arr(compraItens).map((i) => ({
        valor: n(i["valor_item"]),
        tributo: n(i["valor_credito_ibs_cbs"]),
        status: String(i["status_classificacao"] ?? "sem_dado"),
      })),
      ...arr(servicoTomado).map((i) => ({
        valor: n(i["valor_servico"]),
        tributo: n(i["valor_credito_ibs_cbs"]),
        status: String(i["status_classificacao"] ?? "sem_dado"),
      })),
    ]);

    const insumos: DreInsumos = {
      receitaBrutaAtual: receita.valor,
      receitaBrutaDesonerada: receitaDesonerada,
      tributosAtuaisVendas: tributosAtuais,
      debitoIbsCbsPleno: receita.tributo,
      custoCompras: compras.valor,
      creditoIbsCbsPleno: compras.tributo,
    };

    // Composição de carteira (fornecedores) que ainda não tem NF-e/NFS-e de
    // compra correspondente no Caso, por CNPJ — despesa real sem documento
    // fiscal, não deve ser confundida com custoCompras (que já é por XML).
    const xmlPorCnpj = new Map<string, number>();
    for (const r of arr(comprasHeaders)) {
      const c = onlyDigits(r["cnpj_emitente"]);
      if (c) xmlPorCnpj.set(c, (xmlPorCnpj.get(c) ?? 0) + n(r["valor_total"]));
    }
    for (const r of arr(servicosTomadosHeaders)) {
      const c = onlyDigits(r["cnpj_prestador"]);
      if (c) xmlPorCnpj.set(c, (xmlPorCnpj.get(c) ?? 0) + n(r["valor_total"]));
    }
    let despesaNaoDocumentada = 0;
    for (const r of arr(carteiraFornecedores)) {
      const c = onlyDigits(r["cnpj"]);
      const valor = n(r["valor_movimentado"]);
      despesaNaoDocumentada += Math.max(0, valor - (xmlPorCnpj.get(c) ?? 0));
    }

    const cronoLinhas = rows(crono).map((l) => ({
      ano: Number(l["ano"]),
      fracao: Number(l["fracao_aliquota_plena"]),
      doCaso: l["case_id"] === caseId,
    }));
    const proprios = cronoLinhas.filter((l) => l.doCaso);
    const base = proprios.length > 0 ? proprios : cronoLinhas.filter((l) => !l.doCaso);
    const rampa = (base.length > 0 ? base : CRONOGRAMA_PADRAO.map((c) => ({ ...c, doCaso: false })))
      .map((l) => ({ ano: l.ano, fracao: l.fracao }))
      .sort((a, b) => a.ano - b.ano);
    const anos = rampa.some((r) => r.ano === 2026)
      ? rampa
      : [{ ano: 2026, fracao: 0 }, ...rampa];

    const despesasPorAno: Record<number, number> = {};
    for (const d of rows(despesas)) despesasPorAno[Number(d["ano"])] = n(d["valor"]);

    const simInput = (simulacao.data as { input?: unknown } | null)?.input as
      | SimulationInput
      | undefined;

    const marcos = simInput
      ? YEARS.map((y) => ({ ano: y.id as number, ...ircsDaSimulacao(simInput, y.id) }))
      : [];

    const linhas = montarDre({
      insumos,
      anos,
      despesasPorAno,
      ircs: simInput
        ? ircsPorAno(marcos)
        : () => ({ valor: null, origem: "indisponivel" as const }),
    });

    const persistir = linhas.map((l) => ({
      case_id: caseId,
      ano: l.ano,
      cenario: l.cenario as CenarioDre,
      receita_bruta: l.receitaBruta,
      deducoes: l.deducoes,
      receita_liquida: l.receitaLiquida,
      custo: l.custo,
      lucro_bruto: l.lucroBruto,
      despesas_operacionais: l.despesasOperacionais,
      resultado_antes_ircs: l.resultadoAntesIrcs,
      ircs: l.ircs,
      resultado_liquido: l.resultadoLiquido,
      ircs_origem: l.ircsOrigem,
      calculado_em: new Date().toISOString(),
    }));
    if (persistir.length > 0) {
      await supabaseAdmin
        .from("dre_projecao_anual")
        .upsert(persistir as never, { onConflict: "case_id,ano,cenario" });
    }

  return {
    linhas,
    insumos,
    despesasPorAno,
    // A folha informada na simulação já é o total anual — não multiplicar por 12.
    sugestaoDespesaAnual:
      simInput && Number(simInput.payroll) > 0 ? round2(Number(simInput.payroll)) : null,
    sugestaoDespesaCarteira: despesaNaoDocumentada > 0 ? round2(despesaNaoDocumentada) : null,
    semSimulacao: !simInput,
    regime: simInput?.taxpayerType ?? null,
    anos,
  };
}

/** DRE ano a ano do Caso: delega o cálculo a computeDre e devolve o resultado. */
export const getDre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; dados: DrePayload }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dados = await computeDre(supabaseAdmin, data.caseId);
    return { ok: true as const, dados };
  });

/** Grava as despesas operacionais anuais informadas manualmente no Caso. */
export const salvarDespesasOperacionais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; despesas: { ano: number; valor: number }[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.despesas.length === 0) return { ok: true as const };
    const up = await supabaseAdmin.from("despesa_operacional_anual").upsert(
      data.despesas.map((d) => ({
        case_id: data.caseId,
        ano: d.ano,
        valor: d.valor,
      })) as never,
      { onConflict: "case_id,ano" },
    );
    if (up.error) throw new Error(up.error.message);
    return { ok: true as const };
  });
