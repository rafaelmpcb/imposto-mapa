/** Corta um texto sem quebrar palavras no meio. */
export function truncateWords(value: string, max: number): string {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Slug para nomes de arquivo, cortado sempre por palavra inteira. */
export function slugifyWords(value: string, max = 60): string {
  const base = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return truncateWords(base, max).replace(/\s+/g, "-");
}
