import { STAGE_BLOCKS, STAGE_LABELS } from "@/lib/cases/stages";
import type { StageStat } from "@/lib/cases.functions";

/** Formata uma duração em milissegundos como dias/horas legíveis. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1).replace(".", ",")} h`;
  const days = hours / 24;
  return `${days.toFixed(1).replace(".", ",")} dia${days >= 2 ? "s" : ""}`;
}

export function FunnelPanel({
  stages,
  totalCases,
}: {
  stages: StageStat[];
  totalCases: number;
}) {
  const byStage = new Map(stages.map((s) => [s.stage, s]));
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {totalCases} caso{totalCases === 1 ? "" : "s"} no funil. O tempo médio considera apenas
        as passagens já concluídas por cada etapa, contadas a partir do registro das mudanças.
      </p>

      {STAGE_BLOCKS.map((block) => {
        const blockCount = block.stages.reduce(
          (sum, stage) => sum + (byStage.get(stage)?.count ?? 0),
          0,
        );
        // Média ponderada do tempo por etapa dentro do bloco, pelas passagens medidas.
        let blockSum = 0;
        let blockSamples = 0;
        for (const stage of block.stages) {
          const stat = byStage.get(stage);
          if (stat?.avgDurationMs != null && stat.samples > 0) {
            blockSum += stat.avgDurationMs * stat.samples;
            blockSamples += stat.samples;
          }
        }
        const blockAvg = blockSamples > 0 ? blockSum / blockSamples : null;
        return (
          <section key={block.number} className="rounded-xl border border-border bg-card p-4">
            <header className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                {block.number}
              </span>
              <h2 className="text-base font-semibold text-foreground">{block.title}</h2>
              <span className="text-xs text-muted-foreground">
                {blockCount} caso{blockCount === 1 ? "" : "s"}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Tempo médio no bloco:{" "}
                <strong className="font-semibold tabular-nums text-foreground">
                  {formatDuration(blockAvg)}
                </strong>
                {blockSamples > 0 ? ` · ${blockSamples} passagem${blockSamples === 1 ? "" : "s"}` : ""}
              </span>
            </header>


            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {block.stages.map((stage) => {
                const stat = byStage.get(stage);
                const count = stat?.count ?? 0;
                const width = Math.round((count / maxCount) * 100);
                return (
                  <article
                    key={stage}
                    className="rounded-lg border border-border bg-secondary p-3"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {STAGE_LABELS[stage]}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                      {count}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card">
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Tempo médio na etapa</dt>
                        <dd className="font-semibold tabular-nums text-foreground">
                          {formatDuration(stat?.avgDurationMs ?? null)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Parados aqui hoje (média)</dt>
                        <dd className="font-semibold tabular-nums text-foreground">
                          {formatDuration(stat?.avgCurrentAgeMs ?? null)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt>Passagens medidas</dt>
                        <dd className="tabular-nums">{stat?.samples ?? 0}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
