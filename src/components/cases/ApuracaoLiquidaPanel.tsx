import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { getApuracaoLiquida } from "@/lib/apuracao.functions";
import type { ApuracaoLiquida, BlocoApuracao } from "@/lib/apuracao/liquido";
import { withAuthRetry } from "@/lib/auth-retry";
import { brl } from "@/lib/tax/calc";

interface Props {
  caseId: string;
  /** Muda para forçar recarga depois de novos documentos ou revisões. */
  reloadKey?: number;
}

function Linha({ label, bloco }: { label: string; bloco: BlocoApuracao }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">
        {label}
        {bloco.estimado && bloco.itens > 0 ? (
          <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
            estimado
          </span>
        ) : null}
        <span className="ml-1 text-xs">
          ({bloco.itens} {bloco.itens === 1 ? "item" : "itens"}
          {bloco.pendentes > 0 ? ` · ${bloco.pendentes} em revisão, fora da soma` : ""})
        </span>
      </span>
      <span className="font-semibold tabular-nums text-foreground">{brl(bloco.total)}</span>
    </div>
  );
}

/** Valor líquido de IBS/CBS a recolher no cenário pós-reforma, por Caso. */
export function ApuracaoLiquidaPanel({ caseId, reloadKey }: Props) {
  const fetchApuracao = useServerFn(getApuracaoLiquida);
  const [apuracao, setApuracao] = useState<ApuracaoLiquida | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => fetchApuracao({ data: { caseId } }));
      setApuracao(res.apuracao);
      setError("");
    } catch {
      setError("Não foi possível calcular o valor líquido a recolher.");
    }
  }, [caseId, fetchApuracao]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (error) return <Notice tone="warning">{error}</Notice>;
  if (!apuracao || apuracao.vazio) return null;

  const credor = apuracao.liquido < 0;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Valor líquido a recolher — cenário pós-reforma {apuracao.ano}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Débitos das vendas menos créditos das compras, apurados nos documentos deste Caso.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Débitos (vendas)
          </p>
          <Linha label="Serviços prestados" bloco={apuracao.debitoServicos} />
          <Linha label="Mercadorias vendidas" bloco={apuracao.debitoMercadorias} />
          <div className="flex justify-between pt-2 text-sm font-semibold text-foreground">
            <span>Total de débitos</span>
            <span className="tabular-nums">{brl(apuracao.debitoTotal)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Créditos (compras)
          </p>
          <Linha label="Serviços tomados" bloco={apuracao.creditoServicos} />
          <Linha label="Mercadorias adquiridas" bloco={apuracao.creditoMercadorias} />
          <div className="flex justify-between pt-2 text-sm font-semibold text-foreground">
            <span>Total de créditos</span>
            <span className="tabular-nums">{brl(apuracao.creditoTotal)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {credor ? "Saldo credor a transportar" : "Líquido a recolher"}
        </p>
        <p className="font-presentation-display text-3xl font-semibold tabular-nums text-foreground">
          {brl(Math.abs(apuracao.liquido))}
        </p>
      </div>

      {apuracao.pendentesTotal > 0 ? (
        <Notice tone="warning">
          {apuracao.pendentesTotal}{" "}
          {apuracao.pendentesTotal === 1 ? "item está" : "itens estão"} na fila de revisão e{" "}
          {apuracao.pendentesTotal === 1 ? "ficou" : "ficaram"} de fora deste cálculo. Resolva a
          fila para fechar o valor.
        </Notice>
      ) : null}

      {apuracao.temEstimativa ? (
        <p className="text-xs text-muted-foreground">
          O débito das mercadorias vendidas é estimado pela alíquota nominal do ano sobre o valor
          total de cada nota, porque os XMLs de venda são lidos apenas no cabeçalho.
        </p>
      ) : null}
    </div>
  );
}
