import { createFileRoute } from "@tanstack/react-router";
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
import { salvarContrato } from "@/lib/contratos.functions";
import {
  ALIQUOTA_PLENA_PADRAO_PCT,
  ANOS_DISPONIVEIS,
  CENARIO_LABEL,
  PAPEL_LABEL,
  PERFIL_CONTRATANTE_LABEL,
  PREMISSAS_PRESTADOR,
  REGIME_PRESTADOR_LABEL,
  calcularContrato,
  minutaClausula,
  minutaNotificacao,
  type CenarioId,
  type PapelContrato,
  type PerfilContratante,
  type RegimePrestador,
} from "@/lib/contratos/calculo";
import { brl } from "@/lib/tax/calc";

const TITLE = "Reequilíbrio de contratos de prestação continuada na Reforma Tributária";
const DESCRIPTION =
  "Calcule o preço necessário para reequilibrar contratos de serviços continuados sob o IBS/CBS, com três cenários de negociação, evolução até 2033 e minuta de cláusula.";

export const Route = createFileRoute("/contratos")({
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
  component: ContratosPage,
});

const COR = {
  prestador: "#2bbfa4",
  contratante: "#1e3a5f",
  preco: "#d946a0",
};

const SEMAFORO = {
  baixo: { label: "Impacto baixo", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  medio: { label: "Impacto médio", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  alto: { label: "Impacto alto", cls: "border-rose-200 bg-rose-50 text-rose-800" },
} as const;

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-xl border border-border bg-secondary p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </article>
  );
}

function CopyBlock({ titulo, texto }: { titulo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(texto);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? "Copiado" : "Copiar texto"}
        </Button>
      </div>
      <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
        {texto}
      </pre>
    </section>
  );
}

function ContratosPage() {
  const [titulo, setTitulo] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [papel, setPapel] = useState<PapelContrato>("prestador");
  const [regime, setRegime] = useState<RegimePrestador>("presumido");
  const [perfil, setPerfil] = useState<PerfilContratante>("regular");
  const [preco, setPreco] = useState(0);
  const [custoDireto, setCustoDireto] = useState(50);
  const [creditoInsumos, setCreditoInsumos] = useState(0);
  const [aliquotaPlena, setAliquotaPlena] = useState(ALIQUOTA_PLENA_PADRAO_PCT);
  const [reducao, setReducao] = useState(0);
  const [ano, setAno] = useState(2033);
  const [cenario, setCenario] = useState<CenarioId>("equilibrio");
  const [avancado, setAvancado] = useState(false);

  const [casos, setCasos] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [casoId, setCasoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregarCasos = useServerFn(listCasosParaAluguel);
  const salvar = useServerFn(salvarContrato);

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
      calcularContrato({
        precoMensalAtual: preco,
        regimePrestador: regime,
        perfilContratante: perfil,
        custoDiretoPct: custoDireto,
        creditoInsumosPct: creditoInsumos,
        ano,
        cenario,
        aliquotaPlenaPct: aliquotaPlena,
        reducaoPct: reducao,
      }),
    [preco, regime, perfil, custoDireto, creditoInsumos, ano, cenario, aliquotaPlena, reducao],
  );

  const pronto = preco > 0;
  const escolhido = resultado.cenarios.find((c) => c.id === cenario) ?? resultado.cenarios[0]!;
  const semaforo = SEMAFORO[resultado.semaforo];

  const handleSalvar = async () => {
    setAviso("");
    setSalvando(true);
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId: casoId || null,
            titulo: titulo.trim() || "Contrato de prestação continuada",
            contraparte: contraparte.trim() || null,
            papel,
            regimePrestador: regime,
            perfilContratante: perfil,
            precoMensalAtual: preco,
            custoDiretoPct: custoDireto,
            creditoInsumosPct: creditoInsumos,
            aliquotaPlenaPct: aliquotaPlena,
            reducaoPct: reducao,
            ano,
            cenario,
          },
        }),
      );
      setAviso(
        casoId ? "Contrato salvo e vinculado ao Caso." : "Contrato salvo sem vínculo com Caso.",
      );
    } catch {
      setAviso("Não foi possível salvar. Entre com a conta do escritório para guardar o contrato.");
    } finally {
      setSalvando(false);
    }
  };

  const dadosEvolucao = resultado.evolucao.map((e) => ({
    ano: String(e.ano),
    Preço: e.precoSugerido,
    "Margem do prestador": e.margemPrestador,
    "Custo líquido do contratante": e.custoLiquidoContratante,
  }));

  const dadosCenarios = resultado.cenarios.map((c) => ({
    nome: c.label.split(" — ")[0] ?? c.id,
    "Preço sugerido": c.precoSugerido,
    "Custo líquido do contratante": c.detalhe.custoLiquidoContratante,
    "Margem do prestador": c.detalhe.margemPrestador,
  }));

  return (
    <main className="min-h-screen bg-background">
      <SimuladorTabs active="/contratos" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            Gestão de contratos e reequilíbrio econômico
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Quanto o contrato precisa ser reajustado para continuar equilibrado
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{DESCRIPTION}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <Field label="Identificação do contrato">
              <TextInput
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Suporte de TI — Alfa Ltda"
              />
            </Field>

            <Field label="Contraparte">
              <TextInput
                value={contraparte}
                onChange={(e) => setContraparte(e.target.value)}
                placeholder="Nome da outra parte"
              />
            </Field>

            <Field label="Seu papel no contrato">
              <Select value={papel} onChange={(e) => setPapel(e.target.value as PapelContrato)}>
                {(Object.keys(PAPEL_LABEL) as PapelContrato[]).map((p) => (
                  <option key={p} value={p}>
                    {PAPEL_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Preço mensal do contrato hoje">
              <MoneyInput value={preco} onChange={setPreco} />
            </Field>

            <Field
              label="Regime do prestador"
              hint="Define quais tributos de hoje somem com o IBS/CBS e quais continuam."
            >
              <Select
                value={regime}
                onChange={(e) => setRegime(e.target.value as RegimePrestador)}
              >
                {(Object.keys(REGIME_PRESTADOR_LABEL) as RegimePrestador[]).map((r) => (
                  <option key={r} value={r}>
                    {REGIME_PRESTADOR_LABEL[r]}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {PREMISSAS_PRESTADOR[regime].nota}
              </p>
            </Field>

            <Field
              label="Perfil do contratante"
              hint="Só quem está em regime regular aproveita o IBS/CBS destacado como crédito."
            >
              <Select
                value={perfil}
                onChange={(e) => setPerfil(e.target.value as PerfilContratante)}
              >
                {(Object.keys(PERFIL_CONTRATANTE_LABEL) as PerfilContratante[]).map((p) => (
                  <option key={p} value={p}>
                    {PERFIL_CONTRATANTE_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Custo direto do prestador (% do preço)"
              hint="Folha, subcontratação e materiais aplicados no contrato."
            >
              <NumberInput value={custoDireto} onChange={setCustoDireto} suffix="%" max={100} />
            </Field>

            <Field label="Cenário de negociação">
              <Select value={cenario} onChange={(e) => setCenario(e.target.value as CenarioId)}>
                {(Object.keys(CENARIO_LABEL) as CenarioId[]).map((c) => (
                  <option key={c} value={c}>
                    {CENARIO_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Ano de referência">
              <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
                {ANOS_DISPONIVEIS.map((a) => (
                  <option key={a} value={a}>
                    {a}
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
                <Field label="Alíquota plena de IBS/CBS (%)">
                  <NumberInput value={aliquotaPlena} onChange={setAliquotaPlena} suffix="%" />
                </Field>
                <Field
                  label="Redução setorial (%)"
                  hint="Reduções previstas para certos serviços (saúde, educação, profissões regulamentadas)."
                >
                  <NumberInput value={reducao} onChange={setReducao} suffix="%" max={100} />
                </Field>
                <Field
                  label="Custos diretos que geram crédito (%)"
                  hint="Parcela dos custos diretos com IBS/CBS destacado — folha de pagamento não gera crédito."
                >
                  <NumberInput
                    value={creditoInsumos}
                    onChange={setCreditoInsumos}
                    suffix="%"
                    max={100}
                  />
                </Field>
              </div>
            ) : null}

            <Notice>{resultado.avisos[0]}</Notice>
          </section>

          <section className="space-y-6">
            {!pronto ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Informe o preço mensal do contrato para ver os cenários de reequilíbrio.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Kpi
                    label={`Preço sugerido em ${ano}`}
                    value={brl(escolhido.precoSugerido)}
                    detail={`${escolhido.variacaoPrecoPct.toFixed(2)}% frente ao contrato de hoje`}
                  />
                  <Kpi
                    label="Preço hoje"
                    value={brl(resultado.atual.precoContrato)}
                    detail={`Margem do prestador: ${brl(resultado.atual.margemPrestador)}`}
                  />
                  <Kpi
                    label="Alíquota efetiva no ano"
                    value={`${resultado.aliquotaEfetivaPct.toFixed(2)}%`}
                    detail={`Rampa de transição: ${(resultado.fracao * 100).toFixed(1)}% da alíquota plena`}
                  />
                  <Kpi
                    label="Absorvido por crédito"
                    value={brl(escolhido.aumentoAbsorvidoPorCredito)}
                    detail="Parte do aumento que volta ao contratante como crédito"
                  />
                </div>

                <div className={`rounded-xl border p-4 text-sm font-semibold ${semaforo.cls}`}>
                  {semaforo.label} — variação de {escolhido.variacaoPrecoPct.toFixed(2)}% no preço
                  do contrato até {ano}.
                </div>

                <section className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-bold text-foreground">Cenários de negociação</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {resultado.cenarios.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCenario(c.id)}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          c.id === cenario
                            ? "border-navy bg-navy text-navy-foreground"
                            : "border-border bg-secondary hover:border-navy/40"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                          {c.label}
                        </p>
                        <p className="mt-2 text-xl font-bold tabular-nums">
                          {brl(c.precoSugerido)}
                        </p>
                        <p className="mt-1 text-xs opacity-80">
                          {c.variacaoPrecoPct.toFixed(2)}% no preço
                        </p>
                        <dl className="mt-3 space-y-1 text-xs opacity-90">
                          <div className="flex justify-between gap-2">
                            <dt>Margem do prestador</dt>
                            <dd className="tabular-nums">{brl(c.detalhe.margemPrestador)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Custo líquido do contratante</dt>
                            <dd className="tabular-nums">
                              {brl(c.detalhe.custoLiquidoContratante)}
                            </dd>
                          </div>
                        </dl>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-bold text-foreground">
                    Comparação entre os cenários em {ano}
                  </h2>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosCenarios}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="nome" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v: number) => brl(v)} width={90} />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Legend />
                        <Bar dataKey="Preço sugerido" fill={COR.preco} radius={[4, 4, 0, 0]} />
                        <Bar
                          dataKey="Custo líquido do contratante"
                          fill={COR.contratante}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="Margem do prestador"
                          fill={COR.prestador}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-bold text-foreground">
                    Evolução até 2033 — {CENARIO_LABEL[cenario]}
                  </h2>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dadosEvolucao}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ano" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v: number) => brl(v)} width={90} />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="Preço" stroke={COR.preco} strokeWidth={2} />
                        <Line
                          type="monotone"
                          dataKey="Margem do prestador"
                          stroke={COR.prestador}
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="Custo líquido do contratante"
                          stroke={COR.contratante}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3">Ano</th>
                          <th className="py-2 pr-3 text-right">Preço sugerido</th>
                          <th className="py-2 pr-3 text-right">Variação</th>
                          <th className="py-2 pr-3 text-right">Margem do prestador</th>
                          <th className="py-2 text-right">Custo do contratante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.evolucao.map((e) => (
                          <tr
                            key={e.ano}
                            className={`border-b border-border/60 ${e.ano === ano ? "bg-secondary font-semibold" : ""}`}
                          >
                            <td className="py-2 pr-3">{e.ano}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {brl(e.precoSugerido)}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {e.variacaoPct.toFixed(2)}%
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {brl(e.margemPrestador)}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {brl(e.custoLiquidoContratante)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <CopyBlock titulo="Minuta de cláusula de reequilíbrio" texto={minutaClausula(resultado, titulo)} />
                <CopyBlock
                  titulo="Notificação para abrir a renegociação"
                  texto={minutaNotificacao(resultado, titulo, contraparte)}
                />

                <section className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-bold text-foreground">Guardar este contrato</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Disponível para a equipe do escritório: o contrato entra na carteira do painel
                    de gestão e pode ser vinculado a um Caso.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Vincular a um Caso (opcional)">
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
                    <div className="flex items-end">
                      <Button onClick={() => void handleSalvar()} disabled={salvando || !pronto}>
                        {salvando ? "Salvando..." : "Salvar contrato"}
                      </Button>
                    </div>
                  </div>
                  {aviso ? <p className="mt-3 text-xs text-muted-foreground">{aviso}</p> : null}
                </section>

                <ul className="space-y-2 text-xs text-muted-foreground">
                  {resultado.avisos.map((a) => (
                    <li key={a}>• {a}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
