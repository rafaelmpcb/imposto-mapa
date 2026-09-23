import type { CaseRecord } from "@/lib/cases.functions";

export type AlertTone = "atrasado" | "hoje" | "proximo" | "parado" | "ok";

export interface CaseAlert {
  tone: AlertTone;
  label: string;
}

const DIA = 24 * 60 * 60 * 1000;

/** Dias inteiros entre agora e uma data (positivo = futuro). */
function diasAte(iso: string, agora: number): number {
  return Math.round((new Date(iso).getTime() - agora) / DIA);
}

/**
 * Alerta comercial do caso: prioriza a próxima ação agendada e,
 * na ausência dela, sinaliza estagnação por falta de interação.
 */
export function caseAlert(item: CaseRecord, agora = Date.now()): CaseAlert {
  if (item.commercial_status !== "ativo") {
    return { tone: "ok", label: item.commercial_status === "ganho" ? "Ganho" : "Perdido" };
  }

  if (item.next_action_date) {
    const dias = diasAte(item.next_action_date, agora);
    const titulo = item.next_action_title?.trim() || "Próxima ação";
    if (dias < 0) return { tone: "atrasado", label: `${titulo} — atrasada há ${Math.abs(dias)}d` };
    if (dias === 0) return { tone: "hoje", label: `${titulo} — hoje` };
    if (dias === 1) return { tone: "proximo", label: `${titulo} — amanhã` };
    return { tone: "proximo", label: `${titulo} — em ${dias}d` };
  }

  const referencia = item.last_interaction_at ?? item.updated_at;
  const diasSem = Math.floor((agora - new Date(referencia).getTime()) / DIA);
  if (diasSem >= 10) {
    return { tone: "parado", label: `Sem contato há ${diasSem} dias` };
  }
  return { tone: "ok", label: "Sem próxima ação definida" };
}

export const ALERT_CLASSES: Record<AlertTone, string> = {
  atrasado: "bg-danger/10 text-danger border-danger/30",
  hoje: "bg-amber-100 text-amber-800 border-amber-300",
  proximo: "bg-primary/10 text-primary border-primary/30",
  parado: "bg-amber-100 text-amber-800 border-amber-300",
  ok: "bg-secondary text-muted-foreground border-border",
};

/** Valor ponderado da carteira: honorários × probabilidade dos casos ativos. */
export function pipelineStats(items: CaseRecord[], agora = Date.now()) {
  const ativos = items.filter((i) => i.commercial_status === "ativo");
  const ganhos = items.filter((i) => i.commercial_status === "ganho");
  const perdidos = items.filter((i) => i.commercial_status === "perdido");
  const total = ativos.reduce((acc, i) => acc + Number(i.deal_value || 0), 0);
  const ponderado = ativos.reduce(
    (acc, i) => acc + (Number(i.deal_value || 0) * Number(i.win_probability || 0)) / 100,
    0,
  );
  const alertas = ativos.filter((i) => {
    const t = caseAlert(i, agora).tone;
    return t === "atrasado" || t === "hoje" || t === "parado";
  }).length;
  const decididos = ganhos.length + perdidos.length;
  return {
    ativos: ativos.length,
    ganhos: ganhos.length,
    perdidos: perdidos.length,
    total,
    ponderado,
    alertas,
    conversao: decididos > 0 ? (ganhos.length / decididos) * 100 : null,
    valorGanho: ganhos.reduce((acc, i) => acc + Number(i.deal_value || 0), 0),
  };
}
