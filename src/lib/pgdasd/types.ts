/** Tipos do extrato do PGDAS-D (exclusivo do Simples Nacional). */

export type PgdasdStatus = "ok" | "sem_texto" | "parcial" | "manual";

export interface PgdasdAnexo {
  /** "I" a "V" */
  anexo: string;
  /** Receita declarada nesse anexo, quando identificada. */
  receita: number | null;
  /** Alíquota efetiva informada no extrato, em %. */
  percentual: number | null;
}

export interface PgdasdTributo {
  tributo: string;
  valor: number;
}

export interface PgdasdExtraction {
  competencia: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  rbt12: number | null;
  receitaBrutaPa: number | null;
  anexos: PgdasdAnexo[];
  folha12Meses: number | null;
  valorTotalDas: number | null;
  tributos: PgdasdTributo[];
  status: PgdasdStatus;
  /** Campos que o parser não encontrou no PDF. */
  faltantes: string[];
}

export interface PgdasdRecord {
  id: string;
  case_id: string;
  arquivo_original: string;
  competencia: string | null;
  cnpj_extraido: string | null;
  razao_social_extraida: string | null;
  rbt12: number | null;
  receita_bruta_pa: number | null;
  anexos: PgdasdAnexo[];
  folha_12_meses: number | null;
  valor_total_das: number | null;
  detalhamento_tributos: { tributos?: PgdasdTributo[] } | null;
  status_extracao: PgdasdStatus;
  aplicado_ao_calculo: boolean;
  created_at: string;
  updated_at: string;
}

export const PGDASD_STATUS_LABELS: Record<PgdasdStatus, string> = {
  ok: "Extraído do PDF",
  parcial: "Extraído parcialmente",
  sem_texto: "PDF sem texto (preenchimento manual)",
  manual: "Preenchido manualmente",
};

export const emptyExtraction = (): PgdasdExtraction => ({
  competencia: null,
  cnpj: null,
  razaoSocial: null,
  rbt12: null,
  receitaBrutaPa: null,
  anexos: [],
  folha12Meses: null,
  valorTotalDas: null,
  tributos: [],
  status: "manual",
  faltantes: [],
});
