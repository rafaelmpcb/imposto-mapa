import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { brl } from "@/lib/tax/calc";
import {
  AVISO_DECISAO_COMERCIAL,
  FONTE_ALIQUOTA_PLENA,
  LEITURA_PERFIL,
  NOTA_RAMPA,
  type PerfilCliente,
} from "@/lib/preco/necessario";
import {
  calcularPrecoNecessario,
  getPrecoNecessario,
  getPrecoParametros,
  salvarPrecoParametros,
  type PrecoAnoRow,
  type PrecoClienteRow,
  type PrecoItemRow,
} from "@/lib/preco-venda.functions";

interface Props {
  caseId: string;
  reloadKey?: number;
}

const pct = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const PERFIL_LABEL: Record<PerfilCliente, string> = {
  regular: "Regime regular",
  simples: "Simples Nacional",
  nao_classificado: "Sem classificação",
};

const PERFIL_TONE: Record<PerfilCliente, string> = {
  regular: "bg-emerald-100 text-emerald-900",
  simples: "bg-amber-100 text-amber-900",
  nao_classificado: "bg-secondary text-foreground",
};

function Badge({ perfil }: { perfil: PerfilCliente }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PERFIL_TONE[perfil]}`}
      title={LEITURA_PERFIL[perfil]}
    >
      {PERFIL_LABEL[perfil]}
    </span>
  );
}

/** Preço de venda que preserva o ganho líquido atual depois do IBS/CBS. */
export function PrecoNecessarioPanel({ caseId, reloadKey }: Props) {
  const fetchParams = useServerFn(getPrecoParametros);
  const saveParams = useServerFn(salvarPrecoParametros);
  const calcular = useServerFn(calcularPrecoNecessario);
  const fetchResultado = useServerFn(getPrecoNecessario);

  const [aliquota, setAliquota] = useState("26,5");
  const [cronograma, setCronograma] = useState<{ ano: number; fracao: number }[]>([]);
  const [itens, setItens] = useState<PrecoItemRow[]>([]);
  const [clientes, setClientes] = useState<PrecoClienteRow[]>([]);
  const [anos, setAnos] = useState<PrecoAnoRow[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [params, resultado] = await Promise.all([
        withAuthRetry(() => fetchParams({ data: { caseId } })),
        withAuthRetry(() => fetchResultado({ data: { caseId } })),
      ]);
      setAliquota(
        params.aliquotaPlenaPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      );
      setCronograma(params.cronograma);
      setItens(resultado.itens);
      setClientes(resultado.clientes as PrecoClienteRow[]);
      setAnos(resultado.anos as PrecoAnoRow[]);
      setError("");
    } catch {
      setError("Não foi possível carregar o preço necessário das vendas.");
    }
  }, [caseId, fetchParams, fetchResultado]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const recalcular = async () => {
    setBusy(true);
    try {
      const valor = Number(aliquota.replace(/\./g, "").replace(",", "."));
      await withAuthRetry(() =>
        saveParams({
          data: {
            caseId,
            aliquotaPlenaPct: Number.isFinite(valor) ? valor : 26.5,
            cronograma,
          },
        }),
      );
      await withAuthRetry(() => calcular({ data: { caseId } }));
      await load();
    } catch {
      setError("Não foi possível recalcular o preço necessário.");
    } finally {
      setBusy(false);
    }
  };

  const itensDoCliente = (cnpj: string | null, nome: string | null) =>
    itens.filter((i) => (cnpj ? i.cnpjCliente === cnpj : i.cliente === nome));

  const maiorPreco = Math.max(1, ...anos.map((a) => a.precoNecessario));

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Vendas — preço necessário</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Preço de venda que preserva exatamente o valor líquido de hoje depois do IBS/CBS —
          piso técnico de preservação de margem, item a item.
        </p>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      <Notice tone="warning">{AVISO_DECISAO_COMERCIAL}</Notice>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
        <label className="text-xs text-muted-foreground">
          Alíquota plena de IBS/CBS (%)
          <input
            className="mt-1 block w-28 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
            value={aliquota}
            onChange={(e) => setAliquota(e.target.value)}
          />
        </label>
        {cronograma.map((c, idx) => (
          <label key={c.ano} className="text-xs text-muted-foreground">
            {c.ano} (% da plena)
            <input
              className="mt-1 block w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              value={Math.round(c.fracao * 100)}
              onChange={(e) => {
                const v = Number(e.target.value.replace(",", ".")) / 100;
                setCronograma((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, fracao: Number.isFinite(v) ? v : 0 } : p)),
                );
              }}
            />
          </label>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void recalcular()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Calculando…" : "Calcular preço necessário"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{NOTA_RAMPA}</p>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há itens de venda classificados neste Caso. Envie os XMLs de venda e as NFS-e
          prestadas e depois calcule o preço necessário.
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resumo por cliente
            </p>
            <div className="mt-2 divide-y divide-border/60">
              {clientes.map((c) => {
                const chave = c.cnpj ?? `sem-cnpj:${c.nome ?? "—"}`;
                const abertoAqui = aberto === chave;
                return (
                  <div key={chave} className="py-2">
                    <button
                      type="button"
                      onClick={() => setAberto(abertoAqui ? null : chave)}
                      className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
                    >
                      <span className="text-sm text-foreground">
                        {c.nome || c.cnpj || "Cliente não identificado"}{" "}
                        <Badge perfil={c.perfil} />
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({c.itens} {c.itens === 1 ? "item" : "itens"})
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-foreground">
                        {brl(c.valorAtual)} → <strong>{brl(c.precoNecessario)}</strong>{" "}
                        <span
                          className={
                            c.variacaoMediaPct > 0 ? "text-amber-700" : "text-emerald-700"
                          }
                        >
                          {pct(c.variacaoMediaPct)}
                        </span>
                      </span>
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">{LEITURA_PERFIL[c.perfil]}</p>
                    {abertoAqui ? (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[720px] text-xs">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-2">Item</th>
                              <th className="py-1 pr-2">NCM/NBS</th>
                              <th className="py-1 pr-2 text-right">Preço atual</th>
                              <th className="py-1 pr-2 text-right">Tributos atuais</th>
                              <th className="py-1 pr-2 text-right">Valor desonerado</th>
                              <th className="py-1 pr-2 text-right">Preço necessário</th>
                              <th className="py-1 text-right">Variação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itensDoCliente(c.cnpj, c.nome).map((i) => (
                              <tr key={i.id} className="border-t border-border/60">
                                <td className="py-1 pr-2">{i.descricao ?? "—"}</td>
                                <td className="py-1 pr-2">{i.codigo ?? "—"}</td>
                                <td className="py-1 pr-2 text-right tabular-nums">
                                  {brl(i.valorItem)}
                                </td>
                                <td className="py-1 pr-2 text-right tabular-nums">
                                  {brl(i.tributosAtuais)}
                                </td>
                                <td className="py-1 pr-2 text-right tabular-nums">
                                  {brl(i.valorDesonerado)}
                                </td>
                                <td className="py-1 pr-2 text-right font-semibold tabular-nums">
                                  {brl(i.precoNecessario)}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                  {pct(i.variacaoPrecoPct)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {anos.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Evolução do preço necessário por ano
              </p>
              <div className="mt-2 space-y-1">
                {anos.map((a) => (
                  <div key={a.ano} className="flex items-center gap-2 text-xs">
                    <span className="w-10 tabular-nums text-muted-foreground">{a.ano}</span>
                    <div className="h-3 flex-1 rounded bg-secondary">
                      <div
                        className="h-3 rounded bg-primary"
                        style={{ width: `${(a.precoNecessario / maiorPreco) * 100}%` }}
                      />
                    </div>
                    <span className="w-28 text-right tabular-nums text-foreground">
                      {brl(a.precoNecessario)}
                    </span>
                    <span className="w-16 text-right tabular-nums text-muted-foreground">
                      {pct(a.variacaoPct)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="text-[11px] text-muted-foreground">{FONTE_ALIQUOTA_PLENA}</p>
    </div>
  );
}
