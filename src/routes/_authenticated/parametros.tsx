import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { HelpButton } from "@/components/help/HelpPanel";
import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import {
  addParameterVersion,
  getParameterHistory,
  getParameters,
  type ParameterVersion,
  type ParametersSnapshot,
} from "@/lib/tax-parameters.functions";
import {
  PARAMETERS,
  PARAMETER_GROUPS,
  formatParamValue,
  parseParamInput,
  toParamInput,
  type ParamDef,
} from "@/lib/tax/parameters";

const TITLE = "Parâmetros de cálculo — área restrita";
const DESCRIPTION =
  "Área restrita do escritório para cadastrar alíquotas, faixas e suas bases legais, com histórico de vigência.";

export const Route = createFileRoute("/_authenticated/parametros")({
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
  component: ParametersPage,
});

const fmtDate = (iso: string) =>
  new Date(`${iso.length === 10 ? `${iso}T00:00:00` : iso}`).toLocaleDateString("pt-BR");

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const today = () => new Date().toISOString().slice(0, 10);

function ParameterRow({
  def,
  current,
  history,
  onSaved,
}: {
  def: ParamDef;
  current: ParameterVersion | undefined;
  history: ParameterVersion[];
  onSaved: () => Promise<void>;
}) {
  const add = useServerFn(addParameterVersion);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [value, setValue] = useState(() => toParamInput(def, current?.value ?? def.fallback));
  const [date, setDate] = useState(today);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const parsed = parseParamInput(def, value);
    if (!Number.isFinite(parsed)) {
      setError("Informe um número válido.");
      return;
    }
    if (!source.trim()) {
      setError("Informe a base legal ou fonte da alteração.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await add({ data: { key: def.key, value: parsed, effectiveFrom: date, source } });
      setSource("");
      setOpen(false);
      await onSaved();
    } catch {
      setError("Não foi possível cadastrar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[14rem] flex-1">
          <p className="text-sm font-semibold">{def.label}</p>
          <p className="mt-0.5 text-sm tabular-nums">
            {formatParamValue(def, current?.value ?? def.fallback)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vigente desde:{" "}
            {current ? fmtDate(current.effectiveFrom) : "valor padrão do sistema"} · Fonte:{" "}
            {current?.source || "LC 214/2025 (padrão de referência)"}
            {current ? ` · Cadastrado em ${fmtDateTime(current.createdAt)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {history.length ? (
            <Button variant="ghost" onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? "Ocultar histórico" : `Histórico (${history.length})`}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancelar" : "Atualizar"}
          </Button>
        </div>
      </div>

      {showHistory ? (
        <ul className="mt-3 space-y-1 rounded-md bg-secondary p-3 text-xs text-muted-foreground">
          {history.map((v) => (
            <li key={v.id}>
              <strong className="text-foreground tabular-nums">{formatParamValue(def, v.value)}</strong>{" "}
              — de {fmtDate(v.effectiveFrom)} até {v.validUntil ? fmtDate(v.validUntil) : "hoje"} ·{" "}
              {v.source || "sem fonte informada"} · cadastrado em {fmtDateTime(v.createdAt)}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="mt-3 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
          <Field label={def.kind === "percent" ? "Novo valor (%)" : "Novo valor (R$)"}>
            <TextInput value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Vigente a partir de">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-base outline-none"
            />
          </Field>
          <Field label="Base legal / fonte">
            <TextInput
              value={source}
              placeholder="Resolução CGIBS nº 6/2026"
              onChange={(e) => setSource(e.target.value)}
            />
          </Field>
          {error ? (
            <div className="sm:col-span-3">
              <Notice tone="warning">{error}</Notice>
            </div>
          ) : null}
          <div className="sm:col-span-3">
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Salvando..." : "Cadastrar atualização"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ParametersPage() {
  const loadCurrent = useServerFn(getParameters);
  const loadHistory = useServerFn(getParameterHistory);
  const [snapshot, setSnapshot] = useState<ParametersSnapshot | null>(null);
  const [history, setHistory] = useState<Record<string, ParameterVersion[]>>({});
  const [openGroups, setOpenGroups] = useState<string[]>([PARAMETER_GROUPS[0] ?? ""]);

  const refresh = useCallback(async () => {
    const [snap, hist] = await Promise.all([loadCurrent(), loadHistory()]);
    setSnapshot(snap);
    setHistory(hist);
  }, [loadCurrent, loadHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-4xl px-5 py-10">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
              Área restrita do escritório
            </p>
            <HelpButton />
          </div>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Parâmetros de cálculo</h1>
          <p className="mt-3 max-w-2xl text-sm text-navy-foreground/80">
            Todas as alíquotas, tributos e faixas dos Anexos do Simples usados nas estimativas, com
            a data de vigência e a base legal de cada valor. Cada atualização cria um novo registro —
            o valor anterior fica guardado com o período em que esteve em vigor.
          </p>
          {snapshot?.lastUpdatedAt ? (
            <p className="mt-3 text-xs text-navy-foreground/70">
              Última atualização cadastrada em {fmtDateTime(snapshot.lastUpdatedAt)}.
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-5 py-8">
        {PARAMETER_GROUPS.map((group) => {
          const isOpen = openGroups.includes(group);
          const defs = PARAMETERS.filter((p) => p.group === group);
          return (
            <section key={group} className="rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) =>
                    prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
                  )
                }
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-base font-semibold">{group}</span>
                <span className="text-sm text-muted-foreground">
                  {defs.length} parâmetros {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen ? (
                <div className="px-5 pb-4">
                  {defs.map((def) => (
                    <ParameterRow
                      key={def.key}
                      def={def}
                      current={snapshot?.current[def.key]}
                      history={history[def.key] ?? []}
                      onSaved={refresh}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        <div className="flex flex-wrap gap-4 pt-2 text-sm font-semibold text-navy">
          <Link to="/meus-calculos" className="underline">
            Voltar para Meus Cálculos
          </Link>
          <Link to="/config-aliquotas" className="underline">
            Configuração rápida de alíquotas
          </Link>
        </div>
      </div>
    </main>
  );
}
