import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
import { salvarEstudoSaldos } from "@/lib/saldos.functions";
import {
  AVISO_SALDOS,
  FASES_MONETIZACAO,
  calcularSaldos,
} from "@/lib/saldos/calculo";
import { brl } from "@/lib/tax/calc";

const TITLE = "Monetização de Saldos Credores de ICMS e PIS/COFINS";
const DESCRIPTION =
  "Descubra quanto o seu crédito acumulado de ICMS realmente vale se você esperar as 240 parcelas previstas na Reforma Tributária — e quanto vale monetizá-lo agora.";

export const Route = createFileRoute("/saldos-credores")({
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
  component: SaldosPage,
});

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const COLORS = {
  nominal: "#1e3a5f",
  inercia: "#d946a0",
  cessao: "#2bbfa4",
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

function SaldosPage() {
  const [saldoIcms, setSaldoIcms] = useState(0);
  const [saldoPis, setSaldoPis] = useState(0);
  const [uf, setUf] = useState("SP");
  const [custoOportunidade, setCustoOportunidade] = useState(12);
  const [ipca, setIpca] = useState(4);
  const [desagio, setDesagio] = useState(30);
  const [mesesCbs, setMesesCbs] = useState(24);

  const [titulo, setTitulo] = useState("");
  const [casos, setCasos] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [casoId, setCasoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregarCasos = useServerFn(listCasosParaAluguel);
  const salvar = useServerFn(salvarEstudoSaldos);

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
      calcularSaldos({
        saldoIcms,
        saldoPisCofins: saldoPis,
        custoOportunidadeAaPct: custoOportunidade,
        ipcaAaPct: ipca,
        desagioCessaoPct: desagio,
        mesesCompensacaoCbs: mesesCbs,
      }),
    [saldoIcms, saldoPis, custoOportunidade, ipca, desagio, mesesCbs],
  );

  const pronto = saldoIcms > 0 || saldoPis > 0;

  const comparativo = [
    { nome: "Valor nominal", valor: resultado.saldoTotal, cor: COLORS.nominal },
    { nome: "Esperar (valor presente)", valor: resultado.totais.vplInercia, cor: COLORS.inercia },
    { nome: "Ação antecipada", valor: resultado.totais.caixaAcaoAtiva, cor: COLORS.cessao },
  ];

  // Curva anual acumulada do ICMS recebido em parcelas, a valor presente.
  const curva = useMemo(() => {
    const porAno = new Map<number, number>();
    for (const p of resultado.icms.parcelas) {
      porAno.set(p.ano, p.acumuladoPresente);
    }
    return [...porAno.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, acumulado]) => ({
        ano,
        acumulado,
        cessao: resultado.icms.caixaCessao,
      }));
  }, [resultado]);

  const handleSalvar = async () => {
    setAviso("");
    setSalvando(true);
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId: casoId || null,
            titulo: titulo.trim() || "Estudo de saldos credores",
            uf,
            saldoIcms,
            saldoPisCofins: saldoPis,
            custoOportunidadeAaPct: custoOportunidade,
            ipcaAaPct: ipca,
            desagioCessaoPct: desagio,
            mesesCompensacaoCbs: mesesCbs,
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
      <SimuladorTabs active="/saldos-credores" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            Saldos credores acumulados
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            O custo de esperar 20 anos pelo seu crédito
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{DESCRIPTION}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <Field
              label="Saldo credor de ICMS"
              hint="Saldo acumulado registrado na apuração/balanço da empresa."
            >
              <MoneyInput value={saldoIcms} onChange={setSaldoIcms} />
            </Field>

            <Field
              label="Saldo credor de PIS/COFINS"
              hint="Créditos federais acumulados e ainda não utilizados."
            >
              <MoneyInput value={saldoPis} onChange={setSaldoPis} />
            </Field>

            <Field label="Estado (UF)">
              <Select value={uf} onChange={(e) => setUf(e.target.value)}>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Custo de oportunidade do capital (% ao ano)"
              hint="Quanto o dinheiro renderia hoje em outra aplicação — Selic/CDI, custo do financiamento da empresa ou retorno exigido pelo sócio."
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

            <Field
              label="Correção das parcelas — IPCA (% ao ano)"
              hint="As parcelas de ressarcimento do ICMS são corrigidas pelo IPCA."
            >
              <NumberInput value={ipca} onChange={setIpca} suffix="% a.a." />
            </Field>

            <Field
              label="Deságio de mercado na cessão (%)"
              hint="Desconto praticado por quem compra o crédito. Na prática costuma variar entre 20% e 40%."
            >
              <NumberInput value={desagio} onChange={setDesagio} suffix="%" max={100} />
              <span className="mt-2 flex flex-wrap gap-2">
                {[20, 30, 40].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDesagio(v)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      desagio === v
                        ? "border-navy bg-navy text-navy-foreground"
                        : "border-input bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </span>
            </Field>

            <Field
              label="Prazo estimado para compensar o PIS/COFINS (meses)"
              hint="Tempo previsto até consumir o saldo federal com a CBS ou receber o ressarcimento."
            >
              <NumberInput value={mesesCbs} onChange={setMesesCbs} suffix="meses" />
            </Field>

            <Notice>{AVISO_SALDOS}</Notice>
          </section>

          <section className="space-y-6">
            {pronto ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Kpi
                    label="Saldo credor informado"
                    value={brl(resultado.saldoTotal)}
                    detail={`ICMS ${brl(resultado.icms.saldo)} · PIS/COFINS ${brl(resultado.pisCofins.saldo)}`}
                  />
                  <Kpi
                    label="Quanto vale se você esperar"
                    value={brl(resultado.totais.vplInercia)}
                    detail={`Perda pela inércia: ${brl(resultado.totais.perdaTotalInercia)}`}
                    tone="bad"
                  />
                  <Kpi
                    label="Caixa com ação antecipada"
                    value={brl(resultado.totais.caixaAcaoAtiva)}
                    detail={`Ganho real de ${brl(resultado.totais.ganhoAcaoAtiva)} frente à espera`}
                    tone={resultado.totais.ganhoAcaoAtiva > 0 ? "good" : "neutral"}
                  />
                </div>

                <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Leitura do cenário</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {resultado.recomendacao}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    O saldo de ICMS seria devolvido em {resultado.icms.parcelas.length} parcelas
                    mensais corrigidas, a partir de 2033. Deságio de equilíbrio:{" "}
                    {resultado.icms.desagioEquilibrioPct.toFixed(1)}% — acima disso, esperar passa a
                    valer mais.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Valor real do crédito em cada estratégia
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

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    ICMS: recebimento acumulado a valor presente x caixa imediato da cessão
                  </p>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={curva}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(v: number) => brl(v)}
                          tick={{ fontSize: 11 }}
                          width={90}
                        />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Area
                          type="monotone"
                          dataKey="acumulado"
                          name="Esperando as parcelas"
                          stroke={COLORS.inercia}
                          fill={COLORS.inercia}
                          fillOpacity={0.18}
                          strokeWidth={3}
                        />
                        <Area
                          type="monotone"
                          dataKey="cessao"
                          name="Caixa imediato na cessão"
                          stroke={COLORS.cessao}
                          fill={COLORS.cessao}
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">Resumo por tributo</p>
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">Tributo</th>
                        <th className="py-2 text-right">Saldo nominal</th>
                        <th className="py-2 text-right">Valor presente esperando</th>
                        <th className="py-2 text-right">Perda</th>
                        <th className="py-2 text-right">Caixa na cessão</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      <tr className="border-t border-border">
                        <td className="py-2">ICMS (240 parcelas)</td>
                        <td className="py-2 text-right">{brl(resultado.icms.saldo)}</td>
                        <td className="py-2 text-right">{brl(resultado.icms.vplInercia)}</td>
                        <td className="py-2 text-right">
                          {brl(resultado.icms.perdaInercia)} ({resultado.icms.perdaInerciaPct.toFixed(1)}%)
                        </td>
                        <td className="py-2 text-right">{brl(resultado.icms.caixaCessao)}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="py-2">
                          PIS/COFINS ({resultado.pisCofins.mesesCompensacao} meses)
                        </td>
                        <td className="py-2 text-right">{brl(resultado.pisCofins.saldo)}</td>
                        <td className="py-2 text-right">{brl(resultado.pisCofins.vplCompensacao)}</td>
                        <td className="py-2 text-right">{brl(resultado.pisCofins.perdaCompensacao)}</td>
                        <td className="py-2 text-right">{brl(resultado.pisCofins.caixaCessao)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Plano de ação recomendado
                  </p>
                  <ol className="mt-3 space-y-3">
                    {FASES_MONETIZACAO.map((f, i) => (
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
                  Informe os saldos credores para ver o resultado
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Preencha o saldo de ICMS e/ou de PIS/COFINS ao lado. O valor real do crédito, a
                  perda por esperar e o plano de ação aparecem aqui.
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
                    placeholder="Ex.: Créditos acumulados — planta Camaçari"
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
