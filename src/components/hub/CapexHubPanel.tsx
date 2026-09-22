import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  excluirEstudoCapex,
  listEstudosCapex,
  type EstudoCapexRow,
} from "@/lib/capex.functions";
import { REGIME_CAPEX_LABEL, TIPO_ATIVO_LABEL } from "@/lib/capex/calculo";
import { brl } from "@/lib/tax/calc";

/** Estudos de CAPEX salvos, com o resultado resumido de cada um. */
export function CapexHubPanel({ caseNames }: { caseNames: Map<string, string> }) {
  const fetchAll = useServerFn(listEstudosCapex);
  const remove = useServerFn(excluirEstudoCapex);
  const [items, setItems] = useState<EstudoCapexRow[] | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => fetchAll({ data: undefined }));
      setItems(res.items);
    } catch {
      setError("Não foi possível carregar os estudos de CAPEX.");
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items
            ? `${items.length} estudo${items.length === 1 ? "" : "s"} salvo${items.length === 1 ? "" : "s"}`
            : "Carregando estudos..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => void load()}>
            Atualizar
          </Button>
          <Link
            to="/capex"
            className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground"
          >
            Novo estudo de CAPEX
          </Link>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {items && items.length === 0 ? (
        <Notice>
          Nenhum estudo salvo ainda. Simule uma aquisição de ativo e vincule ao caso do cliente.
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
                    {TIPO_ATIVO_LABEL[item.tipo_ativo] ?? item.tipo_ativo} ·{" "}
                    {REGIME_CAPEX_LABEL[item.regime] ?? item.regime} · aquisição em{" "}
                    {item.ano_aquisicao}
                  </p>
                  <p className="mt-2 text-sm tabular-nums text-foreground">
                    Investimento {brl(Number(item.valor_investimento))}
                    {res ? ` · crédito a valor presente ${brl(res.anoSelecionado.vpl)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {res ? `Melhor janela de compra: ${res.melhorAno}. ` : ""}
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
