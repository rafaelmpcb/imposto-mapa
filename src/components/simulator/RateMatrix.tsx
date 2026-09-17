import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";

import {
  applyTaxOverrides,
  currentTaxConfig,
  TUNABLES,
  type YearId,
} from "@/lib/tax/constants";
import { getTaxConfig, saveTaxConfig } from "@/lib/tax-config.functions";
import { Button, TextInput } from "./ui";

type Applicability = "base" | "none";

interface MatrixRow {
  key: string;
  label: string;
  regimes: string;
  years: Record<YearId, Applicability>;
  note?: string;
}

const ROWS: MatrixRow[] = [
  {
    key: "PIS_CUMULATIVO",
    label: "PIS (cumulativo)",
    regimes: "Lucro Presumido",
    years: { 2026: "base", 2027: "none", 2033: "none" },
  },
  {
    key: "COFINS_CUMULATIVO",
    label: "COFINS (cumulativo)",
    regimes: "Lucro Presumido",
    years: { 2026: "base", 2027: "none", 2033: "none" },
  },
  {
    key: "PIS_NAO_CUMULATIVO",
    label: "PIS (não cumulativo)",
    regimes: "Lucro Real",
    years: { 2026: "base", 2027: "none", 2033: "none" },
  },
  {
    key: "COFINS_NAO_CUMULATIVO",
    label: "COFINS (não cumulativo)",
    regimes: "Lucro Real",
    years: { 2026: "base", 2027: "none", 2033: "none" },
  },
  {
    key: "ISS_RATE",
    label: "ISS (serviços)",
    regimes: "Presumido e Real",
    years: { 2026: "base", 2027: "base", 2033: "none" },
  },
  {
    key: "CBS_TEST_RATE",
    label: "CBS — alíquota de teste",
    regimes: "Todos",
    years: { 2026: "base", 2027: "none", 2033: "none" },
    note: "Compensável com PIS/COFINS em 2026.",
  },
  {
    key: "IBS_TEST_RATE",
    label: "IBS — alíquota de teste",
    regimes: "Todos",
    years: { 2026: "base", 2027: "base", 2033: "none" },
  },
  {
    key: "CBS_SHARE",
    label: "CBS cheia (federal)",
    regimes: "Todos",
    years: { 2026: "none", 2027: "base", 2033: "base" },
  },
  {
    key: "IBS_SHARE",
    label: "IBS cheio (estadual/municipal)",
    regimes: "Todos",
    years: { 2026: "none", 2027: "none", 2033: "base" },
  },
  {
    key: "REFERENCE_RATE",
    label: "IBS + CBS — alíquota de referência",
    regimes: "Todos",
    years: { 2026: "none", 2027: "none", 2033: "base" },
    note: "Reduzida conforme a atividade (30% ou 60%).",
  },
  {
    key: "IRPJ_RATE",
    label: "IRPJ",
    regimes: "Presumido e Real",
    years: { 2026: "base", 2027: "base", 2033: "base" },
  },
  {
    key: "CSLL_RATE",
    label: "CSLL",
    regimes: "Presumido e Real",
    years: { 2026: "base", 2027: "base", 2033: "base" },
  },
  {
    key: "CPP_RATE",
    label: "CPP sobre a folha",
    regimes: "Todos com folha",
    years: { 2026: "base", 2027: "base", 2033: "base" },
  },
];

const YEAR_COLUMNS: YearId[] = [2026, 2027, 2033];

const toText = (fraction: number) =>
  (fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 });

const fromText = (text: string) => Number(text.replace(/\s/g, "").replace(",", ".")) / 100;

const fallbackOf = (key: string) => TUNABLES.find((t) => t.key === key)?.fallback ?? 0;

export function RateMatrix({
  year,
  onRatesChange,
}: {
  year: YearId;
  onRatesChange: () => void;
}) {
  const persist = useServerFn(saveTaxConfig);
  const load = useServerFn(getTaxConfig);
  const [values, setValues] = useState<Record<string, number>>(() => currentTaxConfig());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues(currentTaxConfig());
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const commit = (key: string) => {
    const parsed = fromText(draft);
    setEditing(null);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      setStatus("Informe um percentual entre 0 e 100.");
      return;
    }
    const next = { ...values, [key]: parsed };
    setValues(next);
    applyTaxOverrides(next);
    setStatus("Alíquota aplicada nesta simulação. Salve para valer em todas as simulações.");
    onRatesChange();
  };

  const restore = async () => {
    setBusy(true);
    try {
      const stored = await load();
      const next: Record<string, number> = {};
      for (const def of TUNABLES) {
        const raw = stored[def.key];
        next[def.key] = typeof raw === "number" ? raw : def.fallback;
      }
      setValues(next);
      applyTaxOverrides(next);
      setStatus("Valores restaurados para a configuração salva do escritório.");
      onRatesChange();
    } finally {
      setBusy(false);
    }
  };

  const saveForAll = async () => {
    setBusy(true);
    setStatus("");
    try {
      const response = await persist({ data: { values } });
      setStatus(
        response.ok
          ? "Alíquotas salvas para todas as simulações."
          : "Não foi possível salvar — as alterações seguem valendo só nesta tela.",
      );
    } catch {
      setStatus("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const changed = TUNABLES.some((t) => Math.abs((values[t.key] ?? t.fallback) - fallbackOf(t.key)) > 1e-9);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold">Como a reforma muda</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Alíquotas usadas na estimativa, por regime e por ano de transição. Clique em qualquer
        percentual para ajustá-lo e ver o resultado recalculado na hora.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Tributo</th>
              <th className="py-2 pr-3 font-semibold">Regimes</th>
              {YEAR_COLUMNS.map((y) => (
                <th
                  key={y}
                  className={`py-2 pl-3 text-right font-semibold ${y === year ? "text-navy" : ""}`}
                >
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const value = values[row.key] ?? fallbackOf(row.key);
              return (
                <tr key={row.key} className="border-b border-border/70 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{row.label}</span>
                    {row.note ? (
                      <span className="block text-xs text-muted-foreground">{row.note}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{row.regimes}</td>
                  {YEAR_COLUMNS.map((y) => {
                    const active = row.years[y] === "base";
                    if (!active) {
                      return (
                        <td
                          key={y}
                          className="py-2 pl-3 text-right text-muted-foreground tabular-nums"
                        >
                          —
                        </td>
                      );
                    }
                    const cellKey = `${row.key}-${y}`;
                    if (editing === cellKey) {
                      return (
                        <td key={y} className="py-2 pl-3 text-right">
                          <TextInput
                            autoFocus
                            inputMode="decimal"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => commit(row.key)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commit(row.key);
                              if (event.key === "Escape") setEditing(null);
                            }}
                            className="w-24 text-right"
                            aria-label={`${row.label} em ${y} (%)`}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={y} className="py-2 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(cellKey);
                            setDraft(toText(value));
                          }}
                          className={`rounded px-2 py-1 tabular-nums transition-colors hover:bg-secondary ${
                            y === year ? "font-semibold text-navy" : ""
                          }`}
                          title="Clique para ajustar"
                        >
                          {toText(value)}%
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        O Simples Nacional usa as tabelas dos anexos, que não são ajustáveis por aqui. Em 2033 o ISS
        e o ICMS já estão extintos e toda a tributação do consumo é feita por IBS e CBS.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        {signedIn ? (
          <Button type="button" onClick={() => void saveForAll()} disabled={busy}>
            Salvar para todas as simulações
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => void restore()} disabled={busy}>
          Restaurar valores salvos
        </Button>
      </div>
      {changed ? (
        <p className="mt-3 text-xs font-medium text-navy">
          Há alíquotas ajustadas nesta sessão — o resultado acima já reflete os novos percentuais.
        </p>
      ) : null}
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </section>
  );
}
