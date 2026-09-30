/** Valor monetário em reais escrito por extenso, para as cláusulas de honorários. */

const UNIDADES = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]!);
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto]!);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]!);
    }
  }
  return partes.join(" e ");
}

function inteiroExtenso(n: number): string {
  if (n === 0) return "zero";
  const grupos: { valor: number; singular: string; plural: string }[] = [
    { valor: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
    { valor: 1_000_000, singular: "milhão", plural: "milhões" },
    { valor: 1_000, singular: "mil", plural: "mil" },
  ];
  let restante = n;
  const partes: string[] = [];
  for (const g of grupos) {
    const q = Math.floor(restante / g.valor);
    if (q > 0) {
      const nome = q === 1 ? g.singular : g.plural;
      partes.push(g.valor === 1_000 && q === 1 ? "mil" : `${ate999(q)} ${nome}`.trim());
      restante -= q * g.valor;
    }
  }
  if (restante > 0) partes.push(ate999(restante));
  if (partes.length === 1) return partes[0]!;
  const ultimo = partes[partes.length - 1]!;
  const inicio = partes.slice(0, -1).join(", ");
  const usaE = restante > 0 && (restante < 100 || restante % 100 === 0);
  return usaE ? `${inicio} e ${ultimo}` : `${inicio}, ${ultimo}`;
}

/** "R$ 12.500,00" → "doze mil e quinhentos reais". */
export function reaisPorExtenso(valor: number): string {
  const total = Math.round(Math.abs(valor) * 100);
  const inteiro = Math.floor(total / 100);
  const centavos = total % 100;
  const partes: string[] = [];
  if (inteiro > 0 || centavos === 0) {
    partes.push(`${inteiroExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return partes.join(" e ");
}

/** Formatação monetária sem depender de Intl (funciona em qualquer runtime). */
export function moeda(valor: number): string {
  const neg = valor < 0;
  const cents = Math.round(Math.abs(valor) * 100);
  const inteiro = Math.floor(cents / 100).toString();
  const frac = (cents % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${frac}`;
}

/** "R$ 12.500,00 (doze mil e quinhentos reais)" */
export function valorComExtenso(valor: number): string {
  return `${moeda(valor)} (${reaisPorExtenso(valor)})`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-09-30" → "30 de setembro de 2026". */
export function dataLonga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} de ${MESES[m - 1]} de ${a}`;
}

/** "2026-09-30" → "30/09/2026". */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}
