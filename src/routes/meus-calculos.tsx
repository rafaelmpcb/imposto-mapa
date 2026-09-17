import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import { MemorandoDialog } from "@/components/memorando/MemorandoDialog";
import type { CnpjData } from "@/lib/cnpj/types";
import {
  deleteSimulation,
  listSimulations,
  renameSimulation,
  setSimulationShare,
  type SavedSimulation,
} from "@/lib/simulations.functions";
import { brl, pct } from "@/lib/tax/calc";
import { getActivity } from "@/lib/tax/constants";
import { RESTORE_KEY } from "@/lib/tax/session";

const TITLE = "Meus Cálculos — histórico de simulações da Reforma Tributária";
const DESCRIPTION =
  "Área restrita do escritório: histórico cronológico das simulações de impacto da Reforma Tributária, com opção de reabrir cada cálculo.";

export const Route = createFileRoute("/meus-calculos")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCalculations,
});

const CODE_KEY = "reforma-advogado-code";

const TAXPAYER_LABELS: Record<string, string> = {
  pf: "Pessoa Física (CLT)",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

function MyCalculations() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listSimulations);
  const removeItem = useServerFn(deleteSimulation);
  const rename = useServerFn(renameSimulation);
  const share = useServerFn(setSimulationShare);

  const [code, setCode] = useState("");
  const [items, setItems] = useState<SavedSimulation[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [memoFor, setMemoFor] = useState<SavedSimulation | null>(null);

  const load = async (accessCode: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchList({ data: { code: accessCode } });
      if (!res.ok) {
        setError("Código de acesso inválido.");
        setItems(null);
        sessionStorage.removeItem(CODE_KEY);
        return;
      }
      setItems(res.items);
      sessionStorage.setItem(CODE_KEY, accessCode);
    } catch {
      setError("Não foi possível carregar o histórico agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(CODE_KEY);
    if (saved) {
      setCode(saved);
      void load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reopen = (item: SavedSimulation) => {
    localStorage.setItem(
      RESTORE_KEY,
      JSON.stringify({
        id: item.id,
        input: item.input,
        year: item.year_id,
        clientName: item.client_name ?? "",
        cnpjData: item.cnpj_data ?? null,
      }),
    );
    void navigate({ to: "/simulador" });
  };

  const handleDelete = async (id: string) => {
    const res = await removeItem({ data: { code, id } });
    if (!res.ok) {
      setError("Código de acesso inválido.");
      return;
    }
    setConfirmId(null);
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
  };

  const handleRename = async (id: string) => {
    const res = await rename({ data: { code, id, clientName: editingName } });
    if (!res.ok) {
      setError("Código de acesso inválido.");
      return;
    }
    setItems((prev) =>
      (prev ?? []).map((i) =>
        i.id === id ? { ...i, client_name: editingName.trim() || null } : i,
      ),
    );
    setEditingId(null);
  };

  const handleShare = async (item: SavedSimulation) => {
    const enabled = !item.share_enabled;
    const res = await share({ data: { code, id: item.id, enabled } });
    if (!res.ok) {
      setError("Código de acesso inválido.");
      return;
    }
    setItems((prev) =>
      (prev ?? []).map((i) =>
        i.id === item.id ? { ...i, share_enabled: enabled, share_token: res.token } : i,
      ),
    );
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt("Copie o link:", url);
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!items) return [];
    if (!term) return items;
    return items.filter((i) => (i.client_name ?? "").toLowerCase().includes(term));
  }, [items, query]);

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-4xl px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
            Área restrita do escritório
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Meus Cálculos</h1>
          <p className="mt-3 max-w-2xl text-sm text-navy-foreground/80">
            Histórico das simulações realizadas, em ordem cronológica, para consulta e reabertura.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        {items === null ? (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void load(code);
              }}
            >
              <Field label="Código de acesso">
                <TextInput
                  type="password"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Informe o código do escritório"
                  autoComplete="off"
                />
              </Field>
              {error ? <Notice tone="warning">{error}</Notice> : null}
              <Button type="submit" disabled={loading || code.trim().length === 0}>
                {loading ? "Verificando..." : "Acessar histórico"}
              </Button>
            </form>
          </section>
        ) : (
          <section className="space-y-4">
            <Field label="Buscar por nome do cliente ou empresa">
              <TextInput
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Digite parte do nome"
                autoComplete="off"
              />
            </Field>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {filtered.length} de {items.length} cálculo{items.length === 1 ? "" : "s"}
              </p>
              <Button variant="ghost" onClick={() => void load(code)}>
                Atualizar
              </Button>
            </div>

            {error ? <Notice tone="warning">{error}</Notice> : null}

            {filtered.length === 0 ? (
              <Notice>Nenhum cálculo encontrado.</Notice>
            ) : (
              <ul className="space-y-3">
                {filtered.map((item) => {
                  const diff = Number(item.reform_total) - Number(item.current_total);
                  const worse = diff > 0.004;
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-border bg-card p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {editingId === item.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                placeholder="Nome do cliente ou empresa"
                                className="min-w-48 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                              />
                              <Button onClick={() => void handleRename(item.id)}>Salvar</Button>
                              <Button variant="ghost" onClick={() => setEditingId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <p className="truncate text-base font-semibold text-foreground">
                              {item.client_name || "Sem identificação"}
                            </p>
                          )}
                          {item.cnpj ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              CNPJ {item.cnpj}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString("pt-BR")} ·{" "}
                            {TAXPAYER_LABELS[item.taxpayer_type] ?? item.taxpayer_type} ·{" "}
                            {getActivity(item.activity_id).label} · {item.uf} · ano {item.year_id}
                          </p>
                          <p className="mt-2 text-sm tabular-nums">
                            {brl(Number(item.current_total))} → {brl(Number(item.reform_total))}{" "}
                            <span
                              className={`font-semibold ${worse ? "text-danger" : "text-success"}`}
                            >
                              ({worse ? "+" : "−"}
                              {brl(Math.abs(diff))} / mês · {pct(Number(item.current_rate))} →{" "}
                              {pct(Number(item.reform_rate))})
                            </span>
                          </p>

                          {item.share_enabled && item.share_token ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                              <span className="truncate text-xs text-muted-foreground">
                                /s/{item.share_token}
                              </span>
                              <Button
                                variant="ghost"
                                onClick={() => void copyLink(item.share_token as string)}
                              >
                                {copied === item.share_token ? "Link copiado" : "Copiar link"}
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="ghost" onClick={() => reopen(item)}>
                            Reabrir
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingName(item.client_name ?? "");
                            }}
                          >
                            Renomear
                          </Button>
                          <Button variant="ghost" onClick={() => void handleShare(item)}>
                            {item.share_enabled ? "Desativar link" : "Compartilhar"}
                          </Button>
                          <Button variant="ghost" onClick={() => setMemoFor(item)}>
                            Gerar Memorando
                          </Button>
                          {confirmId === item.id ? (
                            <>
                              <Button onClick={() => void handleDelete(item.id)}>
                                Confirmar exclusão
                              </Button>
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
            )}

            <div className="flex flex-wrap gap-4 pt-2">
              <Link to="/simulador" className="text-sm font-semibold text-navy underline">
                Voltar ao simulador
              </Link>
              <Link to="/config-aliquotas" className="text-sm font-semibold text-navy underline">
                Configuração de alíquotas
              </Link>
            </div>
          </section>
        )}
      </div>
      {memoFor ? (
        <MemorandoDialog
          cnpjData={(memoFor.cnpj_data as unknown as CnpjData | null) ?? null}
          clientName={memoFor.client_name ?? ""}
          onClose={() => setMemoFor(null)}
        />
      ) : null}
    </main>
  );
}
