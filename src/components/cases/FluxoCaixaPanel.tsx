import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  getFluxoCaixa,
  salvarParametrosFluxo,
  type FluxoPayload,
} from "@/lib/fluxo-caixa.functions";
import { janelasDePressao } from "@/lib/fluxo/projecao";
import { brl } from "@/lib/tax/calc";

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Projeção mensal de caixa do Caso (Pilar 4): disponibilidade financeira. */
export function FluxoCaixaPanel({ caseId, reloadKey = 0 }: { caseId: string; reloadKey?: number }) {
  const carregar = useServerFn(getFluxoCaixa);
  const salvar = useServerFn(salvarParametrosFluxo);

  const [dados, setDados] = useState<FluxoPayload | null>(null);
  const [recebimento, setRecebimento] = useState("30");
  const [pagamento, setPagamento] = useState("30");
  const [compensacao, setCompensacao] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => carregar({ data: { caseId } }));
      setDados(res.dados);
      setRecebimento(String(res.dados.parametros.prazoRecebimentoDias));
      setPagamento(String(res.dados.parametros.prazoPagamentoDias));
      setCompensacao(String(res.dados.parametros.periodicidadeCreditoDias));
    } catch {
      setError("Não foi possível projetar o fluxo de caixa deste Caso.");
    }
  }, [caseId, carregar]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const aplicar = async () => {
    setBusy(true);
    setError("");
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId,
            parametros: {
              prazoRecebimentoDias: Number(recebimento) || 0,
              prazoPagamentoDias: Number(pagamento) || 0,
              periodicidadeCreditoDias: Number(compensacao) || 0,
            },
          },
        }),
      );
      await load();
    } catch {
      setError("Não foi possível salvar os prazos.");
    } finally {
      setBusy(false);
    }
  };

  const serie = useMemo(
    () =>
      (dados?.meses ?? []).map((m) => ({
        rotulo: `${MES_CURTO[m.mes - 1]}/${String(m.ano).slice(2)}`,
        variacao: m.variacaoCaixa,
        saldoCredor: m.saldoCredorAcumulado,
      })),
    [dados],
  );

  const janelas = useMemo(() => janelasDePressao(dados?.meses ?? []), [dados]);

  if (!dados) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Fluxo de caixa projetado, mês a mês</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Resultado econômico e disponibilidade financeira não são a mesma coisa: aqui o que conta é
          quando o dinheiro entra e sai, considerando os prazos abaixo. Os totais anuais são
          distribuídos igualmente pelos 12 meses — sem sazonalidade.
        </p>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {dados.vazio ? (
        <Notice tone="warning">
          Ainda não há valores projetados. Informe as despesas na DRE e anexe as notas do Caso para
          que a projeção tenha conteúdo.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Prazo médio de recebimento (dias)
          <input
            type="number"
            min={0}
            value={recebimento}
            onChange={(e) => setRecebimento(e.target.value)}
            className="mt-1 block w-full rounded border border-input bg-background px-2 py-1 text-sm tabular-nums text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Prazo médio de pagamento a fornecedores (dias)
          <input
            type="number"
            min={0}
            value={pagamento}
            onChange={(e) => setPagamento(e.target.value)}
            className="mt-1 block w-full rounded border border-input bg-background px-2 py-1 text-sm tabular-nums text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Periodicidade de compensação do crédito (dias)
          <input
            type="number"
            min={0}
            value={compensacao}
            onChange={(e) => setCompensacao(e.target.value)}
            className="mt-1 block w-full rounded border border-input bg-background px-2 py-1 text-sm tabular-nums text-foreground"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Os três prazos são estimativas editáveis. A periodicidade de compensação do crédito segue
        sujeita à regulamentação do recolhimento na origem, ainda não definitiva.
      </p>
      <Button disabled={busy} onClick={() => void aplicar()}>
        {busy ? "Recalculando..." : "Aplicar prazos"}
      </Button>

      {janelas.length > 0 ? (
        <Notice tone="warning">
          Atenção: pressão de capital de giro projetada em{" "}
          {janelas
            .map(
              (j) =>
                `${MES_CURTO[j.inicio.mes - 1]}/${j.inicio.ano} a ${MES_CURTO[j.fim.mes - 1]}/${j.fim.ano}`,
            )
            .join(", ")}
          . Sinalizador, não impedimento.
        </Notice>
      ) : null}

      {serie.length > 0 ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => brl(Number(v))} />
              <Legend />
              <Bar dataKey="variacao" name="Variação de caixa" fill="hsl(var(--navy))" />
              <Line
                type="monotone"
                dataKey="saldoCredor"
                name="Saldo credor acumulado"
                stroke="hsl(var(--primary))"
                dot={false}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="max-h-80 overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Mês</th>
              <th className="px-3 py-2 text-right">Entradas</th>
              <th className="px-3 py-2 text-right">Fornecedores</th>
              <th className="px-3 py-2 text-right">Despesas</th>
              <th className="px-3 py-2 text-right">Débito retido</th>
              <th className="px-3 py-2 text-right">Crédito disponível</th>
              <th className="px-3 py-2 text-right">Recolhido</th>
              <th className="px-3 py-2 text-right">Saldo credor</th>
              <th className="px-3 py-2 text-right">Variação</th>
            </tr>
          </thead>
          <tbody>
            {dados.meses.map((m) => (
              <tr key={`${m.ano}-${m.mes}`} className="border-t border-border">
                <td className="px-3 py-2">
                  {MES_CURTO[m.mes - 1]}/{m.ano}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(m.entradasClientes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(m.saidasFornecedores)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(m.saidasDespesas)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {brl(m.debitoIbsCbsRetido)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {brl(m.creditoIbsCbsDisponivel)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {brl(m.debitoLiquidoRecolhido)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(m.saldoCredorAcumulado)}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold tabular-nums ${
                    m.variacaoCaixa < 0 ? "text-destructive" : ""
                  }`}
                >
                  {brl(m.variacaoCaixa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        O débito retido aparece como linha informativa: ele é liquidado na origem e nunca chega a
        entrar na conta do cliente, por isso não é somado duas vezes nas entradas.
      </p>
      <p className="text-xs text-muted-foreground">
        Projeção simplificada de fluxo de caixa — não substitui um orçamento de capital de giro
        elaborado a partir dos prazos contratuais reais do cliente.
      </p>
    </div>
  );
}
