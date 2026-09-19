import { useState } from "react";

import { StageSelect } from "@/components/cases/StageSelect";
import type { CaseRecord } from "@/lib/cases.functions";
import { STAGE_BLOCKS, STAGE_LABELS, formatCnpj, type CaseStage } from "@/lib/cases/stages";
import { brl } from "@/lib/tax/calc";

function LatestSummary({ item }: { item: CaseRecord }) {
  const latest = item.simulations[0];
  if (!latest) {
    return <p className="mt-2 text-xs text-muted-foreground">Sem cálculos vinculados</p>;
  }
  const diff = Number(latest.reform_total) - Number(latest.current_total);
  const worse = diff > 0.004;
  return (
    <p className="mt-2 text-xs tabular-nums text-muted-foreground">
      {brl(Number(latest.current_total))} → {brl(Number(latest.reform_total))}{" "}
      <span className={`font-semibold ${worse ? "text-danger" : "text-success"}`}>
        ({worse ? "+" : "−"}
        {brl(Math.abs(diff))})
      </span>
    </p>
  );
}

export function CaseKanban({
  items,
  onStageChange,
  onOpen,
  busyId,
}: {
  items: CaseRecord[];
  onStageChange: (id: string, stage: CaseStage) => void;
  onOpen: (id: string) => void;
  busyId: string | null;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<CaseStage | null>(null);

  const handleDrop = (stage: CaseStage) => {
    if (draggingId) {
      const dragged = items.find((i) => i.id === draggingId);
      if (dragged && dragged.stage !== stage) {
        onStageChange(draggingId, stage);
      }
    }
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="space-y-6">
      {STAGE_BLOCKS.map((block) => {
        const blockCount = items.filter((i) => block.stages.includes(i.stage)).length;
        return (
          <section key={block.number} className="rounded-xl border border-border bg-card p-4">
            <header className="flex items-baseline gap-2">
              <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                {block.number}
              </span>
              <h2 className="text-base font-semibold text-foreground">{block.title}</h2>
              <span className="text-xs text-muted-foreground">
                {blockCount} caso{blockCount === 1 ? "" : "s"}
              </span>
            </header>

            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {block.stages.map((stage) => {
                const columnItems = items.filter((i) => i.stage === stage);
                const isTarget = dropTarget === stage && draggingId !== null;
                return (
                  <div
                    key={stage}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dropTarget !== stage) setDropTarget(stage);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                        setDropTarget((current) => (current === stage ? null : current));
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(stage);
                    }}
                    className={`w-64 shrink-0 rounded-lg border p-3 transition-colors ${
                      isTarget
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {STAGE_LABELS[stage]}
                      </p>
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                        {columnItems.length}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      {columnItems.length === 0 ? (
                        <p
                          className={`rounded-md border border-dashed px-2 py-3 text-center text-xs ${
                            isTarget
                              ? "border-primary/50 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {isTarget ? "Solte aqui para mover" : "Nenhum caso"}
                        </p>
                      ) : (
                        columnItems.map((item) => {
                          const cnpj = formatCnpj(item.cnpj);
                          const isDragging = draggingId === item.id;
                          return (
                            <article
                              key={item.id}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData("text/plain", item.id);
                                event.dataTransfer.effectAllowed = "move";
                                setDraggingId(item.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setDropTarget(null);
                              }}
                              className={`rounded-md border border-border bg-card p-3 transition-opacity ${
                                isDragging ? "opacity-40" : "cursor-grab active:cursor-grabbing"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => onOpen(item.id)}
                                className="block w-full truncate text-left text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                              >
                                {item.client_name || "Sem identificação"}
                              </button>
                              {cnpj ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">CNPJ {cnpj}</p>
                              ) : null}
                              <LatestSummary item={item} />
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.simulations.length} cálculo
                                {item.simulations.length === 1 ? "" : "s"} no histórico
                              </p>
                              <div className="mt-2">
                                <StageSelect
                                  value={item.stage}
                                  disabled={busyId === item.id}
                                  onChange={(next) => onStageChange(item.id, next)}
                                />
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
