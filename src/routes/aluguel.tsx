import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button, Field, MoneyInput, NumberInput, Notice, Select, TextInput } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { listCasosParaAluguel, salvarContratoAluguel } from "@/lib/aluguel.functions";
import {
  ALIQUOTA_PLENA_PADRAO_PCT,
  ANOS_DISPONIVEIS,
  AVISO_CONTRATO_ANTIGO,
  AVISO_ESTIMATIVA,
  CRITERIO_LABEL,
  PREMISSAS_PADRAO,
  REDUTOR_IMOVEL_PADRAO_PCT,
  REGIME_LOCADOR_LABEL,
  calcularContrato,
  clausulaSugerida,
  type CriterioRepactuacao,
  type RegimeLocador,
} from "@/lib/aluguel/calculo";
import { brl } from "@/lib/tax/calc";

const TITLE = "Simulador de Aluguéis e Contratos na Reforma Tributária";
const DESCRIPTION =
  "Compare o aluguel de hoje com o cenário pós IBS/CBS e descubra o valor de repactuação que preserva a receita do locador ou o custo do locatário.";

export const Route = createFileRoute("/aluguel")({
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
  component: AluguelPage,
});

const pct = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const COLORS = {
  atual: "#1e3a5f",
  sem: "#d946a0",
  repac: "#2bbfa4",
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

function AluguelPage() {
  const [aluguel, setAluguel] = useState(10000);
  const [regime, setRegime] = useState<RegimeLocador>("presumido");
  const [aproveitamento, setAproveitamento] = useState(100);
  const [ano, setAno] = useState(2033);
  const [criterio, setCriterio] = useState<CriterioRepactuacao>("liquido_locador");
  const [aliquotaPlena, setAliquotaPlena] = useState(ALIQUOTA_PLENA_PADRAO_PCT);
  const [redutor, setRedutor] = useState(REDUTOR_IMOVEL_PADRAO_PCT);
  const [substituida, setSubstituida] = useState(PREMISSAS_PADRAO.presumido.substituidaPct);
  const [mantida, setMantida] = useState(PREMISSAS_PADRAO.presumido.mantidaPct);
  const [avancado, setAvancado] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [papel, setPapel] = useState<"locador" | "locatario">("locador");
  const [casos, setCasos] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [casoId, setCasoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregarCasos = useServerFn(listCasosParaAluguel);
  const salvar = useServerFn(salvarContratoAluguel);

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

  const trocarRegime = (novo: RegimeLocador) => {
    setRegime(novo);
    setSubstituida(PREMISSAS_PADRAO[novo].substituidaPct);
    setMantida(PREMISSAS_PADRAO[novo].mantidaPct);
  };

  const resultado = useMemo(
    () =>
      calcularContrato({
        aluguelMensal: aluguel,
        regimeLocador: regime,
        aproveitamentoCreditoPct: aproveitamento,
        ano,
        criterio,
        aliquotaPlenaPct: aliquotaPlena,
        redutorPct: redutor,
        substituidaPct: substituida,
        mantidaPct: mantida,
      }),
    [aluguel, regime, aproveitamento, ano, criterio, aliquotaPlena, redutor, substituida, mantida],
  );

  const [atual, semRepac, repactuado] = resultado.cenarios as [
    (typeof resultado.cenarios)[number],
    (typeof resultado.cenarios)[number],
    (typeof resultado.cenarios)[number],
  ];

  const dadosBarras = [
    {
      nome: "Receita líquida do locador",
      Hoje: atual.liquidoLocador,
      [`${ano} sem repactuar`]: semRepac.liquidoLocador,
      [`${ano} repactuado`]: repactuado.liquidoLocador,
    },
    {
      nome: "Custo efetivo do locatário",
      Hoje: atual.custoEfetivoLocatario,
      [`${ano} sem repactuar`]: semRepac.custoEfetivoLocatario,
      [`${ano} repactuado`]: repactuado.custoEfetivoLocatario,
    },
  ];

  const handleSalvar = async () => {
    setAviso("");
    setSalvando(true);
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId: casoId || null,
            titulo: titulo.trim() || "Contrato de locação",
            contraparte: contraparte.trim() || null,
            papel,
            regimeLocador: regime,
            aluguelMensal: aluguel,
            substituidaPct: substituida,
            mantidaPct: mantida,
            aproveitamentoCreditoPct: aproveitamento,
            aliquotaPlenaPct: aliquotaPlena,
            redutorPct: redutor,
            ano,
            criterio,
          },
        }),
      );
      setAviso(
        casoId
          ? "Contrato salvo e vinculado ao Caso. Ele já entra no Parecer Padrão."
          : "Contrato salvo sem vínculo com Caso.",
      );
    } catch {
      setAviso("Não foi possível salvar. Entre com a conta do escritório para vincular a um Caso.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          Contratos e aluguéis
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
          Aluguel na Reforma Tributária: quanto muda e quanto repactuar
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{DESCRIPTION}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <Field label="Aluguel mensal de hoje">
            <MoneyInput value={aluguel} onChange={setAluguel} />
          </Field>

          <Field label="Regime do locador" hint={PREMISSAS_PADRAO[regime].nota}>
            <Select value={regime} onChange={(e) => trocarRegime(e.target.value as RegimeLocador)}>
              {(Object.keys(REGIME_LOCADOR_LABEL) as RegimeLocador[]).map((r) => (
                <option key={r} value={r}>
                  {REGIME_LOCADOR_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Aproveitamento do crédito pelo locatário (%)"
            hint="100% para locatário do regime regular; 0% para consumidor final, Simples ou pessoa física."
          >
            <NumberInput value={aproveitamento} onChange={setAproveitamento} suffix="%" max={100} />
          </Field>

          <Field label="Ano da simulação">
            <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
              {ANOS_DISPONIVEIS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Critério de repactuação">
            <Select
              value={criterio}
              onChange={(e) => setCriterio(e.target.value as CriterioRepactuacao)}
            >
              {(Object.keys(CRITERIO_LABEL) as CriterioRepactuacao[]).map((c) => (
                <option key={c} value={c}>
                  {CRITERIO_LABEL[c]}
                </option>
              ))}
            </Select>
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
              <Field label="Alíquota plena de referência (%)">
                <NumberInput value={aliquotaPlena} onChange={setAliquotaPlena} suffix="%" />
              </Field>
              <Field label="Redutor da locação de imóvel (%)">
                <NumberInput value={redutor} onChange={setRedutor} suffix="%" />
              </Field>
              <Field label="Tributos de hoje substituídos pelo IBS/CBS (%)">
                <NumberInput value={substituida} onChange={setSubstituida} suffix="%" />
              </Field>
              <Field label="Tributos de hoje que permanecem (%)">
                <NumberInput value={mantida} onChange={setMantida} suffix="%" />
              </Field>
            </div>
          ) : null}

          <Notice>{AVISO_ESTIMATIVA}</Notice>
          <Notice tone="warning">{AVISO_CONTRATO_ANTIGO}</Notice>
        </section>

        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi
              label={`Alíquota efetiva em ${ano}`}
              value={`${resultado.aliquotaEfetivaPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
              detail={`Plena ${aliquotaPlena}% com redutor de ${redutor}% e rampa do ano.`}
            />
            <Kpi
              label="Sem repactuar — líquido do locador"
              value={brl(semRepac.liquidoLocador)}
              detail={`${pct(resultado.semRepactuacao.variacaoLiquidoPct)} frente a hoje`}
              tone={resultado.semRepactuacao.variacaoLiquidoPct < 0 ? "bad" : "good"}
            />
            <Kpi
              label="Aluguel sugerido na repactuação"
              value={brl(resultado.repactuacao.aluguelSugerido)}
              detail={`${pct(resultado.repactuacao.variacaoAluguelPct)} sobre o valor vigente`}
              tone={resultado.repactuacao.variacaoAluguelPct > 0 ? "bad" : "good"}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Locador e locatário lado a lado</p>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosBarras}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => brl(v)} tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                  <Bar dataKey="Hoje" fill={COLORS.atual} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`${ano} sem repactuar`} fill={COLORS.sem} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`${ano} repactuado`} fill={COLORS.repac} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">
              Evolução do aluguel sugerido — 2026 a 2033
            </p>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resultado.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => brl(v)} tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Line
                    type="monotone"
                    dataKey="aluguelSugerido"
                    name="Aluguel sugerido"
                    stroke={COLORS.repac}
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="custoLocatario"
                    name="Custo do locatário"
                    stroke={COLORS.sem}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Comparativo dos três cenários</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Cenário</th>
                  <th className="py-2 text-right">Valor do contrato</th>
                  <th className="py-2 text-right">IBS/CBS</th>
                  <th className="py-2 text-right">Tributos mantidos</th>
                  <th className="py-2 text-right">Líquido do locador</th>
                  <th className="py-2 text-right">Crédito do locatário</th>
                  <th className="py-2 text-right">Custo do locatário</th>
                </tr>
              </thead>
              <tbody>
                {resultado.cenarios.map((c) => (
                  <tr key={c.id} className="border-t border-border tabular-nums">
                    <td className="py-2 font-medium">{c.label}</td>
                    <td className="py-2 text-right">{brl(c.valorContrato)}</td>
                    <td className="py-2 text-right">{brl(c.ibsCbs)}</td>
                    <td className="py-2 text-right">{brl(c.tributosMantidos)}</td>
                    <td className="py-2 text-right">{brl(c.liquidoLocador)}</td>
                    <td className="py-2 text-right">{brl(c.creditoLocatario)}</td>
                    <td className="py-2 text-right">{brl(c.custoEfetivoLocatario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
            <p className="text-sm font-semibold text-foreground">Cláusula sugerida para negociação</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {clausulaSugerida(resultado)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Rascunho de apoio — a minuta final depende da análise jurídica do contrato.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Vincular a um Caso</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Identificação do contrato">
                <TextInput
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Loja 3 — Shopping Centro"
                />
              </Field>
              <Field label="Contraparte">
                <TextInput
                  value={contraparte}
                  onChange={(e) => setContraparte(e.target.value)}
                  placeholder="Nome do locador ou locatário"
                />
              </Field>
              <Field label="Papel do cliente no contrato">
                <Select
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as "locador" | "locatario")}
                >
                  <option value="locador">Cliente é o locador</option>
                  <option value="locatario">Cliente é o locatário</option>
                </Select>
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
              <Button onClick={() => void handleSalvar()} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar contrato"}
              </Button>
              <Link to="/meus-calculos" className="text-sm font-semibold text-navy underline">
                Abrir Meus Cálculos
              </Link>
            </div>
            {aviso ? <Notice>{aviso}</Notice> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
