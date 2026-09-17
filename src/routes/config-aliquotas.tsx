import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import {
  getTaxConfig,
  getTaxConfigMeta,
  resetTaxConfig,
  saveTaxConfig,
  type TaxConfigMap,
  type TaxConfigMeta,
} from "@/lib/tax-config.functions";
import { applyTaxOverrides, TUNABLES } from "@/lib/tax/constants";

const TITLE = "Configuração de alíquotas — área restrita";
const DESCRIPTION =
  "Área restrita do escritório para ajustar as alíquotas de referência usadas nas estimativas do simulador.";

export const Route = createFileRoute("/config-aliquotas")({
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
  component: TaxConfigPage,
});

const CODE_KEY = "reforma-advogado-code";

const toPercentText = (fraction: number) =>
  (fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 });

const fromPercentText = (text: string) => Number(text.replace(",", ".")) / 100;

const formatUpdatedAt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function TaxConfigPage() {
  const load = useServerFn(getTaxConfig);
  const loadMeta = useServerFn(getTaxConfigMeta);
  const save = useServerFn(saveTaxConfig);
  const reset = useServerFn(resetTaxConfig);

  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<TaxConfigMeta>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fill = (stored: TaxConfigMap) => {
    const next: Record<string, string> = {};
    for (const def of TUNABLES) {
      const raw = stored[def.key];
      next[def.key] = toPercentText(typeof raw === "number" ? raw : def.fallback);
    }
    setValues(next);
  };

  useEffect(() => {
    void load().then((stored) => {
      fill(stored);
      const saved = sessionStorage.getItem(CODE_KEY);
      if (saved) {
        setCode(saved);
        setUnlocked(true);
      }
    });
    void loadMeta().then(setMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload: TaxConfigMap = {};
      for (const def of TUNABLES) {
        const parsed = fromPercentText(values[def.key] ?? "");
        payload[def.key] = Number.isFinite(parsed) ? parsed : def.fallback;
      }
      const res = await save({ data: { code, values: payload } });
      if (!res.ok) {
        setError("Código de acesso inválido.");
        setUnlocked(false);
        sessionStorage.removeItem(CODE_KEY);
        return;
      }
      sessionStorage.setItem(CODE_KEY, code);
      setUnlocked(true);
      applyTaxOverrides(payload);
      void loadMeta().then(setMeta);
      setMessage("Alíquotas atualizadas. As próximas simulações já usam esses valores.");
    } catch {
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await reset({ data: { code } });
      if (!res.ok) {
        setError("Código de acesso inválido.");
        return;
      }
      const defaults: TaxConfigMap = {};
      for (const def of TUNABLES) defaults[def.key] = def.fallback;
      fill(defaults);
      applyTaxOverrides(defaults);
      setMeta({});
      setMessage("Valores padrão restaurados.");
    } catch {
      setError("Não foi possível restaurar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const groups = [...new Set(TUNABLES.map((t) => t.group))];

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
            Área restrita do escritório
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Configuração de alíquotas</h1>
          <p className="mt-3 max-w-2xl text-sm text-navy-foreground/80">
            Ajuste os percentuais usados nas estimativas conforme a regulamentação evoluir. Todos os
            valores são informados em porcentagem.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        <Field label="Código de acesso">
          <TextInput
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Informe o código do escritório"
            autoComplete="off"
          />
        </Field>

        {groups.map((group) => (
          <section key={group} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">{group}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {TUNABLES.filter((t) => t.group === group).map((def) => (
                <Field
                  key={def.key}
                  label={def.label}
                  hint={`Padrão: ${toPercentText(def.fallback)}%${
                    meta[def.key] ? ` · Última alteração: ${formatUpdatedAt(meta[def.key]!)}` : ""
                  }`}
                >
                  <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card">
                    <input
                      inputMode="decimal"
                      value={values[def.key] ?? ""}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [def.key]: event.target.value }))
                      }
                      className="w-full bg-card px-3 py-2.5 text-base outline-none"
                    />
                    <span className="flex items-center bg-secondary px-3 text-sm font-medium text-muted-foreground">
                      %
                    </span>
                  </div>
                </Field>
              ))}
            </div>
          </section>
        ))}

        {error ? <Notice tone="warning">{error}</Notice> : null}
        {message ? <Notice>{message}</Notice> : null}
        {unlocked ? null : (
          <Notice tone="warning">
            Informe o código de acesso do escritório para salvar alterações.
          </Notice>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={busy || code.trim().length === 0}>
            {busy ? "Salvando..." : "Salvar alíquotas"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void handleReset()}
            disabled={busy || code.trim().length === 0}
          >
            Restaurar padrão
          </Button>
        </div>

        <Link to="/meus-calculos" className="inline-block text-sm font-semibold text-navy underline">
          Voltar para Meus Cálculos
        </Link>
      </div>
    </main>
  );
}
