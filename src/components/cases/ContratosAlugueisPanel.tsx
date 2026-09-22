import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";

import { Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { brl } from "@/lib/tax/calc";
import {
  excluirContratoAluguel,
  listContratosAluguel,
  type ContratoAluguelRow,
} from "@/lib/aluguel.functions";
import { CRITERIO_LABEL, REGIME_LOCADOR_LABEL } from "@/lib/aluguel/calculo";

const pct = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Contratos de locação do Caso — alimenta a Seção 9 do Parecer Padrão. */
export function ContratosAlugueisPanel({
  caseId,
  reloadKey = 0,
}: {
  caseId: string;
  reloadKey?: number;
}) {
  const carregar = useServerFn(listContratosAluguel);
  const excluir = useServerFn(excluirContratoAluguel);
  const [itens, setItens] = useState<ContratoAluguelRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await withAuthRetry(() => carregar({ data: { caseId } }));
      setItens(res.items);
    } catch {
      setError("Não foi possível carregar os contratos de locação deste Caso.");
    }
  }, [carregar, caseId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const totais = useMemo(() => {
    let mensalAtual = 0;
    let mensalSugerido = 0;
    let liquidoAtual = 0;
    let liquidoSemRepac = 0;
    for (const item of itens) {
      const r = item.resultado;
      if (!r) continue;
      const atual = r.cenarios[0];
      const sem = r.cenarios[1];
      mensalAtual += atual?.valorContrato ?? 0;
      mensalSugerido += r.repactuacao.aluguelSugerido;
      liquidoAtual += atual?.liquidoLocador ?? 0;
      liquidoSemRepac += sem?.liquidoLocador ?? 0;
    }
    return {
      mensalAtual,
      mensalSugerido,
      liquidoAtual,
      liquidoSemRepac,
      variacaoAluguelPct: mensalAtual > 0 ? ((mensalSugerido - mensalAtual) / mensalAtual) * 100 : 0,
      variacaoLiquidoPct:
        liquidoAtual > 0 ? ((liquidoSemRepac - liquidoAtual) / liquidoAtual) * 100 : 0,
    };
  }, [itens]);

  const remover = async (id: string) => {
    try {
      await withAuthRetry(() => excluir({ data: { id } }));
      await load();
    } catch {
      setError("Não foi possível excluir o contrato.");
    }
  };

  return (
    <section
      id="contratos-alugueis"
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      aria-labelledby="contratos-alugueis-title"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p id="contratos-alugueis-title" className="text-sm font-semibold text-foreground">
            Contratos e aluguéis
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Contratos de locação simulados para este Caso: efeito do IBS/CBS sobre o líquido do
            locador, o custo do locatário e o valor de repactuação. Os totais entram no Parecer
            Padrão.
          </p>
        </div>
        <Link
          to="/aluguel"
          className="text-sm font-semibold text-navy underline"
          target="_blank"
          rel="noreferrer"
        >
          Abrir simulador de aluguel
        </Link>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {itens.length === 0 && !error ? (
        <Notice>
          Nenhum contrato de locação vinculado. Use o simulador de aluguel e escolha este Caso ao
          salvar.
        </Notice>
      ) : null}

      {itens.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-md border border-border bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Aluguel mensal contratado</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{brl(totais.mensalAtual)}</p>
            </article>
            <article className="rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs text-muted-foreground">Líquido sem repactuar</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{brl(totais.liquidoSemRepac)}</p>
              <p className="text-xs text-muted-foreground">
                {pct(totais.variacaoLiquidoPct)} frente a hoje
              </p>
            </article>
            <article className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-muted-foreground">Aluguel sugerido na repactuação</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{brl(totais.mensalSugerido)}</p>
              <p className="text-xs text-muted-foreground">
                {pct(totais.variacaoAluguelPct)} sobre o contratado
              </p>
            </article>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Contrato</th>
                  <th className="py-2">Papel / regime</th>
                  <th className="py-2 text-right">Ano</th>
                  <th className="py-2 text-right">Aluguel hoje</th>
                  <th className="py-2 text-right">Sugerido</th>
                  <th className="py-2 text-right">Variação</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-t border-border align-top tabular-nums">
                    <td className="py-2">
                      <p className="font-medium text-foreground">{item.titulo}</p>
                      {item.contraparte ? (
                        <p className="text-xs text-muted-foreground">{item.contraparte}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {CRITERIO_LABEL[item.criterio]}
                      </p>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {item.papel === "locador" ? "Cliente locador" : "Cliente locatário"}
                      <br />
                      {REGIME_LOCADOR_LABEL[item.regime_locador]}
                    </td>
                    <td className="py-2 text-right">{item.ano_referencia}</td>
                    <td className="py-2 text-right">{brl(item.aluguel_mensal)}</td>
                    <td className="py-2 text-right">
                      {brl(item.resultado?.repactuacao.aluguelSugerido ?? 0)}
                    </td>
                    <td className="py-2 text-right">
                      {pct(item.resultado?.repactuacao.variacaoAluguelPct ?? 0)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void remover(item.id)}
                        className="text-xs font-semibold text-rose-700 underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
