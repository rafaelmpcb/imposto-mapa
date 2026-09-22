import { useMemo, useState } from "react";

import { Button } from "@/components/simulator/ui";
import {
  CaixaChart,
  FornecedoresChart,
  PrecoChart,
  RegimesChart,
  ResultadoAnoChart,
  TransicaoChart,
} from "@/components/cases/ParecerCharts";
import {
  AREAS_PLANO,
  ESCOPO_LABEL,
  type ParecerEdicoes,
  type ParecerSnapshot,
} from "@/lib/parecer/tipos";
import { brl } from "@/lib/tax/calc";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const MODULOS = [
  { id: "visao", label: "Visão geral" },
  { id: "regimes", label: "Regimes" },
  { id: "compras", label: "Compras e créditos" },
  { id: "precos", label: "Preço e margem" },
  { id: "caixa", label: "Caixa e split" },
  { id: "plano", label: "Achados e plano" },
] as const;

type ModuloId = (typeof MODULOS)[number]["id"];

function Card({
  titulo,
  children,
  destaque,
}: {
  titulo?: string;
  children: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        destaque ? "border-navy bg-navy text-navy-foreground" : "border-border bg-card"
      }`}
    >
      {titulo ? (
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            destaque ? "text-navy-foreground/70" : "text-muted-foreground"
          }`}
        >
          {titulo}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Numero({ valor, sub }: { valor: string; sub?: string | undefined }) {
  return (
    <div>
      <p className="font-presentation-display text-3xl leading-tight">{valor}</p>
      {sub ? <p className="mt-1 text-xs opacity-80">{sub}</p> : null}
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function ParecerDashboard({
  snapshot,
  edicoes,
  versao,
  onSair,
  onPdf,
  onApresentar,
}: {
  snapshot: ParecerSnapshot;
  edicoes: ParecerEdicoes;
  versao: number;
  onSair?: (() => void) | undefined;
  onPdf?: (() => void) | undefined;
  onApresentar?: (() => void) | undefined;

}) {
  const [modulo, setModulo] = useState<ModuloId>("visao");

  const anos = useMemo(
    () => Array.from(new Set(snapshot.sec6.linhas.map((l) => l.ano))).sort((a, b) => a - b),
    [snapshot.sec6.linhas],
  );
  const [ano, setAno] = useState<number | null>(anos[0] ?? null);
  const anoSel = ano != null && anos.includes(ano) ? ano : (anos[0] ?? null);

  const dreAno = useMemo(() => {
    const doAno = snapshot.sec6.linhas.filter((l) => l.ano === anoSel);
    const atual = doAno.find((l) => l.cenario === "atual") ?? null;
    const projetado = doAno.find((l) => l.cenario !== "atual") ?? null;
    return { atual, projetado };
  }, [snapshot.sec6.linhas, anoSel]);

  const diferenca = useMemo(() => {
    const a = dreAno.atual?.resultadoLiquido;
    const p = dreAno.projetado?.resultadoLiquido;
    if (a == null || p == null) return null;
    return p - a;
  }, [dreAno]);

  const melhorRegime = useMemo(() => {
    const disp = snapshot.sec8.cenarios.filter((c) => c.total != null);
    return disp.slice().sort((x, y) => (x.total ?? 0) - (y.total ?? 0))[0] ?? null;
  }, [snapshot.sec8.cenarios]);

  const achados = (edicoes.sec3?.achados ?? snapshot.sec3.achados).filter(
    (a) => a.impacto || a.decisao,
  );

  const precoAno = snapshot.sec5.porAno.find((p) => p.ano === anoSel) ?? null;
  const caixaAno = snapshot.sec7.resumoAnual.find((r) => r.ano === anoSel) ?? null;

  return (
    <section className="space-y-5 rounded-xl border border-border bg-background p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            Diagnóstico com documentos fiscais reais
          </span>
          <h2 className="mt-2 font-presentation-display text-3xl text-foreground">
            {snapshot.sec1.cliente ?? "Cliente não informado"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {snapshot.sec1.cnpj ?? "CNPJ não informado"} ·{" "}
            {snapshot.sec1.regimeAtual ?? "regime não informado"} ·{" "}
            {ESCOPO_LABEL[snapshot.sec1.escopo]}
          </p>
          {snapshot.sec1.objetivo ? (
            <p className="mt-1 max-w-2xl text-sm text-foreground">{snapshot.sec1.objetivo}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Versão {versao}</span>
          {onApresentar ? (
            <Button variant="ghost" onClick={onApresentar}>
              Apresentação guiada
            </Button>
          ) : null}
          {onPdf ? (
            <Button variant="ghost" onClick={onPdf}>
              Baixar PDF
            </Button>
          ) : null}
          {onSair ? (
            <Button variant="ghost" onClick={onSair}>
              Sair do dashboard
            </Button>
          ) : null}
        </div>

      </header>

      <div className="flex flex-wrap items-center gap-2">
        {MODULOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModulo(m.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              modulo === m.id
                ? "bg-navy text-navy-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
        {anos.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">Ano</span>
            {anos.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAno(a)}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  a === anoSel
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {modulo === "visao" ? (
        <div className="space-y-4">
          {diferenca == null ? (
            <Vazio>
              Sem DRE projetada para {anoSel ?? "o período"} — gere a DRE do Caso para ver o impacto
              no resultado.
            </Vazio>
          ) : (
            <Card destaque titulo={`Impacto no resultado líquido em ${anoSel}`}>
              <Numero
                valor={`${diferenca >= 0 ? "+" : "-"} ${brl(Math.abs(diferenca))}`}
                sub={
                  diferenca >= 0
                    ? "Resultado projetado acima do cenário atual"
                    : "Resultado projetado abaixo do cenário atual"
                }
              />
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {dreAno.atual?.resultadoLiquido != null &&
            dreAno.projetado?.resultadoLiquido != null ? (
              <ResultadoAnoChart
                atual={dreAno.atual.resultadoLiquido}
                projetado={dreAno.projetado.resultadoLiquido}
                ano={anoSel}
              />
            ) : null}
            {snapshot.sec6.linhas.length > 0 ? (
              <TransicaoChart linhas={snapshot.sec6.linhas} />
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card titulo="Resultado atual">
              <Numero
                valor={dreAno.atual?.resultadoLiquido == null ? "-" : brl(dreAno.atual.resultadoLiquido)}
                sub={dreAno.atual ? `Receita ${brl(dreAno.atual.receitaBruta)}` : undefined}
              />
            </Card>
            <Card titulo="Resultado projetado">
              <Numero
                valor={
                  dreAno.projetado?.resultadoLiquido == null
                    ? "-"
                    : brl(dreAno.projetado.resultadoLiquido)
                }
                sub={dreAno.projetado ? `Custo ${brl(dreAno.projetado.custo)}` : undefined}
              />
            </Card>
            <Card titulo="Crédito apurado nas compras">
              <Numero
                valor={brl(snapshot.sec4.creditoTotal)}
                sub={`Sobre ${brl(snapshot.sec4.baseTotal)} de base analisada`}
              />
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card titulo="Documentos que sustentam o diagnóstico">
              {snapshot.sec2.carga.length === 0 ? (
                <Vazio>Nenhum documento processado neste Caso.</Vazio>
              ) : (
                <ul className="space-y-1 text-sm text-foreground">
                  {snapshot.sec2.carga.map((l) => (
                    <li key={l.tipo} className="flex justify-between gap-3">
                      <span>{l.tipo}</span>
                      <span className="text-muted-foreground">
                        {l.validos} válidos de {l.total}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card titulo="Pontos em aberto">
              {snapshot.sec2.pendencias.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma pendência de classificação registrada.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-foreground">
                  {snapshot.sec2.pendencias.map((p) => (
                    <li key={p.fluxo} className="flex justify-between gap-3">
                      <span>{p.fluxo}</span>
                      <span className="text-muted-foreground">
                        {p.itens} item(ns) · {brl(p.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {modulo === "regimes" ? (
        <div className="space-y-4">
          <RegimesChart
            cenarios={snapshot.sec8.cenarios}
            melhorLabel={melhorRegime?.label ?? null}
          />
          {snapshot.sec8.cenarios.length === 0 ? (
            <Vazio>Sem comparação de regimes disponível para este Caso.</Vazio>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {snapshot.sec8.cenarios.map((c) => {
                const melhor = melhorRegime?.label === c.label;
                return (
                  <Card key={c.label} destaque={melhor}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{c.label}</p>
                      {melhor ? (
                        <span className="rounded-full bg-navy-foreground/15 px-2 py-0.5 text-[11px]">
                          Mais eficiente
                        </span>
                      ) : c.atual ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          Regime atual
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-presentation-display text-2xl">
                      {c.total == null ? "Não disponível" : brl(c.total)}
                    </p>
                    {c.rate != null ? (
                      <p className="mt-1 text-xs opacity-80">Carga de {pct(c.rate)}</p>
                    ) : null}
                    {c.nota ? <p className="mt-2 text-xs opacity-80">{c.nota}</p> : null}
                  </Card>
                );
              })}
            </div>
          )}
          <Card titulo="Recomendação do escritório">
            <p className="text-sm text-foreground">
              {edicoes.sec8?.recomendacao ??
                "Recomendação a ser registrada pelo analista antes da entrega."}
            </p>
          </Card>
        </div>
      ) : null}

      {modulo === "compras" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card titulo="Base de compras">
              <Numero valor={brl(snapshot.sec4.baseTotal)} />
            </Card>
            <Card titulo="Crédito de IBS/CBS">
              <Numero valor={brl(snapshot.sec4.creditoTotal)} />
            </Card>
            <Card titulo="Concentração no maior fornecedor">
              <Numero
                valor={
                  snapshot.sec4.concentracaoTopPct == null
                    ? "-"
                    : pct(snapshot.sec4.concentracaoTopPct)
                }
                sub={`${snapshot.sec4.pendentes} item(ns) em revisão`}
              />
            </Card>
          </div>
          {snapshot.sec4.fornecedores.length === 0 ? (
            <Vazio>Sem notas de compra processadas neste Caso.</Vazio>
          ) : (
            <FornecedoresChart fornecedores={snapshot.sec4.fornecedores} />
          )}
        </div>
      ) : null}

      {modulo === "precos" ? (
        <div className="space-y-4">
          {snapshot.sec5.valorAtual === 0 ? (
            <Vazio>Sem vendas analisadas para calcular o preço necessário.</Vazio>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card titulo="Vendas analisadas">
                  <Numero valor={brl(snapshot.sec5.valorAtual)} />
                </Card>
                <Card titulo="Preço necessário">
                  <Numero valor={brl(snapshot.sec5.precoNecessario)} />
                </Card>
                <Card destaque titulo={`Variação necessária${precoAno ? ` em ${precoAno.ano}` : ""}`}>
                  <Numero
                    valor={pct(precoAno?.variacaoPct ?? snapshot.sec5.variacaoMediaPct)}
                    sub="Piso técnico de neutralidade tributária, não recomendação comercial."
                  />
                </Card>
              </div>
              <Card titulo="Por perfil de cliente">
                {snapshot.sec5.porPerfil.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem quebra por perfil de cliente.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {snapshot.sec5.porPerfil.map((p) => (
                      <li key={p.perfil} className="flex justify-between gap-3">
                        <span className="text-foreground">{p.perfil}</span>
                        <span className="text-muted-foreground">
                          {brl(p.valorAtual)} → {brl(p.precoNecessario)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <PrecoChart porAno={snapshot.sec5.porAno} />
            </>
          )}
        </div>
      ) : null}

      {modulo === "caixa" ? (
        <div className="space-y-4">
          {!snapshot.sec7.periodo ? (
            <Vazio>Gere o fluxo de caixa do Caso para ler a mecânica do split payment.</Vazio>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card titulo="1. Venda bruta">
                  <Numero valor={brl(snapshot.sec7.vendasBrutas)} />
                </Card>
                <Card titulo="2. Retido na origem">
                  <Numero valor={brl(snapshot.sec7.debitoRetido)} />
                </Card>
                <Card titulo="3. Crédito disponível">
                  <Numero valor={brl(snapshot.sec7.creditoDisponivel)} />
                </Card>
                <Card destaque titulo="4. Efeito líquido">
                  <Numero
                    valor={brl(snapshot.sec7.debitoLiquido)}
                    sub="A retenção isolada não é o custo: o crédito reduz o valor efetivo."
                  />
                </Card>
              </div>
              <CaixaChart resumo={snapshot.sec7.resumoAnual} />
              <Card titulo={`Resumo anual${caixaAno ? ` · ${caixaAno.ano}` : ""}`}>
                {snapshot.sec7.resumoAnual.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem série anual de caixa.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {snapshot.sec7.resumoAnual.map((r) => (
                      <li
                        key={r.ano}
                        className={`flex justify-between gap-3 rounded-md px-2 py-1 ${
                          r.ano === anoSel ? "bg-secondary" : ""
                        }`}
                      >
                        <span className="text-foreground">{r.ano}</span>
                        <span className="text-muted-foreground">
                          Retido {brl(r.retido)} · Crédito {brl(r.credito)} · Líquido{" "}
                          {brl(r.liquido)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      ) : null}

      {modulo === "plano" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {achados.length === 0 ? (
              <Vazio>Os achados ainda não foram escritos pelo analista.</Vazio>
            ) : (
              achados.map((a, i) => (
                <Card key={i} titulo={`Achado ${i + 1}`}>
                  <p className="font-presentation-display text-lg text-foreground">{a.titulo}</p>
                  {a.impacto ? <p className="mt-2 text-sm text-foreground">{a.impacto}</p> : null}
                  {a.causa ? (
                    <p className="mt-2 text-xs text-muted-foreground">Causa: {a.causa}</p>
                  ) : null}
                  {a.decisao ? (
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Decisão: {a.decisao}
                    </p>
                  ) : null}
                </Card>
              ))
            )}
          </div>
          <Card titulo="Plano de ação por área">
            <ul className="space-y-2 text-sm">
              {AREAS_PLANO.map((area) => {
                const e = edicoes.sec9?.[area.id];
                const acao = e?.acao ?? snapshot.sec9.sugestoes[area.id] ?? "";
                if (!acao) return null;
                return (
                  <li key={area.id} className="rounded-md border border-border p-3">
                    <p className="font-semibold text-foreground">{area.area}</p>
                    <p className="text-foreground">{acao}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e?.responsavel ? `Responsável: ${e.responsavel}` : "Responsável a definir"}
                      {e?.prazo ? ` · Prazo: ${e.prazo}` : ""}
                      {e?.prioridade ? ` · Prioridade: ${e.prioridade}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
          {edicoes.sec10?.sintese ? (
            <Card titulo="Conclusão">
              <p className="text-sm text-foreground">{edicoes.sec10.sintese}</p>
              {edicoes.sec10.proximaRevisao ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Próxima revisão: {edicoes.sec10.proximaRevisao}
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      <footer className="space-y-1 border-t border-border pt-3">
        {snapshot.sec10.limitacoes.map((l) => (
          <p key={l} className="text-[11px] leading-relaxed text-muted-foreground">
            {l}
          </p>
        ))}
      </footer>
    </section>
  );
}
