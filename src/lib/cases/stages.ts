/** Etapas do funil comercial e seus três blocos. */
export type CaseStage =
  | "lead"
  | "diagnostico_basico"
  | "memorando_assinado"
  | "aguardando_documentos"
  | "diagnostico_full"
  | "em_revisao"
  | "reuniao_agendada"
  | "elaboracao_proposta"
  | "proposta_enviada"
  | "contrato_assinado"
  | "relatorio_entregue"
  | "acompanhamento_implantacao";

export const STAGE_LABELS: Record<CaseStage, string> = {
  lead: "Lead",
  diagnostico_basico: "Diagnóstico básico",
  memorando_assinado: "Memorando assinado",
  aguardando_documentos: "Aguardando documentos",
  diagnostico_full: "Diagnóstico Full",
  em_revisao: "Em Revisão",
  reuniao_agendada: "Reunião agendada",
  elaboracao_proposta: "Elaboração de Proposta",
  proposta_enviada: "Proposta enviada",
  contrato_assinado: "Contrato assinado",
  relatorio_entregue: "Relatório full Entregue",
  acompanhamento_implantacao: "Acompanhamento e implantação",
};

export interface StageBlock {
  number: string;
  title: string;
  stages: CaseStage[];
}

export const STAGE_BLOCKS: StageBlock[] = [
  { number: "01", title: "Captação", stages: ["lead", "diagnostico_basico"] },
  {
    number: "02",
    title: "Diagnóstico",
    stages: [
      "memorando_assinado",
      "aguardando_documentos",
      "diagnostico_full",
      "em_revisao",
    ],
  },
  {
    number: "03",
    title: "Comercial / Entrega",
    stages: [
      "reuniao_agendada",
      "elaboracao_proposta",
      "proposta_enviada",
      "contrato_assinado",
      "relatorio_entregue",
      "acompanhamento_implantacao",
    ],
  },
];

export const ALL_STAGES: CaseStage[] = STAGE_BLOCKS.flatMap((b) => b.stages);

export const DEFAULT_STAGE: CaseStage = "lead";

/** Mantém só os dígitos do CNPJ, para comparação e agrupamento. */
export function cnpjDigits(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** Formata o CNPJ para exibição, quando tiver 14 dígitos. */
export function formatCnpj(value: string | null | undefined): string | null {
  const digits = cnpjDigits(value);
  if (!digits) return null;
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
