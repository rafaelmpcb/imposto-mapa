import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calcularContrato,
  type CenarioId,
  type ContratoInput,
  type PapelContrato,
  type PerfilContratante,
  type RegimePrestador,
  type ResultadoContrato,
} from "@/lib/contratos/calculo";

export type StatusContrato = "a_revisar" | "em_negociacao" | "aditivo_assinado" | "encerrado";

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  a_revisar: "A revisar",
  em_negociacao: "Em negociação",
  aditivo_assinado: "Aditivo assinado",
  encerrado: "Encerrado",
};

export interface ContratoRow {
  id: string;
  case_id: string | null;
  titulo: string;
  contraparte: string | null;
  papel: PapelContrato;
  regime_prestador: RegimePrestador;
  perfil_contratante: PerfilContratante;
  preco_mensal_atual: number;
  custo_direto_pct: number;
  credito_insumos_pct: number;
  aliquota_plena_pct: number;
  reducao_pct: number;
  ano_referencia: number;
  cenario: CenarioId;
  status: StatusContrato;
  observacao: string | null;
  resultado: ResultadoContrato | null;
  created_at: string;
  updated_at: string;
}

export interface ContratoSaveInput {
  id?: string;
  caseId?: string | null;
  titulo: string;
  contraparte?: string | null;
  papel: PapelContrato;
  regimePrestador: RegimePrestador;
  perfilContratante: PerfilContratante;
  precoMensalAtual: number;
  custoDiretoPct: number;
  creditoInsumosPct: number;
  aliquotaPlenaPct: number;
  reducaoPct: number;
  ano: number;
  cenario: CenarioId;
  status?: StatusContrato;
  observacao?: string | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

function toRow(row: Record<string, unknown>): ContratoRow {
  return {
    id: String(row["id"]),
    case_id: (row["case_id"] as string | null) ?? null,
    titulo: String(row["titulo"] ?? ""),
    contraparte: (row["contraparte"] as string | null) ?? null,
    papel: (row["papel"] as PapelContrato) ?? "prestador",
    regime_prestador: (row["regime_prestador"] as RegimePrestador) ?? "presumido",
    perfil_contratante: (row["perfil_contratante"] as PerfilContratante) ?? "regular",
    preco_mensal_atual: num(row["preco_mensal_atual"]),
    custo_direto_pct: num(row["custo_direto_pct"]),
    credito_insumos_pct: num(row["credito_insumos_pct"]),
    aliquota_plena_pct: num(row["aliquota_plena_pct"]),
    reducao_pct: num(row["reducao_pct"]),
    ano_referencia: num(row["ano_referencia"]),
    cenario: (row["cenario"] as CenarioId) ?? "equilibrio",
    status: (row["status"] as StatusContrato) ?? "a_revisar",
    observacao: (row["observacao"] as string | null) ?? null,
    resultado: (row["resultado_json"] as ResultadoContrato | null) ?? null,
    created_at: String(row["created_at"] ?? ""),
    updated_at: String(row["updated_at"] ?? ""),
  };
}

const toInput = (d: ContratoSaveInput): ContratoInput => ({
  precoMensalAtual: d.precoMensalAtual,
  regimePrestador: d.regimePrestador,
  perfilContratante: d.perfilContratante,
  custoDiretoPct: d.custoDiretoPct,
  creditoInsumosPct: d.creditoInsumosPct,
  ano: d.ano,
  cenario: d.cenario,
  aliquotaPlenaPct: d.aliquotaPlenaPct,
  reducaoPct: d.reducaoPct,
});

/** Grava (ou atualiza) um estudo de reequilíbrio contratual com o resultado calculado. */
export const salvarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ContratoSaveInput) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resultado = calcularContrato(toInput(data));

    const payload = {
      case_id: data.caseId ?? null,
      titulo: data.titulo.trim() || "Contrato de prestação continuada",
      contraparte: data.contraparte?.trim() || null,
      papel: data.papel,
      regime_prestador: data.regimePrestador,
      perfil_contratante: data.perfilContratante,
      preco_mensal_atual: data.precoMensalAtual,
      custo_direto_pct: data.custoDiretoPct,
      credito_insumos_pct: data.creditoInsumosPct,
      aliquota_plena_pct: data.aliquotaPlenaPct,
      reducao_pct: data.reducaoPct,
      ano_referencia: data.ano,
      cenario: data.cenario,
      status: data.status ?? "a_revisar",
      observacao: data.observacao?.trim() || null,
      resultado_json: resultado as unknown as never,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("contrato_reequilibrio")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id, resultado };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("contrato_reequilibrio")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: String(inserted?.["id"] ?? ""), resultado };
  });

/** Todos os contratos em acompanhamento. */
export const listContratos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("contrato_reequilibrio")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      items: (rows ?? []).map((r) => toRow(r as Record<string, unknown>)),
    };
  });

export const atualizarStatusContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: StatusContrato }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("contrato_reequilibrio")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const excluirContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("contrato_reequilibrio")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
