/**
 * Camada de dados dos parâmetros de cálculo.
 *
 * A lógica/fórmulas continuam em calc.ts — aqui ficam apenas o catálogo dos
 * parâmetros (alíquotas, tributos e faixas dos Anexos do Simples Nacional) e a
 * aplicação dos valores vigentes cadastrados no banco sobre as constantes.
 */
import {
  SIMPLES_ANEXOS,
  SIMPLES_DEFAULTS,
  SIMPLES_TABLES,
  TUNABLES,
  applyTaxOverrides,
  setSimplesBracket,
  type SimplesBracket,
} from "./constants";

export type ParamKind = "percent" | "currency";

export interface ParamDef {
  key: string;
  label: string;
  group: string;
  kind: ParamKind;
  /** Valor padrão previsto na LC 214/2025 / LC 123/2006. */
  fallback: number;
}

const BRACKET_FIELDS: { field: keyof SimplesBracket; kind: ParamKind; label: string }[] = [
  { field: "rbt12", kind: "currency", label: "teto da faixa (RBT12)" },
  { field: "rate", kind: "percent", label: "alíquota nominal" },
  { field: "deduct", kind: "currency", label: "parcela a deduzir" },
];

function simplesParams(): ParamDef[] {
  const out: ParamDef[] = [];
  for (const anexo of SIMPLES_ANEXOS) {
    const table = SIMPLES_DEFAULTS[anexo] ?? [];
    table.forEach((bracket, index) => {
      for (const { field, kind, label } of BRACKET_FIELDS) {
        out.push({
          key: `SIMPLES_${anexo}_F${index + 1}_${field.toUpperCase()}`,
          label: `${index + 1}ª faixa — ${label}`,
          group: `Simples Nacional — Anexo ${anexo}`,
          kind,
          fallback: bracket[field],
        });
      }
    });
  }
  return out;
}

/** Todos os parâmetros versionáveis do sistema. */
export const PARAMETERS: ParamDef[] = [
  ...TUNABLES.map((t) => ({
    key: t.key,
    label: t.label,
    group: t.group,
    kind: "percent" as const,
    fallback: t.fallback,
  })),
  ...simplesParams(),
];

export const PARAMETER_BY_KEY: Record<string, ParamDef> = Object.fromEntries(
  PARAMETERS.map((p) => [p.key, p]),
);

export const PARAMETER_GROUPS: string[] = [...new Set(PARAMETERS.map((p) => p.group))];

export const defaultParameterValues = (): Record<string, number> =>
  Object.fromEntries(PARAMETERS.map((p) => [p.key, p.fallback]));

const SIMPLES_KEY = /^SIMPLES_(I|II|III|IV|V)_F(\d+)_(RBT12|RATE|DEDUCT)$/;

/**
 * Aplica os valores vigentes sobre as constantes usadas pelas fórmulas.
 * Chaves ausentes voltam ao valor padrão.
 */
export function applyParameters(values: Record<string, number>): void {
  applyTaxOverrides(values);

  // Restaura as faixas do Simples antes de aplicar os valores cadastrados.
  for (const anexo of SIMPLES_ANEXOS) {
    const defaults = SIMPLES_DEFAULTS[anexo] ?? [];
    defaults.forEach((bracket, index) => {
      const target = SIMPLES_TABLES[anexo]?.[index];
      if (!target) return;
      target.rbt12 = bracket.rbt12;
      target.rate = bracket.rate;
      target.deduct = bracket.deduct;
    });
  }

  for (const [key, value] of Object.entries(values)) {
    const match = SIMPLES_KEY.exec(key);
    if (!match || !Number.isFinite(value)) continue;
    const field = match[3]!.toLowerCase() as keyof SimplesBracket;
    setSimplesBracket(match[1]!, Number(match[2]) - 1, field, value);
  }
}

export const formatParamValue = (def: ParamDef, value: number): string =>
  def.kind === "percent"
    ? `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Converte o texto digitado no painel para o valor armazenado. */
export const parseParamInput = (def: ParamDef, text: string): number => {
  const raw = Number(text.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(raw)) return NaN;
  return def.kind === "percent" ? raw / 100 : raw;
};

/** Converte o valor armazenado para o texto exibido no campo de edição. */
export const toParamInput = (def: ParamDef, value: number): string =>
  def.kind === "percent"
    ? (value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
