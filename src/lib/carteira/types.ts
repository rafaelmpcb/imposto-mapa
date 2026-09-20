/** Tipos e utilitários da composição de carteira (clientes e fornecedores). */

export type CarteiraTipo = "cliente" | "fornecedor";
export type CarteiraRegime = "simples" | "regular" | "pendente" | "erro";
export type CarteiraStatus = "ok" | "nao_encontrado" | "erro" | "pendente";

/** Campos que o sistema espera encontrar no arquivo enviado. */
export type CarteiraField = "nome" | "cnpj" | "valor" | "tipo";

export interface CarteiraRow {
  id: string;
  case_id: string;
  nome: string;
  cnpj: string;
  tipo: CarteiraTipo;
  valor_movimentado: number;
  percentual_carteira: number;
  regime: CarteiraRegime;
  fonte_classificacao: string;
  data_classificacao: string | null;
  status_consulta: CarteiraStatus;
  created_at: string;
  updated_at: string;
}

/** Linha já interpretada, antes de gravar no banco. */
export interface CarteiraDraftRow {
  nome: string;
  cnpj: string;
  tipo: CarteiraTipo;
  valor: number;
  /** Nomes divergentes encontrados para o mesmo CNPJ. */
  nomesDivergentes: string[];
  /** Quantas linhas do arquivo foram somadas nesta contraparte. */
  linhas: number;
  invalido: null | "cnpj" | "valor";
}

/** Mapeamento coluna do arquivo → campo do sistema (índice da coluna, -1 = não mapeado). */
export type ColumnMapping = Partial<Record<CarteiraField, number>>;

/** Mapeamento guardado no Caso, por nome de coluna (reaproveitado em novos envios). */
export type SavedMapping = Partial<Record<CarteiraField, string>>;

export const DOC_STATUS_LABELS: Record<string, string> = {
  nao_enviado: "Não enviado",
  enviado: "Enviado",
  processado: "Processado",
};

export interface DiagnosticDocDef {
  key: string;
  title: string;
  description: string;
  /** Itens inativos ficam reservados para etapas futuras. */
  active: boolean;
}

export const DIAGNOSTIC_DOCS: DiagnosticDocDef[] = [
  {
    key: "composicao_carteira",
    title: "Composição de carteira (clientes e fornecedores)",
    description:
      "Razão analítico, relatório de contas a receber/pagar ou equivalente, no formato que a contabilidade já exporta (.xlsx ou .csv).",
    active: true,
  },
  {
    key: "dados_regime",
    title: "Dados de entrada do motor de regime (PGDAS-D, EFD, folha, RBT12)",
    description: "Reservado para uma próxima etapa. Ainda não é processado aqui.",
    active: false,
  },
];

export const onlyDigits = (value: string) => (value ?? "").replace(/\D/g, "");

export const isCnpj14 = (value: string) => onlyDigits(value).length === 14;

export function formatCnpjMask(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Converte texto de planilha em número, aceitando formatos brasileiros. */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  let text = String(raw ?? "").trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[()]/g, "").replace(/[^\d.,-]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  const n = Number(text.replace(/-/g, ""));
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

export const REGIME_LABELS: Record<CarteiraRegime, string> = {
  simples: "Simples Nacional",
  regular: "Regime regular",
  pendente: "Pendente",
  erro: "Erro na consulta",
};

export const STATUS_LABELS: Record<CarteiraStatus, string> = {
  ok: "Classificado",
  nao_encontrado: "CNPJ não encontrado",
  erro: "Falha na consulta",
  pendente: "Aguardando consulta",
};

/** Resumo por tipo: participação em valor de cada regime. */
export interface CarteiraSummary {
  tipo: CarteiraTipo;
  total: number;
  simplesPct: number;
  regularPct: number;
  pendentePct: number;
  linhas: number;
  classificadas: number;
}

export function summarize(rows: CarteiraRow[], tipo: CarteiraTipo): CarteiraSummary {
  const items = rows.filter((r) => r.tipo === tipo);
  const total = items.reduce((acc, r) => acc + Number(r.valor_movimentado), 0);
  const sumOf = (regime: CarteiraRegime) =>
    items
      .filter((r) => r.regime === regime)
      .reduce((acc, r) => acc + Number(r.valor_movimentado), 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return {
    tipo,
    total,
    simplesPct: pct(sumOf("simples")),
    regularPct: pct(sumOf("regular")),
    pendentePct: pct(sumOf("pendente") + sumOf("erro")),
    linhas: items.length,
    classificadas: items.filter((r) => r.regime === "simples" || r.regime === "regular").length,
  };
}

/** Considera desatualizada a classificação com mais de 45 dias. */
export function isStale(row: CarteiraRow): boolean {
  if (!row.data_classificacao) return false;
  const days = (Date.now() - new Date(row.data_classificacao).getTime()) / 86_400_000;
  return days > 45;
}
