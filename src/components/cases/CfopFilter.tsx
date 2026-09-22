import { descreverCfop } from "@/lib/nfe/cfop";

/**
 * Filtro de visualização por CFOP. Não recalcula nada: só esconde ou mostra
 * linhas que já foram apuradas.
 */
export function CfopFilter({
  cfops,
  selecionados,
  onToggle,
  onLimpar,
}: {
  cfops: string[];
  selecionados: string[];
  onToggle: (cfop: string) => void;
  onLimpar: () => void;
}) {
  if (cfops.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filtrar por CFOP
        </p>
        {selecionados.length > 0 ? (
          <button
            type="button"
            onClick={onLimpar}
            className="text-xs font-semibold text-navy hover:underline"
          >
            Limpar filtro
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {cfops.map((c) => {
          const ativo = selecionados.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className={`rounded border px-2 py-1 text-xs font-semibold tabular-nums ${
                ativo ? "border-navy bg-navy/10 text-navy" : "border-input text-foreground hover:bg-secondary"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {selecionados.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {selecionados.map((c) => (
            <li key={`leg-${c}`}>{descreverCfop(c)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem seleção, todos os CFOPs do Caso são considerados.
        </p>
      )}
    </div>
  );
}
