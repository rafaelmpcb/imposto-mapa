/**
 * Marca provisória da cópia "whitelabel" — um monograma em traço fino, original,
 * inspirado na estética (cor dourada, linhas finas) do estilo visual de referência,
 * sem reproduzir nenhum logotipo de terceiros. "VÉRTICE" é um nome-placeholder:
 * troque o texto (e, se quiser, o ícone) pelo nome real do escritório que vai usar esta cópia.
 */
export function WhitelabelMark({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const titleSize = size === "sm" ? "text-sm" : "text-lg";

  return (
    <span className="inline-flex items-center gap-3">
      <svg viewBox="0 0 48 48" className={`${iconSize} shrink-0`} aria-hidden>
        <circle cx="24" cy="24" r="21" fill="none" stroke="#d9a94e" strokeWidth="1.4" />
        <path
          d="M14 16 L24 34 L34 16"
          fill="none"
          stroke="#d9a94e"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M24 34 L24 13" fill="none" stroke="#d9a94e" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className={`font-brand ${titleSize} font-bold tracking-[0.18em]`}>VÉRTICE</span>
        <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.32em] opacity-60">
          Inteligência Tributária
        </span>
      </span>
    </span>
  );
}
