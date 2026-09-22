import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  excluirEstudoMonofasico,
  listEstudosMonofasico,
  type EstudoMonofasicoRow,
} from "@/lib/monofasico.functions";
import { REGIMES, SEGMENTOS } from "@/lib/monofasico/calculo";
import { brl } from "@/lib/tax/calc";

const segLabel = (id: string) => SEGMENTOS.find((s) => s.id === id)?.label ?? id;
const regLabel = (id: string) => REGIMES.find((r) => r.id === id)?.label ?? id;

/** Estudos estimativos de recuperação de PIS/COFINS monofásico salvos pelo escritório. */
export function MonofasicoHubPanel({ caseNames }: { caseNames: Map<string, string> }) {
  const fetchAll = useServerFn(listEstudosMonofasico);
  const remove = useServerFn(excluirEstudoMonofasico);
  const [items, setItems] = useState<EstudoMonofasicoRow[] | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => fetchAll({ data: undefined }));
      setItems(res.items);
    } catch {
      setError("Não foi possível carregar os estudos de recuperação monofásica.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await withAuthRetry(() => remove({ data: { id } }));
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
      setConfirmId(null);
    } catch {
      setError("Não foi possível excluir este estudo.");
    }
  };

  const total = (items ?? []).reduce((s, i) => s + (i.resultado?.totalRecuperavel ?? 0), 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items
            ? `${items.length} estudo${items.length === 1 ? "" : "s"} salvo${items.length === 1 ? "" : "s"} · potencial estimado de ${brl(total)}`
            : "Carregando estudos..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => void load()}>
            Atualizar
          </Button>
          <Link
            to="/monofasico"
            className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground"
          >
            Novo estudo monofásico
          </Link>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {items && items.length === 0 ? (
        <Notice>
          Nenhum estudo salvo ainda. Faça a estimativa de recuperação monofásica do cliente e
          vincule ao caso.
        </Notice>
      ) : null}

      <ul className="space-y-3">
        {(items ?? []).map((item) => {
          const caseName = item.case_id ? caseNames.get(item.case_id) : null;
          const res = item.resultado;
          return (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {item.titulo || "Estudo sem título"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {segLabel(item.segmento)} · {regLabel(item.regime)} ·{" "}
                    {item.participacao_monofasica_pct}% da receita · {item.meses_retroativos} meses
                  </p>
                  <p className="mt-2 text-sm tabular-nums text-foreground">
                    Faturamento {brl(Number(item.faturamento_mensal))}/mês
                    {res ? ` · potencial a recuperar ${brl(res.totalRecuperavel)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {res ? `Economia anual futura: ${brl(res.economiaAnual)}. ` : ""}
                    {caseName ? `Caso: ${caseName}` : "Sem caso vinculado"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {confirmId === item.id ? (
                    <>
                      <Button onClick={() => void handleDelete(item.id)}>Confirmar exclusão</Button>
                      <Button variant="ghost" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirmId(item.id)}>
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
