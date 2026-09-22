import { useMemo, useState } from "react";

import { Button } from "@/components/simulator/ui";
import {
  AREAS_PLANO,
  ESCOPO_LABEL,
  SECOES,
  type ParecerEdicoes,
  type ParecerSnapshot,
} from "@/lib/parecer/tipos";
import { brl } from "@/lib/tax/calc";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Linha({ children }: { children: React.ReactNode }) {
  return <p className="text-lg leading-relaxed text-foreground">{children}</p>;
}

function Vazio() {
  return (
    <p className="text-lg text-muted-foreground">
      Sem dado disponível nesta etapa — lacuna documentada no parecer.
    </p>
  );
}

export function ParecerApresentacao({
  snapshot,
  edicoes,
  versao,
  onSair,
}: {
  snapshot: ParecerSnapshot;
  edicoes: ParecerEdicoes;
  versao: number;
  onSair: () => void;
}) {
  const [i, setI] = useState(0);
  const secao = SECOES[i]!;

  const conteudo = useMemo(() => {
    switch (secao.numero) {
      case 1:
        return (
          <>
            <Linha>Cliente: {snapshot.sec1.cliente ?? "não informado"}</Linha>
            <Linha>CNPJ: {snapshot.sec1.cnpj ?? "não informado"}</Linha>
            <Linha>Regime atual: {snapshot.sec1.regimeAtual ?? "não informado"}</Linha>
            <Linha>Escopo: {ESCOPO_LABEL[snapshot.sec1.escopo]}</Linha>
            <Linha>Objetivo: {snapshot.sec1.objetivo ?? "não informado"}</Linha>
            {edicoes.sec1 ? <Linha>{edicoes.sec1}</Linha> : null}
          </>
        );
      case 2:
        return (
          <>
            {snapshot.sec2.carga.length === 0 ? <Vazio /> : null}
            {snapshot.sec2.carga.map((l) => (
              <Linha key={l.tipo}>
                {l.tipo}: {l.validos} válidos de {l.total} · {l.duplicados} duplicados
              </Linha>
            ))}
            {snapshot.sec2.pendencias.map((p) => (
              <Linha key={p.fluxo}>
                Pendente de revisão em {p.fluxo}: {p.itens} item(ns), {brl(p.valor)}
              </Linha>
            ))}
            {edicoes.sec2 ? <Linha>{edicoes.sec2}</Linha> : null}
          </>
        );
      case 3: {
        const achados = edicoes.sec3?.achados ?? snapshot.sec3.achados;
        if (achados.length === 0) return <Vazio />;
        return (
          <>
            {achados
              .filter((a) => a.titulo || a.impacto)
              .map((a, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">{a.titulo}</p>
                  {a.impacto ? <Linha>Impacto: {a.impacto}</Linha> : null}
                  {a.causa ? <Linha>Causa: {a.causa}</Linha> : null}
                  {a.decisao ? <Linha>Decisão: {a.decisao}</Linha> : null}
                </div>
              ))}
          </>
        );
      }
      case 4:
        return snapshot.sec4.baseTotal === 0 ? (
          <Vazio />
        ) : (
          <>
            <Linha>Base de compras: {brl(snapshot.sec4.baseTotal)}</Linha>
            <Linha>Crédito apurado: {brl(snapshot.sec4.creditoTotal)}</Linha>
            {snapshot.sec4.concentracaoTopPct != null ? (
              <Linha>Maior fornecedor concentra {pct(snapshot.sec4.concentracaoTopPct)}</Linha>
            ) : null}
            {snapshot.sec4.pendentes > 0 ? (
              <Linha>{snapshot.sec4.pendentes} item(ns) ainda em revisão</Linha>
            ) : null}
            {edicoes.sec4 ? <Linha>{edicoes.sec4}</Linha> : null}
          </>
        );
      case 5:
        return snapshot.sec5.valorAtual === 0 ? (
          <Vazio />
        ) : (
          <>
            <Linha>Vendas analisadas: {brl(snapshot.sec5.valorAtual)}</Linha>
            <Linha>Preço necessário: {brl(snapshot.sec5.precoNecessario)}</Linha>
            <Linha>Variação média: {pct(snapshot.sec5.variacaoMediaPct)}</Linha>
            {edicoes.sec5 ? <Linha>{edicoes.sec5}</Linha> : null}
          </>
        );
      case 6:
        return snapshot.sec6.linhas.length === 0 ? (
          <Vazio />
        ) : (
          <>
            {snapshot.sec6.linhas.slice(0, 8).map((l) => (
              <Linha key={`${l.ano}-${l.cenario}`}>
                {l.ano} · {l.cenario}: resultado{" "}
                {l.resultadoLiquido == null ? "-" : brl(l.resultadoLiquido)}
              </Linha>
            ))}
            {edicoes.sec6 ? <Linha>{edicoes.sec6}</Linha> : null}
          </>
        );
      case 7:
        return !snapshot.sec7.periodo ? (
          <Vazio />
        ) : (
          <>
            <Linha>1. Venda bruta: {brl(snapshot.sec7.vendasBrutas)}</Linha>
            <Linha>2. Retido na origem: {brl(snapshot.sec7.debitoRetido)}</Linha>
            <Linha>3. Crédito disponível: {brl(snapshot.sec7.creditoDisponivel)}</Linha>
            <p className="text-2xl font-semibold text-foreground">
              4. Efeito líquido: {brl(snapshot.sec7.debitoLiquido)}
            </p>
            {edicoes.sec7 ? <Linha>{edicoes.sec7}</Linha> : null}
          </>
        );
      case 8:
        return (
          <>
            {snapshot.sec8.cenarios.length === 0 ? <Vazio /> : null}
            {snapshot.sec8.cenarios.map((c) => (
              <Linha key={c.label}>
                {c.label}: {c.total == null ? "não disponível" : brl(c.total)}
                {c.atual ? " (regime atual)" : ""}
              </Linha>
            ))}
            {edicoes.sec8?.recomendacao ? (
              <p className="text-xl font-semibold text-foreground">
                Recomendação: {edicoes.sec8.recomendacao}
              </p>
            ) : null}
          </>
        );
      case 9:
        return (
          <>
            {AREAS_PLANO.map((a) => {
              const e = edicoes.sec9?.[a.id];
              const acao = e?.acao ?? snapshot.sec9.sugestoes[a.id] ?? "";
              if (!acao) return null;
              return (
                <Linha key={a.id}>
                  <span className="font-semibold">{a.area}:</span> {acao}
                  {e?.responsavel ? ` · ${e.responsavel}` : ""}
                  {e?.prazo ? ` · ${e.prazo}` : ""}
                </Linha>
              );
            })}
          </>
        );
      default:
        return (
          <>
            {edicoes.sec10?.sintese ? <Linha>{edicoes.sec10.sintese}</Linha> : <Vazio />}
            {edicoes.sec10?.proximaRevisao ? (
              <Linha>Próxima revisão: {edicoes.sec10.proximaRevisao}</Linha>
            ) : null}
            {snapshot.sec10.limitacoes.map((l) => (
              <p key={l} className="text-sm text-muted-foreground">
                {l}
              </p>
            ))}
          </>
        );
    }
  }, [secao, snapshot, edicoes]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Apresentação guiada · versão {versao}
        </p>
        <Button variant="ghost" onClick={onSair}>
          Sair da apresentação
        </Button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[220px_1fr]">
        <ol className="space-y-1 text-sm">
          {SECOES.map((s, idx) => (
            <li key={s.numero}>
              <button
                type="button"
                onClick={() => setI(idx)}
                className={`w-full rounded-md px-2 py-1 text-left ${
                  idx === i ? "bg-navy/10 font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.numero}. {s.titulo}
                <span className="block text-xs text-muted-foreground">{s.tempo}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="min-h-64 space-y-3">
          <h3 className="font-presentation-display text-2xl text-foreground">
            {secao.numero}. {secao.titulo}
          </h3>
          <p className="text-xs text-muted-foreground">Tempo sugerido: {secao.tempo}</p>
          <div className="space-y-2">{conteudo}</div>

          <div className="flex gap-2 pt-4">
            <Button variant="ghost" disabled={i === 0} onClick={() => setI((v) => v - 1)}>
              Anterior
            </Button>
            <Button
              disabled={i === SECOES.length - 1}
              onClick={() => setI((v) => Math.min(SECOES.length - 1, v + 1))}
            >
              Próxima seção
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
