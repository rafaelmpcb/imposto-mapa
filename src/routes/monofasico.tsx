import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SimuladorTabs } from "@/components/simulator/SimuladorTabs";
import {
  Button,
  Field,
  MoneyInput,
  NumberInput,
  Notice,
  Select,
  TextInput,
} from "@/components/simulator/ui";
import { listCasosParaAluguel } from "@/lib/aluguel.functions";
import { withAuthRetry } from "@/lib/auth-retry";
import { salvarEstudoMonofasico } from "@/lib/monofasico.functions";
import {
  AVISO_MONOFASICO,
  FASES_MONOFASICO,
  PARCELA_DAS_ANEXOS,
  REGIMES,
  SEGMENTOS,
  calcularMonofasico,
  type RegimeMonofasico,
  type SegmentoMonofasico,
} from "@/lib/monofasico/calculo";
import { brl } from "@/lib/tax/calc";

const TITLE = "Recuperação de PIS/COFINS Monofásico";
const DESCRIPTION =
  "Estime quanto a sua empresa pode ter pago a maior de PIS/COFINS sobre produtos monofásicos nos últimos 60 meses — e quanto deixa de gastar por ano ao corrigir a segregação das receitas.";

export const Route = createFileRoute("/monofasico")({
  head: () => ({
    meta: [
      { title: `${TITLE} | Estimativa gratuita` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonofasicoPage,
});

const COLORS = {
  principal: "#1e3a5f",
  correcao: "#d946a0",
  economia: "#2bbfa4",
};

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

function MonofasicoPage() {
  const [segmento, setSegmento] = useState<SegmentoMonofasico>("outro");
  const [regime, setRegime] = useState<RegimeMonofasico>("simples");
  const [faturamento, setFaturamento] = useState(0);
  const [participacao, setParticipacao] = useState(0);
  const [aliquotaDas, setAliquotaDas] = useState(0);
  const [parcelaDas, setParcelaDas] = useState(15.5);
  const [meses, setMeses] = useState(60);
  const [selic, setSelic] = useState(10.5);
  const [honorario, setHonorario] = useState(20);

  const [titulo, setTitulo] = useState("");
  const [casos, setCasos] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [casoId, setCasoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregarCasos = useServerFn(listCasosParaAluguel);
  const salvar = useServerFn(salvarEstudoMonofasico);

  useEffect(() => {
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setCasos([]);
          return;
        }
        const res = await withAuthRetry(() => carregarCasos({}));
        setCasos(res.items);
      } catch {
        setCasos([]);
      }
    })();
  }, [carregarCasos]);

  const trocarSegmento = (id: SegmentoMonofasico) => {
    setSegmento(id);
    const preset = SEGMENTOS.find((s) => s.id === id);
    if (preset && preset.participacaoPct > 0) setParticipacao(preset.participacaoPct);
  };

  const resultado = useMemo(
    () =>
      calcularMonofasico({
        segmento,
        regime,
        faturamentoMensal: faturamento,
        participacaoMonofasicaPct: participacao,
        aliquotaEfetivaDasPct: aliquotaDas,
        parcelaPisCofinsPct: parcelaDas,
        mesesRetroativos: meses,
        selicAaPct: selic,
        honorarioExitoPct: honorario,
      }),
    [segmento, regime, faturamento, participacao, aliquotaDas, parcelaDas, meses, selic, honorario],
  );

  const pronto =
    faturamento > 0 &&
    participacao > 0 &&
    (regime !== "simples" || (aliquotaDas > 0 && parcelaDas > 0));

  const comparativo = [
    { nome: "Principal pago a maior", valor: resultado.principalPeriodo, cor: COLORS.principal },
    { nome: "Correção pela Selic", valor: resultado.correcaoSelic, cor: COLORS.correcao },
    { nome: "Economia nos próximos 12 meses", valor: resultado.economiaAnual, cor: COLORS.economia },
  ];

  const segmentoAtual = SEGMENTOS.find((s) => s.id === segmento);

  const handleSalvar = async () => {
    setAviso("");
    setSalvando(true);
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId: casoId || null,
            titulo: titulo.trim() || "Estudo de recuperação monofásica",
            segmento,
            regime,
            faturamentoMensal: faturamento,
            participacaoMonofasicaPct: participacao,
            aliquotaEfetivaDasPct: aliquotaDas,
            parcelaPisCofinsPct: parcelaDas,
            mesesRetroativos: meses,
            selicAaPct: selic,
            honorarioExitoPct: honorario,
          },
        }),
      );
      setAviso(casoId ? "Estudo salvo e vinculado ao Caso." : "Estudo salvo sem vínculo com Caso.");
    } catch {
      setAviso("Não foi possível salvar. Entre com a conta do escritório para guardar o estudo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <SimuladorTabs active="/monofasico" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            Recuperação de crédito tributário
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            PIS/COFINS monofásico: quanto você pagou a mais
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{DESCRIPTION}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <Field label="Segmento de atuação" hint={segmentoAtual?.exemplos ?? ""}>
              <Select
                value={segmento}
                onChange={(e) => trocarSegmento(e.target.value as SegmentoMonofasico)}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Regime tributário" hint={REGIMES.find((r) => r.id === regime)?.hint}>
              <Select
                value={regime}
                onChange={(e) => setRegime(e.target.value as RegimeMonofasico)}
              >
                {REGIMES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Faturamento bruto mensal médio"
              hint="Média dos últimos 12 meses de receita de vendas."
            >
              <MoneyInput value={faturamento} onChange={setFaturamento} />
            </Field>

            <Field
              label="Participação de produtos monofásicos na receita (%)"
              hint="Percentual estimado das vendas em produtos com PIS/COFINS pago pela indústria. O segmento sugere um valor médio — ajuste conforme o mix real."
            >
              <NumberInput value={participacao} onChange={setParticipacao} suffix="%" max={100} />
            </Field>

            {regime === "simples" ? (
              <>
                <Field
                  label="Alíquota efetiva média do DAS (%)"
                  hint="Percentual efetivo pago no DAS, disponível no PGDAS-D do período."
                >
                  <NumberInput value={aliquotaDas} onChange={setAliquotaDas} suffix="%" max={100} />
                </Field>

                <Field
                  label="Participação de PIS/COFINS dentro do DAS (%)"
                  hint="Proporção destinada a PIS e COFINS na repartição do anexo aplicável."
                >
                  <NumberInput value={parcelaDas} onChange={setParcelaDas} suffix="%" max={100} />
                  <span className="mt-2 flex flex-wrap gap-2">
                    {PARCELA_DAS_ANEXOS.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => setParcelaDas(a.valor)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          parcelaDas === a.valor
                            ? "border-navy bg-navy text-navy-foreground"
                            : "border-input bg-card text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </span>
                </Field>
              </>
            ) : null}

            <Field
              label="Período retroativo (meses)"
              hint="Prazo de prescrição: até 60 meses anteriores ao pedido."
            >
              <NumberInput value={meses} onChange={setMeses} suffix="meses" max={60} />
            </Field>

            <Field
              label="Correção do indébito — Selic (% ao ano)"
              hint="O crédito reconhecido é atualizado pela taxa Selic acumulada."
            >
              <NumberInput value={selic} onChange={setSelic} suffix="% a.a." />
            </Field>

            <Field
              label="Honorário de êxito (%)"
              hint="Percentual combinado sobre o valor efetivamente recuperado."
            >
              <NumberInput value={honorario} onChange={setHonorario} suffix="%" max={100} />
            </Field>

            <Notice>{AVISO_MONOFASICO}</Notice>
          </section>

          <section className="space-y-6">
            {pronto ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Kpi
                    label="Total estimado a recuperar"
                    value={brl(resultado.totalRecuperavel)}
                    detail={`Principal ${brl(resultado.principalPeriodo)} + Selic ${brl(resultado.correcaoSelic)}`}
                    tone="good"
                  />
                  <Kpi
                    label="Pago a maior por mês"
                    value={brl(resultado.pagoAMaiorMensal)}
                    detail={`Alíquota efetiva de ${resultado.premissas.aliquotaEfetivaPisCofinsPct.toFixed(2)}% sobre ${brl(resultado.receitaMonofasicaMensal)}`}
                    tone="bad"
                  />
                  <Kpi
                    label="Economia nos próximos 12 meses"
                    value={brl(resultado.economiaAnual)}
                    detail={`Líquido ao cliente no período retroativo: ${brl(resultado.liquidoCliente)}`}
                  />
                </div>

                <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Leitura do cenário</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {resultado.leitura}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ganho estimado no primeiro ano (recuperação líquida + economia recorrente):{" "}
                    <strong className="text-foreground">{brl(resultado.ganhoPrimeiroAno)}</strong>.
                    Honorário de êxito estimado: {brl(resultado.honorario)}.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Composição do valor em jogo
                  </p>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparativo}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(v: number) => brl(v)}
                          tick={{ fontSize: 11 }}
                          width={90}
                        />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Bar dataKey="valor" name="Valor" radius={[6, 6, 0, 0]}>
                          {comparativo.map((c) => (
                            <Cell key={c.nome} fill={c.cor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Distribuição por período retroativo
                  </p>
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">Período</th>
                        <th className="py-2 text-right">Meses</th>
                        <th className="py-2 text-right">Principal</th>
                        <th className="py-2 text-right">Correção</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {resultado.porAno.map((a) => (
                        <tr key={a.rotulo} className="border-t border-border">
                          <td className="py-2">{a.rotulo}</td>
                          <td className="py-2 text-right">{a.meses}</td>
                          <td className="py-2 text-right">{brl(a.principal)}</td>
                          <td className="py-2 text-right">{brl(a.correcao)}</td>
                          <td className="py-2 text-right font-semibold">{brl(a.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">Como o trabalho é feito</p>
                  <ol className="mt-3 space-y-3">
                    {FASES_MONOFASICO.map((f, i) => (
                      <li key={f.titulo} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-navy-foreground">
                          {i + 1}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {f.titulo}
                          </span>
                          <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                            {f.descricao}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Preencha os dados para ver a estimativa
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Informe o faturamento mensal, a participação de produtos monofásicos e, no Simples
                  Nacional, a alíquota efetiva do DAS. O valor recuperável e a economia futura
                  aparecem aqui.
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Vincular a um Caso</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Identificação do estudo">
                  <TextInput
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Drogaria Central — recuperação monofásica"
                  />
                </Field>
                <Field label="Caso">
                  <Select value={casoId} onChange={(e) => setCasoId(e.target.value)}>
                    <option value="">Sem vínculo</option>
                    {casos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.cnpj ? ` — ${c.cnpj}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleSalvar()} disabled={salvando || !pronto}>
                  {salvando ? "Salvando…" : "Salvar estudo"}
                </Button>
                <Link to="/meus-calculos" className="text-sm font-semibold text-navy underline">
                  Abrir Meus Cálculos
                </Link>
              </div>
              {aviso ? <Notice>{aviso}</Notice> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
