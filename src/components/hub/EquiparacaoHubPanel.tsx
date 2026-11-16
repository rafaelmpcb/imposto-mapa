import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  excluirEstudoEquiparacao,
  listEstudosEquiparacao,
  type EstudoEquiparacaoRow,
} from "@/lib/equiparacao.functions";
import { brl } from "@/lib/tax/calc";

/** Estudos de equiparação hospitalar salvos, com acesso ao cálculo completo. */
export function EquiparacaoHubPanel({ caseNames }: { caseNames: Map<string, string> }) {
  const fetchAll = useServerFn(listEstudosEquiparacao);
  const remove = useServerFn(excluirEstudoEquiparacao);
  const [items, setItems] = useState<EstudoEquiparacaoRow[] | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => fetchAll({ data: undefined }));
      setItems(res.items);
    } catch {
      setError("Não foi possível carregar os estudos de equiparação.");
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
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Equiparação hospitalar de clínicas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie as NFS-e (XML/ZIP) ou a planilha de faturamento da clínica para separar consultas e
          procedimentos automaticamente. O indébito é corrigido pela Selic oficial, trimestre a trimestre.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/equiparacao-completa"
            className="rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-navy-foreground"
          >
            Novo cálculo com envio de documentos
          </Link>
          <Button variant="ghost" onClick={() => void load()}>Atualizar</Button>
        </div>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}
      {items && items.length === 0 ? (
        <Notice>Nenhum estudo salvo ainda. Faça o cálculo e vincule ao Caso da clínica.</Notice>
      ) : null}

      <ul className="space-y-3">
        {(items ?? []).map((item) => {
          const caseName = item.case_id ? caseNames.get(item.case_id) : null;
          const r = item.resultado;
          return (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{item.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {(item.fracao_procedimentos * 100).toFixed(1)}% procedimentos (
                    {item.origem_segregacao === "arquivos" ? "pelos documentos" : "estimado"}) ·{" "}
                    {item.meses_retroativos} meses
                  </p>
                  <p className="mt-2 text-sm tabular-nums">
                    Indébito com Selic {brl(r.indebitoAtualizado ?? 0)} · economia anual{" "}
                    {brl(r.economiaAnual ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {caseName ? `Caso: ${caseName}` : "Sem caso vinculado"}
                  </p>
                </div>
                {confirmId === item.id ? (
                  <div className="flex gap-2">
                    <Button onClick={() => void handleDelete(item.id)}>Confirmar exclusão</Button>
                    <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmId(item.id)}>Excluir</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
