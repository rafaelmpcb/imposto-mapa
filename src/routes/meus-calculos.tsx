import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import { listSimulations, type SavedSimulation } from "@/lib/simulations.functions";
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
  const [code, setCode] = useState("");
  const [items, setItems] = useState<SavedSimulation[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      }),
    );
    void navigate({ to: "/" });
  };

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
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {items.length} cálculo{items.length === 1 ? "" : "s"} salvo
                {items.length === 1 ? "" : "s"}
              </p>
              <Button variant="ghost" onClick={() => void load(code)}>
                Atualizar
              </Button>
            </div>

            {items.length === 0 ? (
              <Notice>Nenhum cálculo salvo até agora.</Notice>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => {
                  const diff = Number(item.reform_total) - Number(item.current_total);
                  const worse = diff > 0.004;
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-border bg-card p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">
                            {item.client_name || "Sem identificação"}
                          </p>
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
                        </div>
                        <Button variant="ghost" onClick={() => reopen(item)}>
                          Reabrir
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link to="/" className="inline-block text-sm font-semibold text-navy underline">
              Voltar ao simulador
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
