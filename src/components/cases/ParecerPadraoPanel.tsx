import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice, TextInput } from "@/components/simulator/ui";
import { ParecerApresentacao } from "@/components/cases/ParecerApresentacao";
import { ParecerDashboard } from "@/components/cases/ParecerDashboard";
import { withAuthRetry } from "@/lib/auth-retry";
import { supabase } from "@/integrations/supabase/client";
import { avaliarChecklist } from "@/lib/parecer/compilar";
import {
  AREAS_PLANO,
  AVISO_RECOMENDACAO,
  ESCOPO_LABEL,
  SECOES,
  type Achado,
  type CaseEscopo,
  type ParecerEdicoes,
  type ParecerVersao,
} from "@/lib/parecer/tipos";
import {
  finalizarParecer,
  gerarParecer,
  listPareceres,
  salvarEdicoesParecer,
  salvarEscopoCaso,
} from "@/lib/parecer.functions";
import type { CaseRecord } from "@/lib/cases.functions";
import { brl } from "@/lib/tax/calc";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const data = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "-";

function Bloco({ children, titulo }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <div className="mt-2 space-y-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function Editor({
  value,
  onChange,
  label,
  obrigatorio,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      {obrigatorio ? <span className="text-danger"> *</span> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}

export function ParecerPadraoPanel({ caseItem }: { caseItem: CaseRecord }) {
  const listar = useServerFn(listPareceres);
  const gerar = useServerFn(gerarParecer);
  const salvar = useServerFn(salvarEdicoesParecer);
  const finalizar = useServerFn(finalizarParecer);
  const salvarEscopo = useServerFn(salvarEscopoCaso);

  const [versoes, setVersoes] = useState<ParecerVersao[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<ParecerEdicoes>({});
  const [escopo, setEscopo] = useState<CaseEscopo>("completo");
  const [objetivo, setObjetivo] = useState("");
  const [temEtapa1, setTemEtapa1] = useState(true);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [apresentando, setApresentando] = useState(false);
  const [dashboard, setDashboard] = useState(false);

  const load = useCallback(async () => {
    setErro("");
    try {
      const res = await withAuthRetry(() => listar({ data: { caseId: caseItem.id } }));
      setVersoes(res.versoes);
      setEscopo(res.escopo);
      setObjetivo(res.objetivo ?? "");
      setTemEtapa1(res.temEtapa1);
      const primeira = res.versoes[0];
      if (primeira) {
        setAtualId((id) => id ?? primeira.id);
        setEdicoes((e) => (Object.keys(e).length > 0 ? e : primeira.edicoes));
      }
    } catch {
      setErro("Não foi possível carregar os pareceres deste Caso.");
    }
  }, [listar, caseItem.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const atual = useMemo(
    () => versoes.find((v) => v.id === atualId) ?? versoes[0] ?? null,
    [versoes, atualId],
  );
  const snap = atual?.dados ?? null;

  const checklist = useMemo(
    () => (snap ? avaliarChecklist(snap, edicoes) : []),
    [snap, edicoes],
  );
  const pendentesChecklist = checklist.filter((c) => !c.ok);

  const achados: Achado[] = useMemo(() => {
    const base = edicoes.sec3?.achados ?? snap?.sec3.achados ?? [];
    const lista = [...base];
    while (lista.length < 3) lista.push({ titulo: "", impacto: "", causa: "", decisao: "" });
    return lista.slice(0, 3);
  }, [edicoes.sec3, snap]);

  const setAchado = (i: number, patch: Partial<Achado>) => {
    const lista = achados.map((a, idx) => (idx === i ? { ...a, ...patch } : a));
    setEdicoes((e) => ({ ...e, sec3: { achados: lista } }));
  };

  const handleLink = async () => {
    if (!atual) return;
    setBusy(true);
    setMsg("");
    setErro("");
    try {
      let token = atual.share_token;
      if (!atual.share_enabled || !token) {
        const res = await withAuthRetry(() => partilhar({ data: { id: atual.id, enabled: true } }));
        token = res.token;
        await load();
      }
      const url = `${window.location.origin}/relatorio/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setMsg(`Link do relatório copiado: ${url}`);
      } catch {
        setMsg(`Link do relatório: ${url}`);
      }
    } catch {
      setErro("Não foi possível gerar o link do relatório.");
    } finally {
      setBusy(false);
    }
  };

  const handleGerar = async () => {

    setBusy(true);
    setMsg("");
    setErro("");
    try {
      const res = await withAuthRetry(() => gerar({ data: { caseId: caseItem.id } }));
      if (!res.ok) {
        setErro(res.motivo);
        return;
      }
      setAtualId(res.versao.id);
      setEdicoes(res.versao.edicoes);
      await load();
      setMsg(`Versão ${res.versao.versao} gerada com o retrato atual dos dados.`);
    } catch {
      setErro("Falha ao gerar o parecer.");
    } finally {
      setBusy(false);
    }
  };

  const handleSalvar = async () => {
    if (!atual) return;
    setBusy(true);
    try {
      await withAuthRetry(() => salvar({ data: { id: atual.id, edicoes, status: "em_revisao" } }));
      setMsg("Edições salvas.");
      await load();
    } catch {
      setErro("Falha ao salvar as edições.");
    } finally {
      setBusy(false);
    }
  };

  const handleFinalizar = async () => {
    if (!atual) return;
    setBusy(true);
    try {
      await withAuthRetry(() => finalizar({ data: { id: atual.id, edicoes } }));
      setMsg("Parecer finalizado.");
      await load();
    } catch {
      setErro("Falha ao finalizar o parecer.");
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    if (!atual) return;
    setBusy(true);
    try {
      await withAuthRetry(() => salvar({ data: { id: atual.id, edicoes } }));
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const res = await fetch("/api/public/parecer-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parecerId: atual.id }),
      });
      if (!res.ok) throw new Error("falha");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parecer-padrao-v${atual.versao}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível gerar o PDF do parecer.");
    } finally {
      setBusy(false);
    }
  };

  if (apresentando && snap && atual) {
    return (
      <ParecerApresentacao
        snapshot={snap}
        edicoes={edicoes}
        versao={atual.versao}
        onSair={() => setApresentando(false)}
      />
    );
  }

  if (dashboard && snap && atual) {
    return (
      <ParecerDashboard
        snapshot={snap}
        edicoes={edicoes}
        versao={atual.versao}
        onSair={() => setDashboard(false)}
        onPdf={() => void handlePdf()}
        onApresentar={() => {
          setDashboard(false);
          setApresentando(true);
        }}
      />
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">Parecer Padrão</p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Compila em 10 seções o que já foi calculado nas etapas anteriores. Nada é recalculado
            aqui: cada versão é um retrato dos dados no momento da geração, com espaço de edição do
            analista por cima.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleGerar()} disabled={busy}>
            {versoes.length === 0 ? "Gerar rascunho" : "Gerar nova versão"}
          </Button>
          {atual ? (
            <>
              <Button variant="ghost" onClick={() => void handleSalvar()} disabled={busy}>
                Salvar edições
              </Button>
              <Button variant="ghost" onClick={() => void handlePdf()} disabled={busy}>
                Baixar PDF
              </Button>
              <Button onClick={() => void handleLink()} disabled={busy}>
                {atual.share_enabled ? "Copiar link do relatório" : "Gerar link do relatório"}
              </Button>
              <Button variant="ghost" onClick={() => setDashboard(true)}>
                Dashboard executivo
              </Button>
              <Button variant="ghost" onClick={() => setApresentando(true)}>
                Apresentação guiada
              </Button>

            </>
          ) : null}
        </div>
      </div>

      {!temEtapa1 ? (
        <Notice tone="warning">
          Pré-requisito: este Caso ainda não tem cálculo salvo do motor de regime (Etapa 1). Rode e
          salve a simulação antes de gerar o parecer.
        </Notice>
      ) : null}
      {erro ? <Notice tone="warning">{erro}</Notice> : null}
      {msg ? <Notice>{msg}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">
          Escopo do trabalho
          <select
            value={escopo}
            onChange={(e) => setEscopo(e.target.value as CaseEscopo)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="light">{ESCOPO_LABEL.light}</option>
            <option value="completo">{ESCOPO_LABEL.completo}</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Objetivo da simulação
          <TextInput
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="Ex.: avaliação de mudança de regime"
          />
        </label>
        <div>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void withAuthRetry(() =>
                salvarEscopo({ data: { caseId: caseItem.id, escopo, objetivo } }),
              ).then(() => setMsg("Escopo e objetivo salvos no cadastro do Caso."))
            }
          >
            Salvar escopo e objetivo
          </Button>
        </div>
      </div>

      {versoes.length > 1 ? (
        <label className="block max-w-sm text-xs font-medium text-muted-foreground">
          Versão
          <select
            value={atual?.id ?? ""}
            onChange={(e) => {
              const v = versoes.find((x) => x.id === e.target.value);
              setAtualId(e.target.value);
              if (v) setEdicoes(v.edicoes);
            }}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {versoes.map((v) => (
              <option key={v.id} value={v.id}>
                Versão {v.versao} · {v.status} · {data(v.gerado_em)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!snap ? (
        <Notice>Nenhuma versão gerada ainda para este Caso.</Notice>
      ) : (
        <div className="space-y-5">
          {/* 1 */}
          <article id="secao-1" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">1. {SECOES[0]!.titulo}</h3>
            <Bloco titulo="Compilado">
              <p>Cliente: {snap.sec1.cliente ?? "não informado"}</p>
              <p>CNPJ: {snap.sec1.cnpj ?? "não informado"}</p>
              <p>Regime atual: {snap.sec1.regimeAtual ?? "não informado"}</p>
              <p>Escopo: {ESCOPO_LABEL[snap.sec1.escopo]}</p>
              <p>Objetivo: {snap.sec1.objetivo ?? "não informado"}</p>
              <p>Gerado em: {data(snap.geradoEm)}</p>
            </Bloco>
            <Editor
              label="Observações do analista"
              value={edicoes.sec1 ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec1: v }))}
            />
          </article>

          {/* 2 */}
          <article id="secao-2" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">2. {SECOES[1]!.titulo}</h3>
            <Bloco titulo="Arquivos recebidos">
              {snap.sec2.carga.length === 0 ? (
                <p className="text-muted-foreground">Nenhum documento processado (lacuna documentada).</p>
              ) : (
                snap.sec2.carga.map((l) => (
                  <p key={l.tipo}>
                    {l.tipo}: {l.validos} válidos de {l.total} · {l.duplicados} duplicados ·{" "}
                    {l.naoSaoNotas} não são notas · {l.ignorados} ignorados · {l.manuais} manuais
                  </p>
                ))
              )}
            </Bloco>
            <Bloco titulo="Lacunas de classificação">
              {snap.sec2.pendencias.length === 0 ? (
                <p className="text-muted-foreground">Nenhum item pendente.</p>
              ) : (
                snap.sec2.pendencias.map((p) => (
                  <p key={p.fluxo}>
                    {p.fluxo}: {p.itens} item(ns), {brl(p.valor)}
                  </p>
                ))
              )}
            </Bloco>
            <Bloco titulo="Inputs manuais e parâmetros">
              {snap.sec2.despesas.map((d) => (
                <p key={d.ano}>Despesa operacional {d.ano}: {brl(d.valor)} (informada manualmente)</p>
              ))}
              {snap.sec2.parametros.map((p) => (
                <p key={p.label}>
                  {p.label}: {p.valor} · última alteração {data(p.atualizadoEm)}
                </p>
              ))}
              {snap.sec2.issOrigem ? <p>{snap.sec2.issOrigem}</p> : null}
              {snap.sec2.excecoes.map((x) => (
                <p key={x.fonte}>Exceções pela fonte {x.fonte}: {x.itens} item(ns)</p>
              ))}
            </Bloco>
            <Bloco titulo="Limitações">
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {snap.sec2.limitacoes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Bloco>
            <Editor
              label="Observações do analista"
              value={edicoes.sec2 ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec2: v }))}
            />
          </article>

          {/* 3 */}
          <article id="secao-3" className="scroll-mt-6 space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">3. {SECOES[2]!.titulo}</h3>
            <p className="text-xs text-muted-foreground">
              Sugestão do sistema, no formato impacto → causa → decisão. Revise antes de finalizar.
            </p>
            {achados.map((a, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <TextInput
                  value={a.titulo}
                  placeholder={`Achado ${i + 1} — título`}
                  onChange={(e) => setAchado(i, { titulo: e.target.value })}
                />
                <Editor label="Impacto" value={a.impacto} onChange={(v) => setAchado(i, { impacto: v })} />
                <Editor label="Causa" value={a.causa} onChange={(v) => setAchado(i, { causa: v })} />
                <Editor label="Decisão" value={a.decisao} onChange={(v) => setAchado(i, { decisao: v })} />
              </div>
            ))}
          </article>

          {/* 4 */}
          <article id="secao-4" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">4. {SECOES[3]!.titulo}</h3>
            <Bloco titulo="Compilado">
              {snap.sec4.baseTotal === 0 ? (
                <p className="text-muted-foreground">Sem compras apuradas (lacuna documentada).</p>
              ) : (
                <>
                  <p>
                    Base {brl(snap.sec4.baseTotal)} · crédito apurado {brl(snap.sec4.creditoTotal)}
                    {snap.sec4.concentracaoTopPct != null
                      ? ` · maior fornecedor concentra ${pct(snap.sec4.concentracaoTopPct)}`
                      : ""}
                  </p>
                  {snap.sec4.fornecedores.slice(0, 5).map((f) => (
                    <p key={(f.cnpj ?? "") + (f.nome ?? "")}>
                      {f.nome ?? f.cnpj ?? "-"}: crédito {brl(f.valorApurado)} em {f.itens} item(ns)
                    </p>
                  ))}
                  {snap.sec4.pendentes > 0 ? (
                    <p className="text-danger">
                      Risco: {snap.sec4.pendentes} item(ns) em revisão podem alterar o crédito.
                    </p>
                  ) : null}
                </>
              )}
            </Bloco>
            <Editor
              label="Observações do analista"
              value={edicoes.sec4 ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec4: v }))}
            />
          </article>

          {/* 5 */}
          <article id="secao-5" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">5. {SECOES[4]!.titulo}</h3>
            <Bloco titulo="Compilado">
              {snap.sec5.valorAtual === 0 ? (
                <p className="text-muted-foreground">Sem preço necessário calculado (lacuna documentada).</p>
              ) : (
                <>
                  <p>
                    Vendas analisadas {brl(snap.sec5.valorAtual)} · preço necessário{" "}
                    {brl(snap.sec5.precoNecessario)} · variação média {pct(snap.sec5.variacaoMediaPct)}
                  </p>
                  {snap.sec5.porPerfil.map((p) => (
                    <p key={p.perfil}>
                      {p.perfil}: {brl(p.valorAtual)} → {brl(p.precoNecessario)} ({p.itens} itens)
                    </p>
                  ))}
                  {snap.sec5.porAno.map((a) => (
                    <p key={a.ano}>
                      {a.ano}: {brl(a.precoNecessario)} ({pct(a.variacaoPct)})
                    </p>
                  ))}
                </>
              )}
            </Bloco>
            <Editor
              label="Observações do analista"
              value={edicoes.sec5 ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec5: v }))}
            />
          </article>

          {/* 6 */}
          <article id="secao-6" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">6. {SECOES[5]!.titulo}</h3>
            <Bloco titulo="Compilado">
              {snap.sec6.linhas.length === 0 ? (
                <p className="text-muted-foreground">DRE ainda não gerada (lacuna documentada).</p>
              ) : (
                snap.sec6.linhas.map((l) => (
                  <p key={`${l.ano}-${l.cenario}`}>
                    {l.ano} · {l.cenario}: receita {brl(l.receitaBruta)}, custo {brl(l.custo)},
                    resultado {l.resultadoLiquido == null ? "-" : brl(l.resultadoLiquido)}
                  </p>
                ))
              )}
              <p className="text-muted-foreground">
                A receita projetada aparece sem a CBS embutida: IRPJ/CSLL maior não significa,
                isoladamente, piora de resultado.
              </p>
            </Bloco>
            <Editor
              label="Observações do analista"
              value={edicoes.sec6 ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec6: v }))}
            />
          </article>

          {/* 7 */}
          <article id="secao-7" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">7. {SECOES[6]!.titulo}</h3>
            <Bloco titulo="Leitura dos 4 passos">
              {!snap.sec7.periodo ? (
                <p className="text-muted-foreground">Fluxo ainda não projetado (lacuna documentada).</p>
              ) : (
                <>
                  <p>
                    Período {String(snap.sec7.periodo.mes).padStart(2, "0")}/{snap.sec7.periodo.ano}
                  </p>
                  <p>1. Venda bruta: {brl(snap.sec7.vendasBrutas)}</p>
                  <p>2. IBS/CBS retido na origem: {brl(snap.sec7.debitoRetido)}</p>
                  <p>3. Crédito de compras disponível: {brl(snap.sec7.creditoDisponivel)}</p>
                  <p className="font-semibold">
                    4. Efeito líquido (saída efetiva): {brl(snap.sec7.debitoLiquido)}
                  </p>
                  <p className="text-muted-foreground">
                    Mostrar apenas a retenção da venda, sem o crédito de compras, é uma meia-leitura.
                  </p>
                </>
              )}
            </Bloco>
            <Editor
              label="Observações do analista"
              value={edicoes.sec7 ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec7: v }))}
            />
          </article>

          {/* 8 */}
          <article id="secao-8" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">8. {SECOES[7]!.titulo}</h3>
            <Bloco titulo="Comparativo do motor de regime">
              {snap.sec8.cenarios.length === 0 ? (
                <p className="text-muted-foreground">Comparativo indisponível (lacuna documentada).</p>
              ) : (
                snap.sec8.cenarios.map((c) => (
                  <p key={c.label}>
                    {c.label}: {c.total == null ? "não disponível" : brl(c.total)}
                    {c.atual ? " (regime atual)" : ""}
                  </p>
                ))
              )}
              {snap.sec8.resultadoLiquido != null ? (
                <p>Resultado após IR/CS: {brl(snap.sec8.resultadoLiquido)}</p>
              ) : null}
            </Bloco>
            <Editor
              label="Recomendação profissional final"
              obrigatorio
              value={edicoes.sec8?.recomendacao ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec8: { recomendacao: v } }))}
            />
            <Notice tone="warning">{AVISO_RECOMENDACAO}</Notice>
          </article>

          {/* 9 */}
          <article id="secao-9" className="scroll-mt-6 space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">9. {SECOES[8]!.titulo}</h3>
            {AREAS_PLANO.map((area) => {
              const edit = edicoes.sec9?.[area.id] ?? {};
              const setArea = (patch: Record<string, string>) =>
                setEdicoes((e) => ({
                  ...e,
                  sec9: { ...(e.sec9 ?? {}), [area.id]: { ...edit, ...patch } },
                }));
              return (
                <div key={area.id} className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{area.area}</p>
                  <p className="text-xs text-muted-foreground">{area.pergunta}</p>
                  {snap.sec9.sugestoes[area.id] ? (
                    <p className="text-xs text-navy">Sugestão: {snap.sec9.sugestoes[area.id]}</p>
                  ) : null}
                  <Editor
                    label="Ação"
                    value={edit.acao ?? snap.sec9.sugestoes[area.id] ?? ""}
                    onChange={(v) => setArea({ acao: v })}
                  />
                  <div className="grid gap-2 sm:grid-cols-4">
                    <TextInput
                      value={edit.responsavel ?? ""}
                      placeholder="Responsável"
                      onChange={(e) => setArea({ responsavel: e.target.value })}
                    />
                    <TextInput
                      value={edit.prazo ?? ""}
                      placeholder="Prazo"
                      onChange={(e) => setArea({ prazo: e.target.value })}
                    />
                    <TextInput
                      value={edit.prioridade ?? ""}
                      placeholder="Prioridade"
                      onChange={(e) => setArea({ prioridade: e.target.value })}
                    />
                    <TextInput
                      value={edit.indicador ?? ""}
                      placeholder="Indicador"
                      onChange={(e) => setArea({ indicador: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </article>

          {/* 10 */}
          <article id="secao-10" className="scroll-mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">10. {SECOES[9]!.titulo}</h3>
            <Bloco titulo="Ressalvas">
              <p className="text-muted-foreground">
                As limitações aplicáveis estão listadas na Seção 2 e integram este parecer.
              </p>
            </Bloco>
            <Editor
              label="Síntese e decisões recomendadas"
              obrigatorio
              value={edicoes.sec10?.sintese ?? ""}
              onChange={(v) => setEdicoes((e) => ({ ...e, sec10: { ...(e.sec10 ?? {}), sintese: v } }))}
            />
            <label className="block max-w-xs text-xs font-medium text-muted-foreground">
              Data da próxima revisão
              <input
                type="date"
                value={edicoes.sec10?.proximaRevisao ?? ""}
                onChange={(e) =>
                  setEdicoes((prev) => ({
                    ...prev,
                    sec10: { ...(prev.sec10 ?? {}), proximaRevisao: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </article>

          {/* Checklist */}
          <div className="space-y-2 rounded-md border border-navy/30 bg-navy/5 p-4">
            <p className="text-sm font-semibold text-foreground">
              Lista de verificação antes de finalizar
            </p>
            <ul className="space-y-1 text-sm">
              {checklist.map((item) => (
                <li key={item.id} className={item.ok ? "text-success" : "text-foreground"}>
                  {item.ok ? "✓" : "•"} {item.label} —{" "}
                  <span className="text-muted-foreground">{item.detalhe}</span>{" "}
                  {!item.ok ? (
                    <a href={`#${item.alvo}`} className="underline">
                      ir para a seção
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {pendentesChecklist.length > 0 ? (
              <Notice tone="warning">
                {pendentesChecklist.length} item(ns) da lista ainda não atendidos. Você pode gerar
                rascunho e PDF assim mesmo; o aviso serve para a conferência antes da entrega.
              </Notice>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => void handleSalvar()} disabled={busy}>
                Salvar edições
              </Button>
              <Button variant="ghost" onClick={() => void handleFinalizar()} disabled={busy}>
                Finalizar parecer
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
