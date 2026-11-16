import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EstudoEquiparacaoRow {
  id: string;
  case_id: string | null;
  titulo: string;
  receita_mensal: number;
  fracao_procedimentos: number;
  meses_retroativos: number;
  exito_pct: number;
  origem_segregacao: string;
  resultado: {
    economiaMensal?: number;
    economiaAnual?: number;
    indebitoNominal?: number;
    indebitoAtualizado?: number;
    selicMediaPct?: number;
    honorarios?: number;
  };
  created_at: string;
}

export interface EstudoEquiparacaoInput {
  caseId?: string | null;
  titulo: string;
  receitaMensal: number;
  fracaoProcedimentos: number;
  mesesRetroativos: number;
  exitoPct: number;
  origemSegregacao: "percentual" | "arquivos";
  segregacao: Record<string, unknown>;
  resultado: Record<string, unknown>;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

export const salvarEstudoEquiparacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EstudoEquiparacaoInput) => input)
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("estudo_equiparacao")
      .insert({
        case_id: data.caseId || null,
        titulo: data.titulo.trim() || "Estudo de equiparação hospitalar",
        receita_mensal: data.receitaMensal,
        fracao_procedimentos: data.fracaoProcedimentos,
        meses_retroativos: Math.round(data.mesesRetroativos),
        exito_pct: data.exitoPct,
        origem_segregacao: data.origemSegregacao,
        segregacao_json: data.segregacao as never,
        resultado_json: data.resultado as never,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.caseId) {
      const r = data.resultado as { indebitoAtualizado?: number };
      await context.supabase.from("case_interactions").insert({
        case_id: data.caseId,
        kind: "nota",
        title: "Estudo de equiparação hospitalar salvo",
        body: `Indébito estimado (Selic real): R$ ${num(r.indebitoAtualizado).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        author_id: context.userId,
      });
    }
    return { ok: true as const, id: String(row?.id ?? "") };
  });

export const listEstudosEquiparacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("estudo_equiparacao")
      .select("id,case_id,titulo,receita_mensal,fracao_procedimentos,meses_retroativos,exito_pct,origem_segregacao,resultado_json,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const items: EstudoEquiparacaoRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      case_id: r.case_id,
      titulo: r.titulo,
      receita_mensal: num(r.receita_mensal),
      fracao_procedimentos: num(r.fracao_procedimentos),
      meses_retroativos: num(r.meses_retroativos),
      exito_pct: num(r.exito_pct),
      origem_segregacao: r.origem_segregacao,
      resultado: (r.resultado_json ?? {}) as EstudoEquiparacaoRow["resultado"],
      created_at: r.created_at,
    }));
    return { ok: true as const, items };
  });

export const excluirEstudoEquiparacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("estudo_equiparacao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
