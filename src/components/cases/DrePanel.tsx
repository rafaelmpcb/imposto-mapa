import { Fragment, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getDre, salvarDespesasOperacionais, type DrePayload } from "@/lib/dre.functions";
import { brl } from "@/lib/tax/calc";

const LINHAS: {
  chave: keyof Pick<
    DrePayload["linhas"][number],
    | "receitaBruta"
    | "deducoes"
    | "receitaLiquida"
    | "custo"
    | "lucroBruto"
    | "despesasOperacionais"
    | "resultadoAntesIrcs"
  >;
  rotulo: string;
  destaque?: boolean;
}[] = [
  { chave: "receitaBruta", rotulo: "Receita bruta" },
  { chave: "deducoes", rotulo: "(−) Tributos sobre a receita" },
  { chave: "receitaLiquida", rotulo: "Receita líquida", destaque: true },
  { chave: "custo", rotulo: "(−) Custo de mercadorias e serviços" },
  { chave: "lucroBruto", rotulo: "Lucro bruto", destaque: true },
  { chave: "despesasOperacionais", rotulo: "(−) Despesas operacionais" },
  { chave: "resultadoAntesIrcs", rotulo: "Resultado antes de IR/CS", destaque: true },
];

/** DRE ano a ano do Caso (Pilar 3): resultado econômico, atual x projetado. */
export function DrePanel({ caseId, reloadKey = 0 }: { caseId: string; reloadKey?: number }) {
  const carregar = useServerFn(getDre);
  const salvar = useServerFn(salvarDespesasOperacionais);

  const [dados, setDados] = useState<DrePayload | null>(null);
  const [rascunho, setRascunho] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState<"anual" | "mensal">("anual");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => carregar({ data: { caseId } }));
      setDados(res.dados);
      setRascunho(
        Object.fromEntries(
          res.dados.anos.map((a) => [a.ano, String(res.dados.despesasPorAno[a.ano] ?? "")]),
        ),
      );
    } catch {
      setError("Não foi possível montar a DRE deste Caso.");
    }
  }, [caseId, carregar]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const aplicarDespesas = async (valores: Record<number, string>) => {
    if (!dados) return;
    setBusy(true);
    setError("");
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId,
            despesas: dados.anos.map((a) => ({
              ano: a.ano,
              valor: Number(String(valores[a.ano] ?? "").replace(",", ".")) || 0,
            })),
          },
        }),
      );
      await load();
    } catch {
      setError("Não foi possível salvar as despesas operacionais.");
    } finally {
      setBusy(false);
    }
  };

  if (!dados) return null;

  const semDocumentos =
    dados.insumos.receitaBrutaAtual === 0 && dados.insumos.custoCompras === 0;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">DRE ano a ano (2026 a 2033)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Resultado econômico por competência, comparando o sistema atual com o cenário projetado
          pela curva de transição do Caso. Composição dos números já apurados — nada aqui recalcula
          crédito, débito ou preço necessário.
        </p>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {semDocumentos ? (
        <Notice tone="warning">
          Ainda não há notas apuradas neste Caso. Anexe as notas de compra e venda para que a DRE
          tenha conteúdo.
        </Notice>
      ) : null}

      <Notice>
        A receita projetada muda de base: como o IBS/CBS é cobrado por fora, ela usa o preço
        líquido de tributo, e não o preço nominal cobrado hoje do cliente. A queda aparente da
        receita bruta é efeito dessa mudança de base, não perda de faturamento.
      </Notice>

      <Notice tone="warning">
        Um aumento de IRPJ/CSLL não é, isoladamente, uma piora — pode decorrer de uma melhora do
        lucro operacional (por exemplo, queda de custo pelo crédito de IBS/CBS aumentando o lucro
        tributável).
      </Notice>

      {dados.semSimulacao ? (
        <Notice tone="warning">
          Este Caso ainda não tem um cálculo salvo do simulador, então IRPJ/CSLL e resultado
          líquido ficam em branco. Salve uma simulação no Caso para completar essas linhas.
        </Notice>
      ) : null}

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Linha</th>
              {dados.anos.map((a) => (
                <th key={a.ano} className="px-3 py-2 text-right" colSpan={2}>
                  {a.ano}
                </th>
              ))}
            </tr>
            <tr>
              <th className="px-3 py-1" />
              {dados.anos.map((a) => (
                <Fragment key={`h-${a.ano}`}>
                  <th className="px-3 py-1 text-right text-[11px] font-normal">
                    Atual
                  </th>
                  <th className="px-3 py-1 text-right text-[11px] font-normal">
                    Projetado
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((linha) => (
              <tr key={linha.chave} className="border-t border-border">
                <td className={`px-3 py-2 ${linha.destaque ? "font-semibold" : ""}`}>
                  {linha.rotulo}
                </td>
                {dados.anos.map((a) => {
                  const atual = dados.linhas.find((l) => l.ano === a.ano && l.cenario === "atual");
                  const proj = dados.linhas.find(
                    (l) => l.ano === a.ano && l.cenario === "projetado",
                  );
                  return (
                    <Fragment key={`${a.ano}-${linha.chave}`}>
                      <td
                        className="px-3 py-2 text-right tabular-nums"
                      >
                        {brl(atual?.[linha.chave] ?? 0)}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums"
                      >
                        {brl(proj?.[linha.chave] ?? 0)}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}

            <tr className="border-t border-border">
              <td className="px-3 py-2">(−) IRPJ + CSLL</td>
              {dados.anos.map((a) => {
                const atual = dados.linhas.find((l) => l.ano === a.ano && l.cenario === "atual");
                const proj = dados.linhas.find((l) => l.ano === a.ano && l.cenario === "projetado");
                return (
                  <Fragment key={`ircs-${a.ano}`}>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {atual?.ircs === null || atual?.ircs === undefined ? "—" : brl(atual.ircs)}
                      {atual?.ircsOrigem === "marco_anterior" ? (
                        <span className="block text-[10px] text-muted-foreground">
                          repetido do ano-marco anterior
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {proj?.ircs === null || proj?.ircs === undefined ? "—" : brl(proj.ircs)}
                    </td>
                  </Fragment>
                );
              })}
            </tr>

            <tr className="border-t border-border bg-secondary/40">
              <td className="px-3 py-2 font-semibold">Resultado líquido</td>
              {dados.anos.map((a) => {
                const atual = dados.linhas.find((l) => l.ano === a.ano && l.cenario === "atual");
                const proj = dados.linhas.find((l) => l.ano === a.ano && l.cenario === "projetado");
                return (
                  <Fragment key={`res-${a.ano}`}>
                    <td
                      className="px-3 py-2 text-right font-semibold tabular-nums"
                    >
                      {atual?.resultadoLiquido == null ? "—" : brl(atual.resultadoLiquido)}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-semibold tabular-nums"
                    >
                      {proj?.resultadoLiquido == null ? "—" : brl(proj.resultadoLiquido)}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Despesas operacionais por ano (informadas manualmente)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Não há documento no sistema que traga esse valor sozinho. Informe o total anual de
          despesas de cada ano.
          {dados.sugestaoDespesaAnual
            ? ` Sugestão a partir da folha informada na simulação: ${brl(dados.sugestaoDespesaAnual)} por ano.`
            : ""}
        </p>
        {dados.sugestaoDespesaCarteira ? (
          <p className="mt-1 text-xs text-muted-foreground">
            A composição de carteira enviada tem {brl(dados.sugestaoDespesaCarteira)} em
            fornecedores sem NF-e/NFS-e de compra correspondente no Caso — despesa real, mas sem
            documento fiscal para gerar crédito de IBS/CBS. Esse total não está anualizado:
            ajuste conforme o período que a planilha enviada realmente cobre antes de aplicar.
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          Valores digitados são:
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as "anual" | "mensal")}
            className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="anual">Total anual</option>
            <option value="mensal">Média mensal (o sistema multiplica por 12)</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {dados.anos.map((a) => (
            <label key={a.ano} className="text-xs text-muted-foreground">
              {a.ano}
              <input
                type="number"
                min={0}
                value={rascunho[a.ano] ?? ""}
                onChange={(e) => setRascunho((prev) => ({ ...prev, [a.ano]: e.target.value }))}
                className="mt-1 block w-28 rounded border border-input bg-background px-2 py-1 text-sm tabular-nums text-foreground"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              const fator = periodo === "mensal" ? 12 : 1;
              const convertido = Object.fromEntries(
                dados.anos.map((a) => {
                  const v = Number(String(rascunho[a.ano] ?? "").replace(",", ".")) || 0;
                  return [a.ano, String(Math.round(v * fator * 100) / 100)];
                }),
              );
              setPeriodo("anual");
              void aplicarDespesas(convertido);
            }}
          >
            {busy ? "Salvando..." : "Salvar despesas"}
          </Button>
          {dados.sugestaoDespesaAnual ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                const preenchido = Object.fromEntries(
                  dados.anos.map((a) => [a.ano, String(dados.sugestaoDespesaAnual ?? 0)]),
                );
                setRascunho(preenchido);
                void aplicarDespesas(preenchido);
              }}
            >
              Usar a folha como estimativa
            </Button>
          ) : null}
          {dados.sugestaoDespesaCarteira ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPeriodo("anual");
                setRascunho(
                  Object.fromEntries(
                    dados.anos.map((a) => [a.ano, String(dados.sugestaoDespesaCarteira ?? 0)]),
                  ),
                );
              }}
            >
              Preencher com a composição de carteira ({brl(dados.sugestaoDespesaCarteira)})
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
