import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button, Field, Notice, NumberInput, Select } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  listarCatalogoMonofasico,
  salvarAuditoriaMonofasica,
} from "@/lib/monofasico-auditoria.functions";
import {
  CLASSIFICACAO_LABELS,
  auditoriaParaCsv,
  classificarItem,
  indexarCatalogo,
  isSaida,
  resumirAuditoria,
  type CatalogoNcmMonofasico,
  type ClassificacaoMonofasica,
  type ItemClassificado,
} from "@/lib/monofasico/auditoria";
import { AVISO_MONOFASICO, REGIMES, type RegimeMonofasico } from "@/lib/monofasico/calculo";
import { readNotasAuditoria } from "@/lib/monofasico/parse-nfe";
import { brl } from "@/lib/tax/calc";

const COLORS = { indebito: "#d946a0", receita: "#1e3a5f" };

function Kpi({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const ring =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "bad"
        ? "border-rose-200 bg-rose-50"
        : "border-border bg-secondary";
  return (
    <article className={`rounded-xl border p-4 ${ring}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </article>
  );
}

/** Auditoria real: lê os XMLs de venda no navegador e classifica item a item. */
export function AuditoriaXmlPanel({
  casos,
}: {
  casos: { id: string; nome: string; cnpj: string | null }[];
}) {
  const buscarCatalogo = useServerFn(listarCatalogoMonofasico);
  const gravar = useServerFn(salvarAuditoriaMonofasica);

  const [catalogo, setCatalogo] = useState<CatalogoNcmMonofasico[] | null>(null);
  const [regime, setRegime] = useState<RegimeMonofasico>("simples");
  const [aliquotaSimples, setAliquotaSimples] = useState(1.5);
  const [itens, setItens] = useState<ItemClassificado[]>([]);
  const [descartadas, setDescartadas] = useState<{ arquivo: string; motivo: string }[]>([]);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<ClassificacaoMonofasica | "todos">("possivel_indebito");
  const [casoId, setCasoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await buscarCatalogo({});
        setCatalogo(res.linhas);
      } catch {
        setErro("Não foi possível carregar o catálogo de NCMs monofásicos.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const index = useMemo(() => indexarCatalogo(catalogo ?? []), [catalogo]);
  const resumo = useMemo(() => resumirAuditoria(itens), [itens]);

  /** Reclassifica o que já foi lido quando o regime ou a alíquota mudam. */
  const reclassificar = (regimeNovo: RegimeMonofasico, aliq: number) => {
    setItens((prev) =>
      prev.map((i) =>
        classificarItem(
          {
            arquivo: i.arquivo,
            chave: i.chave,
            modelo: i.modelo,
            numero: i.numero,
            dataEmissao: i.dataEmissao,
            ncm: i.ncm,
            cfop: i.cfop,
            descricao: i.descricao,
            valorItem: i.valorItem,
            cstPis: i.cstPis,
            cstCofins: i.cstCofins,
            valorPis: i.valorPis,
            valorCofins: i.valorCofins,
          },
          index,
          regimeNovo,
          aliq,
        ),
      ),
    );
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !catalogo) return;
    setLendo(true);
    setErro("");
    setAviso("");
    try {
      const notas = await readNotasAuditoria(Array.from(files));
      const problemas = notas
        .filter((n) => n.status !== "ok")
        .map((n) => ({
          arquivo: n.arquivo,
          motivo:
            n.status === "xml_invalido"
              ? "XML inválido"
              : n.status === "nao_e_nfe"
                ? "Não é NF-e/NFC-e"
                : "Nota sem itens",
        }));
      const novos = notas
        .filter((n) => n.status === "ok")
        .flatMap((n) => n.itens)
        .filter((i) => isSaida(i.cfop))
        .map((i) => classificarItem(i, index, regime, aliquotaSimples));

      setDescartadas(problemas);
      setItens((prev) => {
        const vistos = new Set(prev.map((p) => `${p.chave ?? p.arquivo}|${p.ncm}|${p.valorItem}`));
        const extras = novos.filter(
          (n) => !vistos.has(`${n.chave ?? n.arquivo}|${n.ncm}|${n.valorItem}`),
        );
        return [...prev, ...extras];
      });
      if (novos.length === 0) {
        setErro("Nenhum item de saída (CFOP 5/6/7) foi encontrado nos arquivos enviados.");
      }
    } catch {
      setErro("Não foi possível ler os arquivos enviados.");
    } finally {
      setLendo(false);
    }
  };

  const baixarCsv = () => {
    const blob = new Blob([auditoriaParaCsv(itens)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria-monofasico.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const salvarNoCaso = async () => {
    if (!casoId || itens.length === 0) return;
    setSalvando(true);
    setAviso("");
    try {
      const res = await withAuthRetry(() =>
        gravar({ data: { caseId: casoId, regime, itens } }),
      );
      setAviso(`Auditoria gravada no Caso: ${res.gravados} itens.`);
    } catch {
      setAviso("Não foi possível gravar a auditoria. Verifique se você está autenticado.");
    } finally {
      setSalvando(false);
    }
  };

  const listaFiltrada = itens
    .filter((i) => (filtro === "todos" ? true : i.classificacao === filtro))
    .slice(0, 300);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold text-foreground">Auditoria real pelos XMLs</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie os XMLs de venda (NF-e modelo 55 e NFC-e modelo 65) dos últimos 60 meses. Os
          arquivos são lidos no seu próprio navegador: cada item é comparado ao catálogo de NCMs
          com PIS/COFINS concentrado na indústria.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Regime do cliente" hint={REGIMES.find((r) => r.id === regime)?.hint}>
            <Select
              value={regime}
              onChange={(e) => {
                const novo = e.target.value as RegimeMonofasico;
                setRegime(novo);
                reclassificar(novo, aliquotaSimples);
              }}
            >
              {REGIMES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          {regime === "simples" ? (
            <Field
              label="Parcela de PIS/COFINS dentro do DAS"
              hint="Alíquota efetiva do DAS × participação de PIS/COFINS do anexo (%)"
            >
              <NumberInput
                value={aliquotaSimples}
                suffix="%"
                onChange={(v) => {
                  setAliquotaSimples(v);
                  reclassificar(regime, v);
                }}
              />
            </Field>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-input bg-secondary/40 p-6 text-center">
            <input
              type="file"
              multiple
              accept=".xml,.zip"
              className="sr-only"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <span className="text-sm font-semibold text-foreground">
              {lendo ? "Lendo notas..." : "Selecionar XMLs ou um .zip com as notas"}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {catalogo
                ? `${catalogo.length} faixas de NCM monofásico no catálogo`
                : "Carregando catálogo..."}
            </span>
          </label>
        </div>

        {erro ? (
          <div className="mt-3">
            <Notice tone="warning">{erro}</Notice>
          </div>
        ) : null}
        {descartadas.length > 0 ? (
          <div className="mt-3">
            <Notice>
              {descartadas.length} arquivo(s) não processado(s):{" "}
              {descartadas
                .slice(0, 5)
                .map((d) => `${d.arquivo} (${d.motivo})`)
                .join(", ")}
              {descartadas.length > 5 ? "..." : ""}
            </Notice>
          </div>
        ) : null}
      </section>

      {itens.length > 0 ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Indébito estimado"
              value={brl(resumo.indebitoTotal)}
              detail={`${resumo.itensIndebito} itens tributados indevidamente`}
              tone={resumo.indebitoTotal > 0 ? "bad" : "good"}
            />
            <Kpi
              label="Receita auditada"
              value={brl(resumo.receitaTotal)}
              detail={`${resumo.notas} notas · ${resumo.itens} itens`}
            />
            <Kpi
              label="Receita monofásica"
              value={brl(resumo.receitaMonofasica)}
              detail={`${resumo.participacaoMonofasicaPct.toFixed(1)}% do total auditado`}
            />
            <Kpi
              label="Já segregado corretamente"
              value={String(resumo.itensCorretos)}
              detail={`${resumo.itensSemNcm} itens sem NCM na nota`}
              tone="good"
            />
          </section>

          {resumo.competencias.length > 1 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground">Indébito por competência</h4>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resumo.competencias}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="chave" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => brl(v)} />
                    <Bar dataKey="indebito" name="Indébito" fill={COLORS.indebito} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground">Por grupo de produto</h4>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {resumo.grupos.map((g) => (
                    <tr key={g.chave} className="border-b border-border/60 last:border-0">
                      <td className="py-2">{g.rotulo}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {g.itens} itens
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {brl(g.indebito)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground">Top NCMs monofásicos</h4>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {resumo.ncms.slice(0, 10).map((n) => (
                    <tr key={n.chave} className="border-b border-border/60 last:border-0">
                      <td className="py-2 tabular-nums">{n.chave}</td>
                      <td className="max-w-[16rem] truncate py-2 text-muted-foreground">
                        {n.rotulo}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {brl(n.indebito)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">Itens auditados</h4>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-56">
                  <Select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value as ClassificacaoMonofasica | "todos")}
                  >
                    <option value="possivel_indebito">Possível indébito</option>
                    <option value="monofasico_correto">Monofásico já correto</option>
                    <option value="nao_monofasico">Fora do monofásico</option>
                    <option value="sem_ncm">Sem NCM na nota</option>
                    <option value="todos">Todos os itens</option>
                  </Select>
                </div>
                <Button variant="ghost" onClick={baixarCsv}>
                  Exportar CSV
                </Button>
                <Button variant="ghost" onClick={() => setItens([])}>
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Competência</th>
                    <th className="py-2">NCM</th>
                    <th className="py-2">Produto</th>
                    <th className="py-2">CFOP</th>
                    <th className="py-2">CST</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-right">Indébito</th>
                    <th className="py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((i, idx) => (
                    <tr
                      key={`${i.chave ?? i.arquivo}-${idx}`}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 tabular-nums">{i.competencia ?? "—"}</td>
                      <td className="py-2 tabular-nums">{i.ncm ?? "—"}</td>
                      <td className="max-w-[18rem] truncate py-2">{i.descricao ?? "—"}</td>
                      <td className="py-2 tabular-nums">{i.cfop ?? "—"}</td>
                      <td className="py-2 tabular-nums">{i.cstPis ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{brl(i.valorItem)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {i.indebitoEstimado > 0 ? brl(i.indebitoEstimado) : "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {CLASSIFICACAO_LABELS[i.classificacao]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {itens.length > listaFiltrada.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Mostrando os primeiros {listaFiltrada.length} itens do filtro. O CSV traz a lista
                  completa.
                </p>
              ) : null}
            </div>
          </section>

          {casos.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground">Gravar no Caso</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Caso do cliente">
                  <Select value={casoId} onChange={(e) => setCasoId(e.target.value)}>
                    <option value="">Selecione um caso</option>
                    {casos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.cnpj ? ` — ${c.cnpj}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button onClick={() => void salvarNoCaso()} disabled={!casoId || salvando}>
                  {salvando ? "Gravando..." : "Gravar auditoria"}
                </Button>
              </div>
              {aviso ? (
                <div className="mt-3">
                  <Notice>{aviso}</Notice>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      <Notice tone="warning">{AVISO_MONOFASICO}</Notice>
    </div>
  );
}
