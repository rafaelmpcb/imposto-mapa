import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Notice } from "@/components/simulator/ui";
import {
  excluirContratoAluguel,
  listTodosContratosAluguel,
  type ContratoAluguelRow,
} from "@/lib/aluguel.functions";
import { withAuthRetry } from "@/lib/auth-retry";
import { brl } from "@/lib/tax/calc";

const REGIME_LABELS: Record<string, string> = {
  real: "Lucro Real",
  presumido: "Lucro Presumido",
  simples: "Simples Nacional",
  pf_contribuinte: "PF contribuinte",
  pf_nao_contribuinte: "PF não contribuinte",
};

/** Contratos de locação simulados, agrupados por Caso vinculado. */
export function LocacaoHubPanel({
  caseNames,
}: {
  caseNames: Map<string, string>;
}) {
  const fetchAll = useServerFn(listTodosContratosAluguel);
  const remove = useServerFn(excluirContratoAluguel);
  const [items, setItems] = useState<ContratoAluguelRow[] | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => fetchAll({ data: undefined }));
      setItems(res.items);
    } catch {
      setError("Não foi possível carregar os contratos de locação.");
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
      setError("Não foi possível excluir este contrato.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items ? `${items.length} contrato${items.length === 1 ? "" : "s"} salvo${items.length === 1 ? "" : "s"}` : "Carregando contratos..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => void load()}>
            Atualizar
          </Button>
          <Link
            to="/aluguel"
            className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground"
          >
            Nova simulação de locação
          </Link>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {items && items.length === 0 ? (
        <Notice>
          Nenhum contrato salvo ainda. Faça uma simulação de locação e vincule ao caso do cliente.
        </Notice>
      ) : null}

      <ul className="space-y-3">
        {(items ?? []).map((item) => {
          const caseName = item.case_id ? caseNames.get(item.case_id) : null;
          return (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {item.titulo || "Contrato sem título"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {item.papel === "locador" ? "Locador" : "Locatário"} ·{" "}
                    {REGIME_LABELS[item.regime_locador] ?? item.regime_locador} · ano{" "}
                    {item.ano_referencia}
                  </p>
                  <p className="mt-2 text-sm tabular-nums text-foreground">
                    Aluguel mensal {brl(Number(item.aluguel_mensal))}
                    {item.contraparte ? ` · ${item.contraparte}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
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
