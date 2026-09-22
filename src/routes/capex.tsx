import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { salvarEstudoCapex } from "@/lib/capex.functions";
import {
  ALIQUOTA_PLENA_PADRAO_PCT,
  ANOS_CAPEX,
  AVISO_CAPEX,
  ICMS_PADRAO_PCT,
  REGIME_CAPEX_LABEL,
  TIPO_ATIVO_LABEL,
  calcularCapex,
  type RegimeCapex,
  type TipoAtivo,
} from "@/lib/capex/calculo";
import { brl } from "@/lib/tax/calc";

const TITLE = "Planejamento de CAPEX e Ativo Imobilizado na Reforma Tributária";
const DESCRIPTION =
  "Compare o crédito imediato de IBS/CBS com a apropriação do ICMS em 1/48 avos e descubra a melhor janela para investir em ativo imobilizado.";

export const Route = createFileRoute("/capex")({
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
  component: CapexPage,
});

const COLORS = {
  imediato: "#2bbfa4",
  diluido: "#1e3a5f",
  vpl: "#d946a0",
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

function CapexPage() {
  const [valor, setValor] = useState(0);
  const [tipoAtivo, setTipoAtivo] = useState<TipoAtivo>("maquinas");
  const [regime, setRegime] = useState<RegimeCapex>("real");
  const [icms, setIcms] = useState(ICMS_PADRAO_PCT);
  const [ipi, setIpi] = useState(0);
  const [ciap, setCiap] = useState(100);
  const [custoOportunidade, setCustoOportunidade] = useState(12);
  const [ano, setAno] = useState(2027);
  const [aliquotaPlena, setAliquotaPlena] = useState(ALIQUOTA_PLENA_PADRAO_PCT);
  const [avancado, setAvancado] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [casos, setCasos] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [casoId, setCasoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregarCasos = useServerFn(listCasosParaAluguel);
  const salvar = useServerFn(salvarEstudoCapex);

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

  const resultado = useMemo(
    () =>
      calcularCapex({
        valorInvestimento: valor,
        tipoAtivo,
        regime,
        icmsPct: icms,
        ipiPct: ipi,
        fatorCiapPct: ciap,
        custoOportunidadeAaPct: custoOportunidade,
        ano,
        aliquotaPlenaPct: aliquotaPlena,
      }),
    [valor, tipoAtivo, regime, icms, ipi, ciap, custoOportunidade, ano, aliquotaPlena],
  );

  const pronto = valor > 0;
  const sel = resultado.anoSelecionado;

  const handleSalvar = async () => {
    setAviso("");
    setSalvando(true);
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId: casoId || null,
            titulo: titulo.trim() || "Estudo de CAPEX",
            tipoAtivo,
            regime,
            valorInvestimento: valor,
            icmsPct: icms,
            ipiPct: ipi,
            fatorCiapPct: ciap,
            custoOportunidadeAaPct: custoOportunidade,
            aliquotaPlenaPct: aliquotaPlena,
            ano,
          },
        }),
      );
      setAviso(
        casoId
          ? "Estudo salvo e vinculado ao Caso."
          : "Estudo salvo sem vínculo com Caso.",
      );
    } catch {
      setAviso("Não foi possível salvar. Entre com a conta do escritório para guardar o estudo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <SimuladorTabs active="/capex" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            CAPEX e ativo imobilizado
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Quando comprar o ativo: crédito imediato ou 1/48 avos
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{DESCRIPTION}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <Field label="Valor do investimento">
              <MoneyInput value={valor} onChange={setValor} />
            </Field>

            <Field label="Tipo de ativo">
              <Select
                value={tipoAtivo}
                onChange={(e) => setTipoAtivo(e.target.value as TipoAtivo)}
              >
                {(Object.keys(TIPO_ATIVO_LABEL) as TipoAtivo[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_ATIVO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Regime da empresa"
              hint="No Simples Nacional a aquisição não gera crédito de IBS/CBS nem de ICMS sobre o ativo."
            >
              <Select value={regime} onChange={(e) => setRegime(e.target.value as RegimeCapex)}>
                {(Object.keys(REGIME_CAPEX_LABEL) as RegimeCapex[]).map((r) => (
                  <option key={r} value={r}>
                    {REGIME_CAPEX_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Ano da aquisição">
              <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
                {ANOS_CAPEX.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Custo de oportunidade do capital (% ao ano)"
              hint="Quanto o dinheiro renderia em outra aplicação — geralmente a Selic/CDI, o custo do financiamento usado na compra ou a taxa interna exigida pelo sócio."
            >
              <NumberInput
                value={custoOportunidade}
                onChange={setCustoOportunidade}
                suffix="% a.a."
              />
              <span className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "Selic/CDI (~10,5%)", valor: 10.5 },
                  { label: "Financiamento (~12%)", valor: 12 },
                  { label: "Retorno do sócio (~15%)", valor: 15 },
                ].map((a) => (
                  <button
                    key={a.valor}
                    type="button"
                    onClick={() => setCustoOportunidade(a.valor)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      custoOportunidade === a.valor
                        ? "border-navy bg-navy text-navy-foreground"
                        : "border-input bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </span>
            </Field>

            <button
              type="button"
              onClick={() => setAvancado((v) => !v)}
              className="text-xs font-semibold text-navy underline"
            >
              {avancado ? "Ocultar premissas" : "Ajustar premissas fiscais"}
            </button>

            {avancado ? (
              <div className="space-y-3 rounded-md border border-border bg-secondary p-3">
                <Field label="ICMS destacado na aquisição (%)">
                  <NumberInput value={icms} onChange={setIcms} suffix="%" />
                </Field>
                <Field label="IPI destacado na aquisição (%)">
                  <NumberInput value={ipi} onChange={setIpi} suffix="%" />
                </Field>
                <Field
                  label="Fator CIAP — saídas tributadas (%)"
                  hint="Percentual das vendas tributadas sobre o total das vendas (Lei Kandir, art. 20). Se tudo o que a empresa vende paga ICMS, é 100%; se há isentas/exportação, é a proporção encontrada no livro de apuração ou com a contabilidade."
                >
                  <NumberInput value={ciap} onChange={setCiap} suffix="%" max={100} />
                  <span className="mt-2 flex flex-wrap gap-2">
                    {[
                      { label: "Integral (100%)", valor: 100 },
                      { label: "Misto (80%)", valor: 80 },
                      { label: "Maioria isenta (50%)", valor: 50 },
                    ].map((a) => (
                      <button
                        key={a.valor}
                        type="button"
                        onClick={() => setCiap(a.valor)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          ciap === a.valor
                            ? "border-navy bg-navy text-navy-foreground"
                            : "border-input bg-card text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </span>
                </Field>
                <Field label="Alíquota plena de IBS/CBS (%)">
                  <NumberInput value={aliquotaPlena} onChange={setAliquotaPlena} suffix="%" />
                </Field>
              </div>
            ) : null}

            <Notice>{AVISO_CAPEX}</Notice>
          </section>

          <section className="space-y-6">
            {pronto ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Kpi
                    label={`Crédito total em ${ano}`}
                    value={brl(sel.creditoTotal)}
                    detail={`Imediato ${brl(sel.creditoImediato)} · diluído ${brl(sel.creditoDiluido)}`}
                  />
                  <Kpi
                    label="Valor presente do crédito"
                    value={brl(sel.vpl)}
                    detail={`Perda pela diluição: ${brl(sel.perdaDiluicao)}`}
                    tone={sel.perdaDiluicao > 0 ? "bad" : "good"}
                  />
                  <Kpi
                    label="Melhor janela de compra"
                    value={String(resultado.melhorAno)}
                    detail={`Diferença de ${brl(resultado.ganhoVsPior)} para o pior ano analisado`}
                    tone={resultado.melhorAno === ano ? "good" : "neutral"}
                  />
                </div>

                <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Recomendação</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {resultado.recomendacao}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Crédito acumulado nos 48 meses — aquisição em {ano}
                  </p>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={resultado.fluxo}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(v: number) => brl(v)}
                          tick={{ fontSize: 11 }}
                          width={90}
                        />
                        <Tooltip
                          formatter={(v: number) => brl(v)}
                          labelFormatter={(m: number) => `Mês ${m}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="acumulado"
                          name="Crédito acumulado"
                          stroke={COLORS.imediato}
                          fill={COLORS.imediato}
                          fillOpacity={0.2}
                          strokeWidth={3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Crédito por ano de aquisição — imediato x diluído em 1/48
                  </p>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={resultado.anos}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(v: number) => brl(v)}
                          tick={{ fontSize: 11 }}
                          width={90}
                        />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Legend />
                        <Bar
                          dataKey="creditoImediato"
                          name="Crédito imediato (IBS/CBS, PIS/COFINS, IPI)"
                          stackId="c"
                          fill={COLORS.imediato}
                        />
                        <Bar
                          dataKey="creditoDiluido"
                          name="ICMS em 1/48 avos"
                          stackId="c"
                          fill={COLORS.diluido}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Comparativo por ano de aquisição
                  </p>
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">Ano</th>
                        <th className="py-2 text-right">Crédito imediato</th>
                        <th className="py-2 text-right">ICMS 1/48</th>
                        <th className="py-2 text-right">Crédito total</th>
                        <th className="py-2 text-right">Valor presente</th>
                        <th className="py-2 text-right">Custo líquido do ativo</th>
                        <th className="py-2 text-right">Meses p/ 90%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.anos.map((a) => (
                        <tr
                          key={a.ano}
                          className={`border-t border-border tabular-nums ${
                            a.ano === ano ? "bg-secondary font-semibold" : ""
                          }`}
                        >
                          <td className="py-2">{a.ano}</td>
                          <td className="py-2 text-right">{brl(a.creditoImediato)}</td>
                          <td className="py-2 text-right">{brl(a.creditoDiluido)}</td>
                          <td className="py-2 text-right">{brl(a.creditoTotal)}</td>
                          <td className="py-2 text-right">{brl(a.vpl)}</td>
                          <td className="py-2 text-right">{brl(a.custoLiquido)}</td>
                          <td className="py-2 text-right">{a.meses90Pct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Informe o valor do investimento para ver o resultado
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Preencha o valor pretendido no formulário ao lado. O crédito ano a ano, o fluxo
                  dos 48 meses e a melhor janela de compra aparecem aqui.
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
                    placeholder="Ex.: Linha de envase — planta 2"
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
                <Button onClick={() => void handleSalvar()} disabled={salvando || valor <= 0}>
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
