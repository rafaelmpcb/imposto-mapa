import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { Button, Notice, Select } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  atualizarStatusContrato,
  excluirContrato,
  listContratos,
  STATUS_CONTRATO_LABEL,
  type ContratoRow,
  type StatusContrato,
} from "@/lib/contratos.functions";
import { CENARIO_LABEL, REGIME_PRESTADOR_LABEL } from "@/lib/contratos/calculo";
import { brl } from "@/lib/tax/calc";

const SEMAFORO = {
  baixo: { label: "Baixo", cls: "bg-emerald-100 text-emerald-800" },
  medio: { label: "Médio", cls: "bg-amber-100 text-amber-800" },
  alto: { label: "Alto", cls: "bg-rose-100 text-rose-800" },
} as const;

/** Carteira de contratos em reequilíbrio, com status e semáforo de risco. */
export function ContratosHubPanel({ caseNames }: { caseNames: Map<string, string> }) {
  const fetchAll = useServerFn(listContratos);
  const remove = useServerFn(excluirContrato);
  const setStatus = useServerFn(atualizarStatusContrato);

  const [items, setItems] = useState<ContratoRow[] | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | StatusContrato>("todos");

  const load = async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => fetchAll({ data: undefined }));
      setItems(res.items);
    } catch {
      setError("Não foi possível carregar os contratos.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visiveis = useMemo(
    () => (items ?? []).filter((i) => filtro === "todos" || i.status === filtro),
    [items, filtro],
  );

  const totais = useMemo(() => {
    const base = items ?? [];
    const atual = base.reduce((s, i) => s + i.preco_mensal_atual, 0);
    const sugerido = base.reduce((s, i) => {
      const c = i.resultado?.cenarios.find((x) => x.id === i.cenario);
      return s + (c?.precoSugerido ?? i.preco_mensal_atual);
    }, 0);
    const criticos = base.filter((i) => i.resultado?.semaforo === "alto").length;
    return { atual, sugerido, criticos, quantidade: base.length };
  }, [items]);

  const handleDelete = async (id: string) => {
    try {
      await withAuthRetry(() => remove({ data: { id } }));
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
      setConfirmId(null);
    } catch {
      setError("Não foi possível excluir este contrato.");
    }
  };

  const handleStatus = async (id: string, status: StatusContrato) => {
    setItems((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await withAuthRetry(() => setStatus({ data: { id, status } }));
    } catch {
      setError("Não foi possível atualizar o status.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items
            ? `${items.length} contrato${items.length === 1 ? "" : "s"} em acompanhamento`
            : "Carregando contratos..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => void load()}>
            Atualizar
          </Button>
          <Link
            to="/contratos"
            className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground hover:opacity-90"
          >
            Novo contrato
          </Link>
        </div>
      </div>

      {error ? <Notice>{error}</Notice> : null}

      {items && items.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Contratos", value: String(totais.quantidade) },
              { label: "Preço mensal hoje", value: brl(totais.atual) },
              { label: "Preço mensal sugerido", value: brl(totais.sugerido) },
              { label: "Contratos críticos", value: String(totais.criticos) },
            ].map((k) => (
              <article key={k.label} className="rounded-xl border border-border bg-secondary p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{k.value}</p>
              </article>
            ))}
          </div>

          <div className="max-w-xs">
            <Select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as "todos" | StatusContrato)}
            >
              <option value="todos">Todos os status</option>
              {(Object.keys(STATUS_CONTRATO_LABEL) as StatusContrato[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONTRATO_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </>
      ) : null}

      {items && items.length === 0 ? (
        <Notice>
          Nenhum contrato salvo ainda. Use a calculadora de reequilíbrio e salve o estudo para
          acompanhar a carteira aqui.
        </Notice>
      ) : null}

      <div className="space-y-3">
        {visiveis.map((item) => {
          const c = item.resultado?.cenarios.find((x) => x.id === item.cenario);
          const sem = item.resultado ? SEMAFORO[item.resultado.semaforo] : null;
          return (
            <article key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{item.titulo}</h3>
                    {sem ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sem.cls}`}
                      >
                        Risco {sem.label}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.contraparte ? `${item.contraparte} · ` : ""}
                    {REGIME_PRESTADOR_LABEL[item.regime_prestador]} ·{" "}
                    {CENARIO_LABEL[item.cenario]} · ano {item.ano_referencia}
                    {item.case_id && caseNames.get(item.case_id)
                      ? ` · Caso ${caseNames.get(item.case_id)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={item.status}
                    onChange={(e) => void handleStatus(item.id, e.target.value as StatusContrato)}
                  >
                    {(Object.keys(STATUS_CONTRATO_LABEL) as StatusContrato[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_CONTRATO_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  {confirmId === item.id ? (
                    <>
                      <Button variant="ghost" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                      <Button onClick={() => void handleDelete(item.id)}>Confirmar exclusão</Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirmId(item.id)}>
                      Excluir
                    </Button>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Preço hoje</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {brl(item.preco_mensal_atual)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Preço sugerido</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {c ? brl(c.precoSugerido) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Variação</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {c ? `${c.variacaoPrecoPct.toFixed(2)}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Absorvido por crédito</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {c ? brl(c.aumentoAbsorvidoPorCredito) : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
