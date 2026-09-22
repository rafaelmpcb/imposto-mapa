import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  getConcentracao,
  LIMITE_CONCENTRACAO_CRITICA,
  type ConcentracaoDataset,
  type ConcentracaoLinha,
  type ConcentracaoPayload,
} from "@/lib/concentracao.functions";
import { FONTE_TABELA } from "@/lib/nfe/credito";
import { FONTE_TABELA_NBS } from "@/lib/nfse/credito";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

type Visao = "compras" | "vendas" | "tomado" | "prestado";

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const VISAO_META: Record<Visao, { label: string; contraparte: string; valor: string; codigo: string }> = {
  compras: { label: "Mercadorias — compras", contraparte: "fornecedor", valor: "crédito", codigo: "NCM" },
  vendas: { label: "Mercadorias — vendas", contraparte: "cliente", valor: "débito", codigo: "NCM" },
  tomado: { label: "Serviços tomados", contraparte: "prestador", valor: "crédito", codigo: "NBS" },
  prestado: { label: "Serviços prestados", contraparte: "tomador", valor: "débito", codigo: "NBS" },
};

type Grupo = {
  chave: string;
  rotulo: string;
  detalhe: string | null;
  valor: number;
  pendentes: number;
  distintos: number;
  maiorFatia: number;
};

function agrupar(linhas: ConcentracaoLinha[], por: "codigo" | "contraparte"): Grupo[] {
  const map = new Map<
    string,
    { rotulo: string; detalhe: string | null; valor: number; pendentes: number; outros: Map<string, number> }
  >();
  for (const l of linhas) {
    const chave =
      por === "codigo" ? l.codigo : (l.cnpj ?? l.nome ?? "—");
    const rotulo = por === "codigo" ? l.codigo : (l.nome ?? l.cnpj ?? "—");
    const detalhe = por === "codigo" ? null : l.cnpj ? formatCnpjMask(l.cnpj) : null;
    const outraChave = por === "codigo" ? (l.cnpj ?? l.nome ?? "—") : l.codigo;
    const atual = map.get(chave) ?? {
      rotulo,
      detalhe,
      valor: 0,
      pendentes: 0,
      outros: new Map<string, number>(),
    };
    atual.valor += l.valorApurado;
    atual.pendentes += l.pendentes;
    atual.outros.set(outraChave, (atual.outros.get(outraChave) ?? 0) + l.valorApurado);
    map.set(chave, atual);
  }
  return [...map.entries()]
    .map(([chave, g]) => {
      const maior = Math.max(0, ...[...g.outros.values()]);
      return {
        chave,
        rotulo: g.rotulo,
        detalhe: g.detalhe,
        valor: g.valor,
        pendentes: g.pendentes,
        distintos: g.outros.size,
        maiorFatia: g.valor > 0 ? (maior / g.valor) * 100 : 0,
      };
    })
    .sort((a, b) => b.valor - a.valor);
}

/** Concentração de crédito/débito de IBS/CBS por contraparte e por NCM/NBS. */
export function ConcentracaoPanel({ caseId, reloadKey = 0 }: { caseId: string; reloadKey?: number }) {
  const fetchDados = useServerFn(getConcentracao);

  const [dados, setDados] = useState<ConcentracaoPayload | null>(null);
  const [visao, setVisao] = useState<Visao>("compras");
  const [drillCodigo, setDrillCodigo] = useState<string | null>(null);
  const [drillContraparte, setDrillContraparte] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await withAuthRetry(() => fetchDados({ data: { caseId } }));
      setDados(res.dados);
    } catch {
      setError("Não foi possível carregar a concentração por contraparte.");
    }
  }, [caseId, fetchDados]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const atual: ConcentracaoDataset | null = useMemo(() => {
    if (!dados) return null;
    if (visao === "compras") return dados.compras;
    if (visao === "vendas") return dados.vendas;
    if (visao === "tomado") return dados.servicosTomados;
    return dados.servicosPrestados;
  }, [dados, visao]);

  const porCodigo = useMemo(() => (atual ? agrupar(atual.linhas, "codigo") : []), [atual]);
  const porContraparte = useMemo(
    () => (atual ? agrupar(atual.linhas, "contraparte") : []),
    [atual],
  );

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    setDrillCodigo(null);
    setDrillContraparte(null);
  };

  if (!dados) return null;

  const temDado =
    dados.compras.linhas.length > 0 ||
    dados.vendas.linhas.length > 0 ||
    dados.servicosTomados.linhas.length > 0 ||
    dados.servicosPrestados.linhas.length > 0;
  if (!temDado) return null;

  const meta = VISAO_META[visao];
  const total = atual?.total ?? 0;
  const pendentesTotal = (atual?.linhas ?? []).reduce((acc, l) => acc + l.pendentes, 0);

  const detalheCodigo = drillCodigo
    ? (atual?.linhas ?? [])
        .filter((l) => l.codigo === drillCodigo)
        .sort((a, b) => b.valorApurado - a.valorApurado)
    : [];
  const detalheContraparte = drillContraparte
    ? (atual?.linhas ?? [])
        .filter((l) => (l.cnpj ?? l.nome ?? "—") === drillContraparte)
        .sort((a, b) => b.valorApurado - a.valorApurado)
    : [];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Fornecedores e clientes críticos</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Concentração do crédito e do débito de IBS/CBS já apurados item a item, por contraparte e
          por código. Não altera nem recalcula a apuração líquida.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(VISAO_META) as Visao[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => trocarVisao(v)}
            className={`rounded border px-3 py-1 text-xs font-semibold ${
              visao === v ? "border-navy bg-navy/10 text-navy" : "border-input text-foreground hover:bg-secondary"
            }`}
          >
            {VISAO_META[v].label}
          </button>
        ))}
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {visao === "vendas" && atual && atual.notasVendaSemItens > 0 ? (
        <Notice tone="warning">
          {atual.notasVendaSemItens} nota(s) de venda de mercadoria, somando{" "}
          {brl(atual.valorNotasVendaSemItens)}, ainda não têm itens processados. Para essas notas o
          débito é estimado só no cabeçalho (alíquota de transição sobre o valor total) e, por isso,
          elas ficam fora desta concentração por NCM.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{meta.valor === "crédito" ? "Crédito" : "Débito"} apurado</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{brl(total)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Contrapartes</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{porContraparte.length}</p>
          <p className="text-xs text-muted-foreground">{porCodigo.length} códigos {meta.codigo}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Itens pendentes de revisão</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{pendentesTotal}</p>
          <p className="text-xs text-muted-foreground">fora das somas acima</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 10 contrapartes ({meta.contraparte})
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {porContraparte.slice(0, 10).map((c) => (
              <li key={c.chave}>
                <button
                  type="button"
                  onClick={() => {
                    setDrillContraparte(drillContraparte === c.chave ? null : c.chave);
                    setDrillCodigo(null);
                  }}
                  className="flex w-full items-start justify-between gap-2 rounded px-1 py-1 text-left hover:bg-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{c.rotulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.detalhe ? `${c.detalhe} · ` : ""}
                      {c.distintos} {meta.codigo}
                      {c.pendentes > 0 ? ` · ${c.pendentes} pendente(s)` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block">{brl(c.valor)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {pct1(total > 0 ? (c.valor / total) * 100 : 0)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top 10 códigos {meta.codigo}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {porCodigo.slice(0, 10).map((c) => (
              <li key={c.chave}>
                <button
                  type="button"
                  onClick={() => {
                    setDrillCodigo(drillCodigo === c.chave ? null : c.chave);
                    setDrillContraparte(null);
                  }}
                  className="flex w-full items-start justify-between gap-2 rounded px-1 py-1 text-left hover:bg-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{c.rotulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.distintos} {meta.contraparte}(es)
                      {c.pendentes > 0 ? ` · ${c.pendentes} pendente(s)` : ""}
                    </span>
                    {c.distintos > 1 && c.maiorFatia > LIMITE_CONCENTRACAO_CRITICA ? (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Risco de dependência: um único {meta.contraparte} responde por{" "}
                        {pct1(c.maiorFatia)} do {meta.valor} deste código
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block">{brl(c.valor)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {pct1(total > 0 ? (c.valor / total) * 100 : 0)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {drillCodigo ? (
        <div className="rounded-lg border border-navy/30 bg-navy/5 p-3">
          <p className="text-sm font-semibold text-foreground">
            {meta.codigo} {drillCodigo} — contrapartes que contribuem
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {detalheCodigo.map((l, i) => {
              const totalCodigo = detalheCodigo.reduce((a, x) => a + x.valorApurado, 0);
              return (
                <li key={`${l.cnpj ?? l.nome ?? i}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.nome ?? "—"}
                    {l.cnpj ? ` · ${formatCnpjMask(l.cnpj)}` : ""}
                    {l.pendentes > 0 ? ` · ${l.pendentes} pendente(s)` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {brl(l.valorApurado)} ·{" "}
                    {pct1(totalCodigo > 0 ? (l.valorApurado / totalCodigo) * 100 : 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {drillContraparte ? (
        <div className="rounded-lg border border-navy/30 bg-navy/5 p-3">
          <p className="text-sm font-semibold text-foreground">
            {detalheContraparte[0]?.nome ?? drillContraparte} — códigos {meta.codigo} cobertos
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {detalheContraparte.map((l, i) => {
              const totalCp = detalheContraparte.reduce((a, x) => a + x.valorApurado, 0);
              return (
                <li key={`${l.codigo}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.codigo}
                    {l.pendentes > 0 ? ` · ${l.pendentes} pendente(s)` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {brl(l.valorApurado)} · {pct1(totalCp > 0 ? (l.valorApurado / totalCp) * 100 : 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {pendentesTotal > 0 ? (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Onde estão as pendências (atalho de priorização)
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 text-sm">
            <ul className="space-y-1">
              {porContraparte
                .filter((c) => c.pendentes > 0)
                .slice(0, 5)
                .map((c) => (
                  <li key={`p-${c.chave}`} className="flex justify-between gap-2">
                    <span className="truncate">{c.rotulo}</span>
                    <span className="tabular-nums">{c.pendentes} item(ns)</span>
                  </li>
                ))}
            </ul>
            <ul className="space-y-1">
              {porCodigo
                .filter((c) => c.pendentes > 0)
                .slice(0, 5)
                .map((c) => (
                  <li key={`pc-${c.chave}`} className="flex justify-between gap-2">
                    <span className="truncate">
                      {meta.codigo} {c.rotulo}
                    </span>
                    <span className="tabular-nums">{c.pendentes} item(ns)</span>
                  </li>
                ))}
            </ul>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A decisão item a item continua nos painéis de crédito e débito — aqui só o agregado.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {visao === "compras" || visao === "vendas" ? FONTE_TABELA : FONTE_TABELA_NBS}
      </p>
    </div>
  );
}
