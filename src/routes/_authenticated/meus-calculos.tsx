import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import { MemorandoDialog } from "@/components/memorando/MemorandoDialog";
import { HelpButton } from "@/components/help/HelpPanel";
import { CaseKanban } from "@/components/cases/CaseKanban";
import { DiagnosticoCompleto } from "@/components/cases/DiagnosticoCompleto";
import { FunnelPanel } from "@/components/cases/FunnelPanel";
import { StageSelect } from "@/components/cases/StageSelect";
import type { CnpjData } from "@/lib/cnpj/types";
import {
  deleteCase,
  getFunnelStats,
  listCases,
  renameCase,
  updateCaseStage,
  type CaseRecord,
  type StageStat,
} from "@/lib/cases.functions";
import { STAGE_LABELS, formatCnpj, type CaseStage } from "@/lib/cases/stages";
import {
  deleteSimulationsBulk,
  deleteSimulation,
  renameSimulation,
  setSimulationShare,
  type SavedSimulation,
} from "@/lib/simulations.functions";
import { withAuthRetry } from "@/lib/auth-retry";
import { brl, pct } from "@/lib/tax/calc";
import { getActivity } from "@/lib/tax/constants";
import { RESTORE_KEY } from "@/lib/tax/session";

const TITLE = "Meus Cálculos — casos e funil comercial da Reforma Tributária";
const DESCRIPTION =
  "Área restrita do escritório: casos de clientes com histórico de simulações da Reforma Tributária e funil comercial em Kanban.";

export const Route = createFileRoute("/_authenticated/meus-calculos")({
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

const TAXPAYER_LABELS: Record<string, string> = {
  pf: "Pessoa Física (CLT)",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

function MyCalculations() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listCases);
  const fetchFunnel = useServerFn(getFunnelStats);
  const changeStage = useServerFn(updateCaseStage);
  const renameCaseFn = useServerFn(renameCase);
  const removeCase = useServerFn(deleteCase);
  const removeItem = useServerFn(deleteSimulation);
  const removeBulk = useServerFn(deleteSimulationsBulk);
  const rename = useServerFn(renameSimulation);
  const share = useServerFn(setSimulationShare);

  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"kanban" | "funnel">("kanban");
  const [funnel, setFunnel] = useState<{ stages: StageStat[]; totalCases: number } | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editingCaseName, setEditingCaseName] = useState("");
  const [confirmCaseId, setConfirmCaseId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [memoFor, setMemoFor] = useState<SavedSimulation | null>(null);
  const [diagCaseId, setDiagCaseId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const loadFunnel = async () => {
    try {
      const res = await fetchFunnel({ data: undefined });
      if (res.ok) setFunnel({ stages: res.stages, totalCases: res.totalCases });
    } catch {
      /* métricas são complementares; a lista continua funcionando */
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchList({ data: undefined });
      if (!res.ok) {
        setError("Não foi possível carregar os casos.");
        return;
      }
      setCases(res.items);
      void loadFunnel();
      setSelected(new Set());
      setConfirmBulk(false);
    } catch {
      setError("Não foi possível carregar os casos agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const patchSimulations = (
    updater: (items: SavedSimulation[]) => SavedSimulation[],
  ) => {
    setCases((prev) =>
      (prev ?? []).map((c) => ({ ...c, simulations: updater(c.simulations) })),
    );
  };

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

  const handleStageChange = async (id: string, stage: CaseStage) => {
    const previous = cases;
    setBusyCaseId(id);
    setCases((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, stage } : c)));
    try {
      const res = await withAuthRetry(() => changeStage({ data: { id, stage } }));
      if (!res.ok) throw new Error("fail");
      void loadFunnel();
    } catch {
      setCases(previous);
      setError("Não foi possível mover o caso de etapa.");
    } finally {
      setBusyCaseId(null);
    }
  };

  const handleRenameCase = async (id: string) => {
    const res = await renameCaseFn({ data: { id, clientName: editingCaseName } });
    if (!res.ok) {
      setError("Não foi possível concluir a ação.");
      return;
    }
    setCases((prev) =>
      (prev ?? []).map((c) =>
        c.id === id ? { ...c, client_name: editingCaseName.trim() || null } : c,
      ),
    );
    setEditingCaseId(null);
  };

  const handleDeleteCase = async (id: string) => {
    try {
      const res = await removeCase({ data: { id } });
      if (!res.ok) throw new Error("fail");
      setCases((prev) => (prev ?? []).filter((c) => c.id !== id));
      setConfirmCaseId(null);
      if (openCaseId === id) setOpenCaseId(null);
    } catch {
      setError("Não foi possível excluir o caso.");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await removeItem({ data: { id } });
    if (!res.ok) {
      setError("Não foi possível concluir a ação.");
      return;
    }
    setConfirmId(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    patchSimulations((items) => items.filter((i) => i.id !== id));
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmBulk(false);
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await removeBulk({ data: { ids } });
      if (!res.ok) {
        setError("Não foi possível concluir a ação.");
        return;
      }
      setSelected(new Set());
      setConfirmBulk(false);
      patchSimulations((items) => items.filter((i) => !ids.includes(i.id)));
    } catch {
      setError("Não foi possível excluir os cálculos selecionados. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async (id: string) => {
    const res = await rename({ data: { id, clientName: editingName } });
    if (!res.ok) {
      setError("Não foi possível concluir a ação.");
      return;
    }
    patchSimulations((items) =>
      items.map((i) => (i.id === id ? { ...i, client_name: editingName.trim() || null } : i)),
    );
    setEditingId(null);
  };

  const handleShare = async (item: SavedSimulation) => {
    const enabled = !item.share_enabled;
    const res = await share({ data: { id: item.id, enabled } });
    if (!res.ok) {
      setError("Não foi possível concluir a ação.");
      return;
    }
    patchSimulations((items) =>
      items.map((i) =>
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
    if (!cases) return [];
    if (!term) return cases;
    return cases.filter(
      (c) =>
        (c.client_name ?? "").toLowerCase().includes(term) ||
        (c.cnpj ?? "").includes(term.replace(/\D/g, "")),
    );
  }, [cases, query]);

  const renderSimulation = (item: SavedSimulation) => {
    const diff = Number(item.reform_total) - Number(item.current_total);
    const worse = diff > 0.004;
    return (
      <li key={item.id} className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <label className="flex cursor-pointer items-center pt-1">
            <input
              type="checkbox"
              aria-label={`Selecionar ${item.client_name || "cálculo sem identificação"}`}
              className="h-4 w-4 accent-[var(--color-navy,#1e3a5f)]"
              checked={selected.has(item.id)}
              onChange={() => toggleSelected(item.id)}
            />
          </label>
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
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(item.created_at).toLocaleString("pt-BR")} ·{" "}
              {TAXPAYER_LABELS[item.taxpayer_type] ?? item.taxpayer_type} ·{" "}
              {getActivity(item.activity_id).label} · {item.uf} · ano {item.year_id}
            </p>
            <p className="mt-2 text-sm tabular-nums">
              {brl(Number(item.current_total))} → {brl(Number(item.reform_total))}{" "}
              <span className={`font-semibold ${worse ? "text-danger" : "text-success"}`}>
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
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
            Área restrita do escritório
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Meus Cálculos</h1>
          <p className="mt-3 max-w-2xl text-sm text-navy-foreground/80">
            Casos de clientes, com o histórico de simulações de cada um e o funil comercial.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-navy-foreground/80">
            {userEmail ? <span>Conectado como {userEmail}</span> : null}
            <HelpButton />
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-navy-foreground/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-navy-foreground/10"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {cases === null ? (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
            {error ? (
              <div className="space-y-4">
                <Notice tone="warning">{error}</Notice>
                <Button onClick={() => void load()}>Tentar novamente</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {loading ? "Carregando casos..." : "Nenhum caso encontrado."}
              </p>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <Field label="Buscar por nome do cliente ou empresa">
                  <TextInput
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Digite parte do nome"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <div className="inline-flex rounded-md border border-border bg-card p-1">
                {(["kanban", "funnel"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setView(mode);
                      setOpenCaseId(null);
                    }}
                    className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                      view === mode
                        ? "bg-navy text-navy-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {mode === "kanban" ? "Kanban" : "Funil"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {filtered.length} de {cases.length} caso{cases.length === 1 ? "" : "s"}
              </p>
              <Button variant="ghost" onClick={() => void load()}>
                Atualizar
              </Button>
            </div>

            {error ? <Notice tone="warning">{error}</Notice> : null}

            {openCaseId ? (
              <div>
                <Button variant="ghost" onClick={() => setOpenCaseId(null)}>
                  ← Voltar ao {view === "funnel" ? "funil" : "Kanban"}
                </Button>
              </div>
            ) : null}

            {!openCaseId && view === "funnel" ? (
              funnel ? (
                <FunnelPanel stages={funnel.stages} totalCases={funnel.totalCases} />
              ) : (
                <Notice>Carregando as métricas do funil...</Notice>
              )
            ) : !openCaseId && filtered.length === 0 ? (
              <Notice>Nenhum caso encontrado.</Notice>
            ) : !openCaseId ? (
              <CaseKanban
                items={filtered}
                busyId={busyCaseId}
                onStageChange={(id, stage) => void handleStageChange(id, stage)}
                onOpen={(id) => setOpenCaseId(id)}
              />
            ) : (
              <ul className="space-y-3">
                {cases.filter((c) => c.id === openCaseId).map((item) => {
                  const latest = item.simulations[0];
                  const cnpj = formatCnpj(item.cnpj);
                  const isOpen = openCaseId === item.id;
                  const diff = latest
                    ? Number(latest.reform_total) - Number(latest.current_total)
                    : 0;
                  const worse = diff > 0.004;
                  return (
                    <li key={item.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {editingCaseId === item.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editingCaseName}
                                onChange={(event) => setEditingCaseName(event.target.value)}
                                placeholder="Nome do cliente ou empresa"
                                className="min-w-48 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                              />
                              <Button onClick={() => void handleRenameCase(item.id)}>Salvar</Button>
                              <Button variant="ghost" onClick={() => setEditingCaseId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOpenCaseId(isOpen ? null : item.id)}
                              className="block max-w-full truncate text-left text-base font-semibold text-foreground underline-offset-2 hover:underline"
                            >
                              {item.client_name || "Sem identificação"}
                            </button>
                          )}
                          {cnpj ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">CNPJ {cnpj}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Etapa: {STAGE_LABELS[item.stage]} · {item.simulations.length} cálculo
                            {item.simulations.length === 1 ? "" : "s"}
                          </p>
                          {latest ? (
                            <p className="mt-2 text-sm tabular-nums">
                              {TAXPAYER_LABELS[latest.taxpayer_type] ?? latest.taxpayer_type} ·{" "}
                              {brl(Number(latest.current_total))} →{" "}
                              {brl(Number(latest.reform_total))}{" "}
                              <span
                                className={`font-semibold ${worse ? "text-danger" : "text-success"}`}
                              >
                                ({worse ? "+" : "−"}
                                {brl(Math.abs(diff))} / mês)
                              </span>
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Sem cálculos vinculados.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-56">
                            <StageSelect
                              value={item.stage}
                              disabled={busyCaseId === item.id}
                              onChange={(stage) => void handleStageChange(item.id, stage)}
                            />
                          </div>
                           <Button
                             onClick={() =>
                               setDiagCaseId(diagCaseId === item.id ? null : item.id)
                             }
                           >
                             {diagCaseId === item.id
                               ? "Fechar Diagnóstico Completo"
                               : "Diagnóstico Completo"}
                           </Button>
                           <Button
                             variant="ghost"
                             onClick={() => setOpenCaseId(isOpen ? null : item.id)}
                           >
                             {isOpen ? "Fechar caso" : "Abrir caso"}
                           </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingCaseId(item.id);
                              setEditingCaseName(item.client_name ?? "");
                            }}
                          >
                            Renomear caso
                          </Button>
                          {confirmCaseId === item.id ? (
                            <>
                              <Button onClick={() => void handleDeleteCase(item.id)}>
                                Confirmar exclusão do caso
                              </Button>
                              <Button variant="ghost" onClick={() => setConfirmCaseId(null)}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" onClick={() => setConfirmCaseId(item.id)}>
                              Excluir caso
                            </Button>
                          )}
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="mt-4 border-t border-border pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">
                              Histórico de cálculos ({item.simulations.length})
                              {selected.size > 0
                                ? ` · ${selected.size} selecionado${selected.size === 1 ? "" : "s"}`
                                : ""}
                            </p>
                            {item.simulations.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-[var(--color-navy,#1e3a5f)]"
                                    checked={item.simulations.every((s) => selected.has(s.id))}
                                    onChange={() => {
                                      const all = item.simulations.every((s) =>
                                        selected.has(s.id),
                                      );
                                      setSelected(
                                        all ? new Set() : new Set(item.simulations.map((s) => s.id)),
                                      );
                                      setConfirmBulk(false);
                                    }}
                                  />
                                  Selecionar todos
                                </label>
                                {selected.size > 0 ? (
                                  confirmBulk ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        onClick={() => setConfirmBulk(false)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        disabled={deleting}
                                        onClick={() => void handleBulkDelete()}
                                      >
                                        {deleting
                                          ? "Excluindo..."
                                          : `Confirmar exclusão (${selected.size})`}
                                      </Button>
                                    </>
                                  ) : (
                                    <Button variant="ghost" onClick={() => setConfirmBulk(true)}>
                                      Excluir selecionados ({selected.size})
                                    </Button>
                                  )
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {item.simulations.length === 0 ? (
                            <Notice>Este caso ainda não tem cálculos vinculados.</Notice>
                          ) : (
                            <ul className="mt-3 space-y-3">
                              {item.simulations.map(renderSimulation)}
                            </ul>
                          )}
                        </div>
                      ) : null}
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
              <Link to="/parametros" className="text-sm font-semibold text-navy underline">
                Parâmetros e base legal
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
