import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  getPainelCarga,
  LIMIAR_CARGA_PADRAO,
  type PainelCargaPayload,
} from "@/lib/carga.functions";
import { brl } from "@/lib/tax/calc";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const CATEGORIA_LABEL = {
  duplicado: "Duplicado",
  nao_e_nota: "Não é nota",
  ignorado: "Ignorado",
} as const;

/**
 * Conferência da carga documental antes de olhar os resultados: o que entrou,
 * o que ficou de fora e por quê. Não bloqueia nenhum outro painel.
 */
export function PainelCargaPanel({ caseId, reloadKey = 0 }: { caseId: string; reloadKey?: number }) {
  const fetchCarga = useServerFn(getPainelCarga);

  const [dados, setDados] = useState<PainelCargaPayload | null>(null);
  const [limiar, setLimiar] = useState(LIMIAR_CARGA_PADRAO);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => fetchCarga({ data: { caseId } }));
      setDados(res.dados);
    } catch {
      setError("Não foi possível carregar o painel da carga documental.");
    }
  }, [caseId, fetchCarga]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const totais = useMemo(() => {
    const linhas = dados?.linhas ?? [];
    const soma = (f: (l: (typeof linhas)[number]) => number) =>
      linhas.reduce((acc, l) => acc + f(l), 0);
    const totalRecebido = soma((l) => l.totalRecebido);
    const foraQtd = soma((l) => l.naoSaoNotas + l.ignorados + l.duplicados);
    return {
      totalRecebido,
      validos: soma((l) => l.validos),
      duplicados: soma((l) => l.duplicados),
      naoSaoNotas: soma((l) => l.naoSaoNotas),
      ignorados: soma((l) => l.ignorados),
      manuais: 0,
      valorValidos: soma((l) => l.valorValidos),
      valorFora: soma((l) => l.valorForaDoCalculo),
      foraQtd,
      foraPct: totalRecebido > 0 ? (foraQtd / totalRecebido) * 100 : 0,
    };
  }, [dados]);

  if (!dados) return null;
  if (totais.totalRecebido === 0) return null;

  const linhasVisiveis = dados.linhas.filter((l) => l.totalRecebido > 0);
  const alerta = totais.foraPct > limiar;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Painel da carga documental</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Conferência do que entrou no cálculo antes de olhar os resultados. Nenhum painel é
          bloqueado por aqui — é uma revisão recomendada, não uma trava.
        </p>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Documentos recebidos</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {totais.totalRecebido}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Entraram no cálculo</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{totais.validos}</p>
          <p className="text-xs text-muted-foreground">{brl(totais.valorValidos)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Ficaram de fora</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{totais.foraQtd}</p>
          <p className="text-xs text-muted-foreground">
            {pct1(totais.foraPct)} do recebido · {brl(totais.valorFora)}
          </p>
        </div>
      </div>

      {alerta ? (
        <Notice tone="warning">
          A diferença entre o esperado e o recebido está em {pct1(totais.foraPct)} — acima do limiar
          de {limiar}%. Vale investigar os documentos listados abaixo antes de apresentar números.
        </Notice>
      ) : null}

      <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Limiar de alerta (%)
        <input
          type="number"
          min={0}
          max={100}
          value={limiar}
          onChange={(e) => setLimiar(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          className="w-20 rounded border border-input px-2 py-1 text-right text-sm tabular-nums text-foreground"
        />
      </label>

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tipo de documento</th>
              <th className="px-3 py-2 text-right">Válidos</th>
              <th className="px-3 py-2 text-right">Duplicados</th>
              <th className="px-3 py-2 text-right">Não são notas</th>
              <th className="px-3 py-2 text-right">Ignorados</th>
              <th className="px-3 py-2 text-right">Manuais</th>
              <th className="px-3 py-2 text-right">Total recebido</th>
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((l) => (
              <tr key={l.tipo} className="border-t border-border">
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.validos}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.duplicados}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.naoSaoNotas}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.ignorados}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.manuais}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {l.totalRecebido}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.foraDoCalculo.length > 0 ? (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documentos que não entraram no cálculo
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {dados.foraDoCalculo.map((d, i) => (
              <li key={`${d.arquivo}-${i}`} className="flex flex-wrap justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{d.arquivo}</span>
                  <span className="block text-xs text-muted-foreground">
                    {d.label} · {CATEGORIA_LABEL[d.categoria]} · {d.motivo}
                    {d.numero ? ` · nota ${d.numero}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {d.valor > 0 ? brl(d.valor) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Lançamentos manuais ficam em zero: ainda não existe cadastro manual de nota neste sistema.
        Reenvios do mesmo documento são contados como duplicados e não somam de novo no crédito, no
        débito nem na composição de carteira.
      </p>
    </div>
  );
}
