/**
 * Agrupa as linhas de imposto que `tax/calc.ts` já calcula (rótulos como
 * "PIS (0,65%)", "IBS + CBS (12,4%)" etc.) em categorias fixas, para montar
 * a tabela e os gráficos por imposto da aba Regimes do relatório.
 *
 * Não recalcula nada: só classifica valores que o motor de cálculo já
 * produziu, pelo prefixo do rótulo (o motor sempre começa o rótulo pelo
 * nome do tributo). IBS e CBS saem sempre numa única linha a partir de 2027
 * porque é assim que `tax/calc.ts` as calcula (a rampa mistura as duas
 * alíquotas antes de gerar o valor) — por isso não existe categoria "CBS"
 * separada de "IBS + CBS".
 */
export const CATEGORIAS_IMPOSTO = [
  "PIS",
  "COFINS",
  "ISS/ICMS",
  "IBS + CBS",
  "IRPJ",
  "CSLL",
  "CPP",
  "Outros",
] as const;

export type CategoriaImposto = (typeof CATEGORIAS_IMPOSTO)[number];

function categoriaDoRotulo(label: string): CategoriaImposto {
  if (label.startsWith("PIS")) return "PIS";
  if (label.startsWith("COFINS")) return "COFINS";
  if (label.startsWith("ISS") || label.startsWith("ICMS")) return "ISS/ICMS";
  if (label.startsWith("IBS")) return "IBS + CBS";
  if (label.startsWith("IRPJ")) return "IRPJ";
  if (label.startsWith("CSLL")) return "CSLL";
  if (label.startsWith("CPP")) return "CPP";
  return "Outros";
}

/** Soma as linhas por categoria, na ordem fixa de `CATEGORIAS_IMPOSTO`. */
export function categorizarLinhas(
  lines: { label: string; value: number }[],
): { categoria: CategoriaImposto; valor: number }[] {
  const somas = new Map<CategoriaImposto, number>();
  for (const linha of lines) {
    const categoria = categoriaDoRotulo(linha.label);
    somas.set(categoria, (somas.get(categoria) ?? 0) + linha.value);
  }
  return CATEGORIAS_IMPOSTO.filter((c) => (somas.get(c) ?? 0) > 0.004).map((categoria) => ({
    categoria,
    valor: somas.get(categoria) ?? 0,
  }));
}
