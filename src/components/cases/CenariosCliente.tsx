/**
 * Comparação visual de cenários de preço e margem para um cliente:
 * absorver o IBS/CBS, repassar integralmente, preservar o custo do cliente
 * ou dividir o impacto, ano a ano. Usa o motor de reequilíbrio de contratos
 * (transição gradual 2026–2033).
 *
 * Cada cartão mostra, lado a lado, quanto o PREÇO DE FACE varia e quanto o
 * CUSTO LÍQUIDO DO CLIENTE (preço menos o crédito de IBS/CBS que ele
 * recupera) varia — essa é a diferença que o cliente de fato vai questionar,
 * já que o valor da nota e o custo real dele podem andar em direções
 * diferentes nesses cenários.
 */
import { useMemo, useState } from "react";
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

import {
  ANOS_DISPONIVEIS,
  calcularContrato,
  type ContratoInput,
  type RegimePrestador,
} from "@/lib/contratos/calculo";
import { brl } from "@/lib/tax/calc";

const pct = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const compact = (v: number) =>
  v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const pctVar = (novo: number, base: number) => (base > 0 ? ((novo - base) / base) * 100 : 0);

/** Converte o regime atual do Caso (rótulo humano, ex. "Lucro Real") para o
 * código que o motor de contratos espera. Regimes sem equivalente direto
 * (MEI, Pessoa Física) caem no Presumido, igual ao padrão anterior. */
function regimePrestadorDoCaso(regimeAtual: string | null | undefined): RegimePrestador {
  if (!regimeAtual) return "presumido";
  const r = regimeAtual.toLowerCase();
  if (r.includes("real")) return "real";
  if (r.includes("simples")) return "simples";
  return "presumido";
}

/** Valor + variação percentual colorida (verde quando é bom pro prestador,
 * vermelho quando é ruim; "bom" é sempre definido por quem recebe o cartão). */
function Metrica({
  rotulo,
  valor,
  valorPct,
  boaSeSobe,
}: {
  rotulo: string;
  valor: string;
  valorPct: number;
  boaSeSobe: boolean;
}) {
  const neutro = Math.abs(valorPct) < 0.05;
  const boa = neutro ? null : boaSeSobe ? valorPct > 0 : valorPct < 0;
  const cor = neutro
    ? "text-muted-foreground"
    : boa
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-destructive";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="break-words font-presentation-display text-sm text-foreground">{valor}</p>
      <p className={`text-[11px] font-medium ${cor}`}>{pct(valorPct)} vs. hoje</p>
    </div>
  );
}

export function CenariosCliente({
  faturamentoTotal,
  meses,
  regimeCliente,
  regimeAtualCaso,
}: {
  faturamentoTotal: number;
  meses: number;
  regimeCliente: string | null | undefined;
  /** Regime tributário atual do Caso (sec1.regimeAtual), para pré-selecionar
   * o regime do prestador — evita começar sempre em "Presumido" por padrão
   * mesmo quando o Caso é de outro regime. */
  regimeAtualCaso?: string | null | undefined;
}) {
  const [regime, setRegime] = useState<RegimePrestador>(() => regimePrestadorDoCaso(regimeAtualCaso));
  const [custoPct, setCustoPct] = useState(40);
  const [ano, setAno] = useState(2027);
  const precoMensal = faturamentoTotal / Math.max(1, meses);
  const perfil = regimeCliente === "simples" ? "simples" : "regular";

  const base: Omit<ContratoInput, "ano"> = {
    precoMensalAtual: precoMensal,
    regimePrestador: regime,
    perfilContratante: perfil,
    custoDiretoPct: custoPct,
    creditoInsumosPct: 50,
    cenario: "margem_prestador",
  };

  const serie = useMemo(
    () =>
      ANOS_DISPONIVEIS.map((a) => {
        const r = calcularContrato({ ...base, ano: a });
        const rep = r.cenarios.find((c) => c.id === "margem_prestador")!;
        const eq = r.cenarios.find((c) => c.id === "equilibrio")!;
        return {
          ano: String(a),
          r,
          precoRepasse: rep.precoSugerido,
          precoEquilibrio: eq.precoSugerido,
          margemAtual: r.atual.margemPrestador,
          margemAbsorve: r.semReequilibrio.margemPrestador,
          margemEquilibrio: eq.detalhe.margemPrestador,
          credito: rep.detalhe.creditoContratante,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [precoMensal, regime, perfil, custoPct],
  );

  const sel = serie.find((s) => s.ano === String(ano)) ?? serie[0]!;
  const r = sel.r;
  const rep = r.cenarios.find((c) => c.id === "margem_prestador")!; // repassar a economia (A)
  const custo = r.cenarios.find((c) => c.id === "custo_contratante")!; // cliente paga o mesmo, líquido (B)
  const eq = r.cenarios.find((c) => c.id === "equilibrio")!; // dividir a diferença (C) = média de A e B
  const quedaMargem =
    r.atual.margemPrestador > 0
      ? ((r.semReequilibrio.margemPrestador - r.atual.margemPrestador) / r.atual.margemPrestador) * 100
      : 0;

  const precoAtual = r.atual.precoContrato;
  const precoRepasseTotal = rep.precoSugerido;
  // Em anos iniciais da transição a carga efetiva do IBS/CBS pode ser MENOR
  // que a dos tributos substituídos (comum no Lucro Real, onde PIS/COFINS
  // não cumulativos + ISS somam mais que a fração do IBS/CBS ainda em
  // rampa) — nesse caso o preço de repasse total cai, não sobe, e vale
  // avisar isso antes dos cartões pra não ler como se fosse sempre alta.
  const favoravel = precoRepasseTotal < precoAtual - 0.5;

  const diferencaManter = r.semReequilibrio.margemPrestador - r.atual.margemPrestador;
  const custoLiquidoManter = r.semReequilibrio.custoLiquidoContratante;
  const custoLiquidoManterVarPct = pctVar(custoLiquidoManter, r.atual.custoLiquidoContratante);

  const cards = [
    {
      t: "Manter o preço",
      sub: "Você não altera o valor cobrado hoje.",
      paraQueServe: "Indicado quando o cliente não pediu revisão de preço.",
      precoFace: r.semReequilibrio.precoContrato,
      precoFaceVarPct: 0,
      custoLiquido: custoLiquidoManter,
      custoLiquidoVarPct: custoLiquidoManterVarPct,
      margemNova: r.semReequilibrio.margemPrestador,
      margemVarPct: quedaMargem,
      texto:
        diferencaManter >= 0
          ? `Como o imposto ficou mais leve, a diferença de ${brl(Math.abs(diferencaManter))}/mês vira margem extra.`
          : `Como o imposto ficou mais pesado, a diferença de ${brl(Math.abs(diferencaManter))}/mês sai da sua margem.`,
      cls: diferencaManter >= 0 ? "border-border" : "border-destructive/40",
    },
    {
      t: "Repassar a economia",
      sub: "Preço muda o suficiente para sua margem voltar a ser igual à de hoje.",
      paraQueServe: "É o preço de neutralidade: abaixo dele, sua margem fica menor que a de hoje.",
      precoFace: rep.precoSugerido,
      precoFaceVarPct: rep.variacaoPrecoPct,
      custoLiquido: rep.detalhe.custoLiquidoContratante,
      custoLiquidoVarPct: rep.variacaoCustoContratantePct,
      margemNova: rep.detalhe.margemPrestador,
      margemVarPct: rep.variacaoMargemPct,
      texto:
        perfil === "simples"
          ? "Cliente do Simples não aproveita crédito do ajuste — ele sente o reajuste quase por inteiro."
          : `Você ${rep.variacaoPrecoPct < 0 ? "reduz" : "aumenta"} o preço em ${pct(Math.abs(rep.variacaoPrecoPct))} para devolver a diferença tributária ao cliente, e sua margem continua igual à de hoje. Dele volta ${brl(rep.detalhe.creditoContratante)} em crédito de IBS/CBS.`,
      cls: "border-primary/40",
    },
    {
      t: "Cliente paga o mesmo, líquido",
      sub: "O que ele paga líquido de crédito não muda.",
      paraQueServe: "Exige explicar o crédito ao cliente, porque o valor da nota muda mesmo com o custo líquido igual.",
      precoFace: custo.precoSugerido,
      precoFaceVarPct: custo.variacaoPrecoPct,
      custoLiquido: custo.detalhe.custoLiquidoContratante,
      custoLiquidoVarPct: custo.variacaoCustoContratantePct,
      margemNova: custo.detalhe.margemPrestador,
      margemVarPct: custo.variacaoMargemPct,
      texto:
        perfil === "simples"
          ? "Cliente do Simples não toma crédito — o preço precisaria ficar igual ao de hoje para o custo dele não mudar."
          : `O preço ${custo.variacaoPrecoPct < 0 ? "cai" : "sobe"} ${pct(Math.abs(custo.variacaoPrecoPct))}, mas o cliente recupera o IBS/CBS como crédito, então o custo real dele não muda. Sua margem ${custo.variacaoMargemPct < 0 ? "cai" : "sobe"} ${pct(Math.abs(custo.variacaoMargemPct))}.`,
      cls: "border-border",
    },
    {
      t: "Dividir a diferença",
      sub: "Ponto intermediário entre repassar a economia e preservar o custo do cliente.",
      paraQueServe: "Útil como proposta de partida em uma negociação.",
      precoFace: eq.precoSugerido,
      precoFaceVarPct: eq.variacaoPrecoPct,
      custoLiquido: eq.detalhe.custoLiquidoContratante,
      custoLiquidoVarPct: eq.variacaoCustoContratantePct,
      margemNova: eq.detalhe.margemPrestador,
      margemVarPct: eq.variacaoMargemPct,
      texto: `O preço ${eq.variacaoPrecoPct < 0 ? "cai" : "sobe"} ${pct(Math.abs(eq.variacaoPrecoPct))} e o custo líquido do cliente ${eq.variacaoCustoContratantePct < 0 ? "cai" : "sobe"} ${pct(Math.abs(eq.variacaoCustoContratantePct))}.`,
      cls: "border-border",
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Impacto do IBS/CBS no preço e na margem
          </p>
          <p className="text-xs text-muted-foreground">
            Preço mensal médio hoje: {brl(precoMensal)} · margem mensal hoje: {brl(r.atual.margemPrestador)} ·
            alíquota efetiva em {ano}: {r.aliquotaEfetivaPct.toLocaleString("pt-BR")}%
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Regime do prestador</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1"
              value={regime}
              onChange={(e) => setRegime(e.target.value as RegimePrestador)}
            >
              <option value="presumido">Empresa no Presumido</option>
              <option value="real">Empresa no Real</option>
              <option value="simples">Empresa no Simples</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span
              className="text-[11px] text-muted-foreground underline decoration-dotted"
              title="% do preço desse contrato que é custo direto seu — mão de obra alocada, subcontratação, materiais. Usado para calcular sua margem de hoje e quanto do IBS/CBS pago nesses insumos vira crédito seu (reduz o quanto sua margem cai)."
            >
              Custo direto (% do preço) ⓘ
            </span>
            <span className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
              <input
                type="number"
                min={0}
                max={95}
                value={custoPct}
                onChange={(e) => setCustoPct(Number(e.target.value))}
                className="w-12 bg-transparent text-right"
              />
              %
            </span>
          </label>
        </div>
      </div>

      <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground">
        Com a reforma, o imposto embutido nesse contrato muda. Os quatro cenários abaixo mostram o
        que acontece se você decidir mexer no preço de formas diferentes — e o que acontece com a
        sua margem e com o custo líquido do cliente em cada caso.
      </p>

      <p className="text-[11px] text-muted-foreground">
        <strong>Custo direto</strong> é a parte do preço que já é seu custo hoje nesse contrato (mão
        de obra, insumos, subcontratação) — não é um tributo. Ele define sua margem atual e, como
        parte desses insumos também paga IBS/CBS, quanto desse imposto você recupera como crédito e
        não precisa repassar ao cliente.
      </p>

      {regime === "real" ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-[11px] text-foreground">
          <strong>Atenção, regime Lucro Real:</strong> a margem de hoje usada nos cartões abaixo não
          desconta o crédito de PIS/COFINS não cumulativo já recuperável hoje nesse regime — se esse
          crédito não estiver refletido no custo direto informado, a melhora de margem mostrada pode
          estar exagerada.
        </p>
      ) : null}

      {favoravel ? (
        <p className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-[11px] text-foreground">
          <strong>Em {ano}, a transição é favorável para esse contrato:</strong> a carga efetiva do
          IBS/CBS ({r.aliquotaEfetivaPct.toLocaleString("pt-BR")}%) já é menor que os tributos que ela
          substitui. Para manter a margem de hoje, o preço poderia até <strong>cair</strong> — por isso
          "repassar a economia" aqui significa repassar essa redução, não um aumento.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {ANOS_DISPONIVEIS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAno(a)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              a === ano ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.t} className={`min-w-0 rounded-lg border-2 p-3 ${c.cls}`}>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">{c.t}</p>
            <p className="text-[11px] text-muted-foreground">{c.sub}</p>
            <p className="mt-1 text-[11px] italic text-muted-foreground">{c.paraQueServe}</p>

            <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
              <Metrica
                rotulo="Preço de face"
                valor={brl(c.precoFace)}
                valorPct={c.precoFaceVarPct}
                boaSeSobe={!favoravel}
              />
              <Metrica
                rotulo="Custo líquido do cliente"
                valor={brl(c.custoLiquido)}
                valorPct={c.custoLiquidoVarPct}
                boaSeSobe={false}
              />
            </div>

            <div className="mt-2 flex items-baseline justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>Margem hoje: {brl(r.atual.margemPrestador)}</span>
            </div>
            <Metrica
              rotulo="Sua margem neste cenário"
              valor={brl(c.margemNova)}
              valorPct={c.margemVarPct}
              boaSeSobe
            />

            <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {c.texto}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Margem mensal: absorver x equilíbrio x hoje
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compact} fontSize={11} width={50} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="margemAtual" name="Hoje" fill="#12234a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="margemEquilibrio" name="Equilíbrio" fill="#7c6cf5" radius={[3, 3, 0, 0]} />
                <Bar dataKey="margemAbsorve" name="Absorvendo" fill="#e05fa8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Preço necessário e crédito ao cliente, ano a ano
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compact} fontSize={11} width={50} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="precoRepasse" name="Repassar a economia" stroke="#12234a" strokeWidth={2} />
                <Line dataKey="precoEquilibrio" name="Dividir a diferença" stroke="#7c6cf5" strokeWidth={2} />
                <Line dataKey="credito" name="Crédito ao cliente" stroke="#2ec4a6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimativa com transição gradual do IBS/CBS. Ajuste o regime da empresa e o custo direto para
        refletir a realidade do contrato.
      </p>
    </div>
  );
}
