import brandLogo from "@/assets/brander-logo.png";

/** Marca da cópia "whitelabel": logo da Brander Consultoria + produto (Inteligência Tributária). */
export function WhitelabelMark({ size = "md" }: { size?: "sm" | "md" }) {
  const logoHeight = size === "sm" ? "h-7" : "h-9";
  const labelSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <span className="inline-flex items-center gap-3">
      <img src={brandLogo} alt="Brander Consultoria Empresarial" className={`${logoHeight} w-auto`} />
      <span className={`border-l border-white/20 pl-3 ${labelSize} font-medium uppercase tracking-[0.28em] text-white/60`}>
        Inteligência
        <br />
        Tributária
      </span>
    </span>
  );
}
