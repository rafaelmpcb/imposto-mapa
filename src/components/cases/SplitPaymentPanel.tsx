import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowRight, Landmark, ReceiptText, RefreshCcw, WalletCards } from "lucide-react";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  getSplitPayment,
  type SplitPaymentPayload,
  type SplitPaymentPeriodo,
} from "@/lib/split-payment.functions";
import { brl } from "@/lib/tax/calc";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const periodoId = (periodo: Pick<SplitPaymentPeriodo, "ano" | "mes">) =>
  `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}`;

export function SplitPaymentPanel({
  caseId,
  reloadKey = 0,
}: {
  caseId: string;
  reloadKey?: number;
}) {
  const carregar = useServerFn(getSplitPayment);
  const [dados, setDados] = useState<SplitPaymentPayload | null>(null);
  const [selecionado, setSelecionado] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => carregar({ data: { caseId } }));
      setDados(res.dados);
      setSelecionado((atual) => {
        if (res.dados.periodos.some((periodo) => periodoId(periodo) === atual)) return atual;
        const inicial = res.dados.periodos[0];
        return inicial ? periodoId(inicial) : "";
      });
    } catch {
      setError("Não foi possível carregar a leitura do split payment deste Caso.");
    }
  }, [carregar, caseId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const periodo = useMemo(
    () => dados?.periodos.find((item) => periodoId(item) === selecionado) ?? null,
    [dados, selecionado],
  );

  const irAoFluxo = () => {
    document.getElementById("fluxo-caixa-completo")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4" aria-labelledby="split-payment-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p id="split-payment-title" className="text-sm font-semibold text-foreground">
            Split payment — como funciona neste Caso
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Leitura financeira e gerencial da retenção na origem, do crédito disponível e do efeito
            líquido. A mecânica jurídica e os prazos legais ainda dependem de regulamentação.
          </p>
        </div>

        {dados && dados.periodos.length > 0 ? (
          <label className="min-w-56 text-xs font-medium text-muted-foreground">
            Período da leitura
            <select
              value={selecionado}
              onChange={(event) => setSelecionado(event.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {dados.periodos.map((item) => (
                <option key={periodoId(item)} value={periodoId(item)}>
                  {MESES[item.mes - 1]} de {item.ano}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {!error && dados && dados.periodos.length === 0 ? (
        <Notice tone="warning">
          Gere primeiro a DRE e o fluxo de caixa deste Caso para liberar a leitura do split payment.
        </Notice>
      ) : null}

      {periodo ? (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <article className="rounded-md border border-border bg-secondary p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold text-foreground">1</span>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ReceiptText className="size-4" aria-hidden="true" />
                    <p className="text-xs font-semibold uppercase">Hoje: venda bruta</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{brl(periodo.vendasBrutas)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Hoje, este é o valor bruto mensal de vendas usado na projeção.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-md border border-border bg-secondary p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold text-foreground">2</span>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Landmark className="size-4" aria-hidden="true" />
                    <p className="text-xs font-semibold uppercase">Retenção na origem</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{brl(periodo.debitoRetido)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Neste período, este IBS/CBS da venda deixa de transitar livremente pela conta.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-md border border-border bg-secondary p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold text-foreground">3</span>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCcw className="size-4" aria-hidden="true" />
                    <p className="text-xs font-semibold uppercase">Crédito disponível</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{brl(periodo.creditoDisponivel)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    É o crédito de compras já disponível no período, após a defasagem configurada.
                  </p>
                </div>
              </div>
            </article>
          </div>

          <div className="flex justify-center text-muted-foreground" aria-hidden="true">
            <ArrowDown className="size-5" />
          </div>

          <article className="rounded-md border-2 border-navy bg-navy/5 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-navy-foreground">4</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-foreground">
                  <WalletCards className="size-5" aria-hidden="true" />
                  <p className="text-sm font-semibold">Efeito líquido</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  A retenção isolada não é o resultado final: primeiro é preciso considerar o crédito
                  disponível das compras.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">Saída efetiva pelo split no mês</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{brl(periodo.debitoLiquidoRecolhido)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Débito retido menos crédito disponível, nunca abaixo de zero.</p>
                  </div>
                  <div className="rounded-md bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">Resultado líquido projetado no ano</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                      {periodo.resultadoLiquidoAno == null ? "Indisponível" : brl(periodo.resultadoLiquidoAno)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Lucro econômico anual da DRE; não é a saída mensal do split.</p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {dados?.rateioReceitaUniforme ? (
            <p className="text-xs text-muted-foreground">
              A venda bruta mensal segue o mesmo rateio uniforme da projeção de fluxo, sem sazonalidade.
            </p>
          ) : null}
        </>
      ) : null}

      <Notice tone="warning">
        Não abrir a leitura dizendo “o split vai tirar X% do seu caixa” — mostrar apenas a retenção
        da venda, sem o crédito de compras, é uma meia-leitura.
      </Notice>

      <Button variant="ghost" onClick={irAoFluxo}>
        Ver fluxo de caixa completo <ArrowRight className="ml-2 size-4" aria-hidden="true" />
      </Button>
    </section>
  );
}