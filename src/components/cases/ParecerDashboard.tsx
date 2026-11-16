import { useEffect, useMemo, useRef, useState } from "react";

import { Notice } from "@/components/simulator/ui";
import {
  BarrasPorImpostoChart,
  CaixaChart,
  CargaTransicaoChart,
  COR_ICMS,
  COR_PISCOFINS,
  ComposicaoDonut,
  PALETA_REGIMES,
  ParcelasIcmsChart,
  PonteLucroRealChart,
  ResultadoAnoChart,
  SaldoLinhaChart,
  TransicaoChart,
  VariacaoRegimeAtualChart,
} from "@/components/cases/ParecerCharts";
import { ParecerClientes } from "@/components/cases/ParecerClientes";
import { ParecerFornecedores } from "@/components/cases/ParecerFornecedores";
import { ParecerPrecoVenda } from "@/components/cases/ParecerPrecoVenda";
import { ParecerServicosTomados } from "@/components/cases/ParecerServicosTomados";
import { CATEGORIAS_IMPOSTO } from "@/lib/parecer/impostos";
import {
  AREAS_PLANO,
  ESCOPO_LABEL,
  LIMITACOES,
  type ParecerEdicoes,
  type ParecerSnapshot,
} from "@/lib/parecer/tipos";
import { AVISO_SALDOS, calcularSaldos, fluxoIcms } from "@/lib/saldos/calculo";
import { brl } from "@/lib/tax/calc";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// Rótulo da pílula na bandeja de abas é mais curto que o título completo da
// aba (mostrado acima do conteúdo) só quando precisa — hoje só "Clientes,
// preço e margem" não cabe bem como pílula.
const MODULOS = [
  { id: "visao", label: "Visão geral", labelPilula: "Visão geral" },
  { id: "regimes", label: "Regimes", labelPilula: "Regimes" },
  { id: "compras", label: "Compras e créditos", labelPilula: "Compras e créditos" },
  { id: "servicos", label: "Serviços tomados", labelPilula: "Serviços tomados" },
  { id: "clientes", label: "Clientes, preço e margem", labelPilula: "Preço e margem" },
  { id: "media", label: "Média geral", labelPilula: "Média geral" },
  { id: "caixa", label: "Caixa e split", labelPilula: "Caixa e split" },
  { id: "saldo", label: "Saldo credor", labelPilula: "Saldo credor" },
  { id: "plano", label: "Achados e plano", labelPilula: "Achados e plano" },
] as const;

type ModuloId = (typeof MODULOS)[number]["id"];

/** Abas cujo conteúdo muda com o ano selecionado (confirmado lendo cada
 * bloco: usam anoSel/cenariosAno/porAno). As demais mostram a situação atual
 * do Caso, sem recorte por ano. */
const ABAS_COM_ANO = new Set<ModuloId>(["visao", "regimes", "media", "caixa", "servicos"]);

const LEGENDA_ANO: Record<number, string> = {
  2026: "impacto real agora",
  2027: "primeira mudança relevante",
  2033: "regime pleno da reforma",
};

type Tone = "plain" | "mint" | "lavender" | "magenta" | "sky" | "amber";

const TONE_CARD: Record<Tone, string> = {
  plain: "border-border bg-card",
  mint: "border-transparent bg-mint-soft",
  lavender: "border-transparent bg-lavender-soft",
  magenta: "border-transparent bg-magenta-soft",
  sky: "border-transparent bg-sky-soft",
  amber: "border-transparent bg-amber-tone-soft",
};

function Card({
  titulo,
  children,
  destaque,
  tone = "plain",
}: {
  titulo?: string;
  children: React.ReactNode;
  destaque?: boolean;
  tone?: Tone;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-5 ${
        destaque ? "border-transparent bg-navy text-navy-foreground" : TONE_CARD[tone]
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
      <p className="break-words font-presentation-display text-2xl leading-tight tabular-nums tracking-tight xl:text-3xl">{valor}</p>
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

function CargaPorTributoTabela({
  titulo,
  linhas,
  boaSeSobe = false,
}: {
  titulo: string;
  linhas: ParecerSnapshot["secCargaTributaria"]["compras"];
  /** Nas compras, um "depois" maior é crédito a mais (bom); nas vendas, é
   * tributo a mais (ruim). Inverte a cor do destaque de acordo. */
  boaSeSobe?: boolean;
}) {
  if (linhas.length === 0) return null;
  const totalAntes = linhas.reduce((a, l) => a + l.antes, 0);
  const totalDepois = linhas.reduce((a, l) => a + l.depois, 0);
  const corDif = (d: number) => {
    if (Math.abs(d) <= 0.004) return "text-muted-foreground";
    const bom = boaSeSobe ? d > 0 : d < 0;
    return bom ? "text-emerald-700" : "text-destructive";
  };
  const fmtDif = (d: number) => (Math.abs(d) < 0.005 ? brl(0) : `${d > 0 ? "+" : ""}${brl(d)}`);
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-muted-foreground">
            <th className="pb-1 font-semibold">Tributo</th>
            <th className="pb-1 text-right font-semibold">Hoje</th>
            <th className="pb-1 text-right font-semibold">Com a reforma</th>
            <th className="pb-1 text-right font-semibold">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const d = l.depois - l.antes;
            return (
              <tr key={l.tributo} className="border-t border-border/60">
                <td className="py-1.5 text-foreground">{l.tributo}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{brl(l.antes)}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{brl(l.depois)}</td>
                <td className={`py-1.5 text-right tabular-nums font-medium ${corDif(d)}`}>
                  {fmtDif(d)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-border font-semibold">
            <td className="py-1.5 text-foreground">Total</td>
            <td className="py-1.5 text-right tabular-nums text-foreground">{brl(totalAntes)}</td>
            <td className="py-1.5 text-right tabular-nums text-foreground">{brl(totalDepois)}</td>
            <td className={`py-1.5 text-right tabular-nums ${corDif(totalDepois - totalAntes)}`}>
              {fmtDif(totalDepois - totalAntes)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function composicao(l: ParecerSnapshot["sec6"]["linhas"][number]) {
  return [
    { name: "Custo", valor: l.custo },
    { name: "Despesas", valor: l.despesas },
    { name: "IRPJ/CSLL", valor: l.ircs ?? 0 },
    { name: "Resultado", valor: Math.max(l.resultadoLiquido ?? 0, 0) },
  ];
}

type DreLinhaSnap = ParecerSnapshot["sec6"]["linhas"][number];

const DRE_LINHAS: { chave: keyof DreLinhaSnap; rotulo: string; destaque?: boolean }[] = [
  { chave: "receitaBruta", rotulo: "Receita bruta" },
  { chave: "deducoes", rotulo: "(−) Tributos sobre a receita" },
  { chave: "receitaLiquida", rotulo: "Receita líquida", destaque: true },
  { chave: "custo", rotulo: "(−) Custo de mercadorias e serviços" },
  { chave: "lucroBruto", rotulo: "Lucro bruto", destaque: true },
  { chave: "despesas", rotulo: "(−) Despesas operacionais" },
  { chave: "resultadoAntesIrcs", rotulo: "Resultado antes de IR/CS", destaque: true },
];

/** Composição da DRE do ano selecionado, hoje x com a reforma — mesma leitura
 * linha a linha do painel de DRE do Diagnóstico Completo, só que como visão
 * executiva (sem os controles de edição do analista). */
function DreResumoTabela({
  atual,
  projetado,
}: {
  atual: DreLinhaSnap | null | undefined;
  projetado: DreLinhaSnap | null | undefined;
}) {
  if (!atual && !projetado) return null;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted-foreground">
          <th className="pb-1 font-semibold">Linha</th>
          <th className="pb-1 text-right font-semibold">Hoje</th>
          <th className="pb-1 text-right font-semibold">Com a reforma</th>
        </tr>
      </thead>
      <tbody>
        {DRE_LINHAS.map((l) => (
          <tr
            key={l.chave}
            className={`border-t border-border/60 ${l.destaque ? "font-semibold" : ""}`}
          >
            <td className="py-1.5 text-foreground">{l.rotulo}</td>
            <td className="py-1.5 text-right tabular-nums text-foreground">
              {atual ? brl(Number(atual[l.chave])) : "—"}
            </td>
            <td className="py-1.5 text-right tabular-nums text-foreground">
              {projetado ? brl(Number(projetado[l.chave])) : "—"}
            </td>
          </tr>
        ))}
        <tr className="border-t border-border/60">
          <td className="py-1.5 text-foreground">(−) IRPJ + CSLL</td>
          <td className="py-1.5 text-right tabular-nums text-foreground">
            {atual?.ircs == null ? "—" : brl(atual.ircs)}
          </td>
          <td className="py-1.5 text-right tabular-nums text-foreground">
            {projetado?.ircs == null ? "—" : brl(projetado.ircs)}
          </td>
        </tr>
        <tr className="border-t border-border bg-secondary/40 font-semibold">
          <td className="py-1.5 text-foreground">Resultado líquido</td>
          <td className="py-1.5 text-right tabular-nums text-foreground">
            {atual?.resultadoLiquido == null ? "—" : brl(atual.resultadoLiquido)}
          </td>
          <td className="py-1.5 text-right tabular-nums text-foreground">
            {projetado?.resultadoLiquido == null ? "—" : brl(projetado.resultadoLiquido)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Custo mensal de cada regime, em barras horizontais — regimes
 * indisponíveis (ex.: Simples acima do limite) aparecem como nota, sem
 * barra, usando a mesma ressalva (`nota`) que já vem calculada no Caso. */
function CustoMensalBarras({
  cenarios,
  melhorLabel,
}: {
  cenarios: ParecerSnapshot["sec8"]["cenarios"];
  melhorLabel: string | null;
}) {
  const disponiveis = cenarios.filter((c) => c.total != null);
  const indisponiveis = cenarios.filter((c) => c.total == null);
  const max = Math.max(1, ...disponiveis.map((c) => c.total ?? 0));
  return (
    <div className="space-y-3">
      {disponiveis.map((c) => (
        <div key={c.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 break-words text-xs text-muted-foreground">
            {c.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded bg-secondary/50">
            <div
              className={`h-full rounded ${c.label === melhorLabel ? "bg-emerald-600" : "bg-navy"}`}
              style={{ width: `${Math.max(2, ((c.total ?? 0) / max) * 100)}%` }}
            />
          </div>
          <span className="w-36 shrink-0 text-right text-xs tabular-nums text-foreground">
            {brl(c.total ?? 0)}
            {c.rate != null ? (
              <span className="text-muted-foreground"> · {pct(c.rate * 100)}</span>
            ) : null}
          </span>
        </div>
      ))}
      {indisponiveis.map((c) => (
        <div key={c.label} className="flex items-start gap-3 text-xs text-muted-foreground">
          <span className="w-28 shrink-0 break-words">{c.label}</span>
          <span className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            >
              <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.5 10.5l7-7" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>{c.nota ?? "Indisponível para este cenário."}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Tabela de dados por trás dos gráficos da aba Regimes — mesmo par
 * "regime atual x melhor alternativa" ao longo de toda a transição. */
function TabelaRegimesPorAno({
  porAno,
  atualLabel,
  alternativaLabel,
  anoSel,
}: {
  porAno: ParecerSnapshot["sec8"]["porAno"];
  atualLabel: string | null;
  alternativaLabel: string | null;
  anoSel: number | null;
}) {
  if (!atualLabel || !alternativaLabel) return null;
  const linhas = (porAno ?? [])
    .slice()
    .sort((a, b) => a.ano - b.ano)
    .map((p) => ({
      ano: p.ano,
      atual: p.cenarios.find((c) => c.label === atualLabel) ?? null,
      alternativa: p.cenarios.find((c) => c.label === alternativaLabel) ?? null,
    }));
  if (linhas.length === 0) return null;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted-foreground">
          <th className="pb-1 font-semibold">Ano</th>
          <th className="pb-1 text-right font-semibold">{atualLabel} (R$/mês)</th>
          <th className="pb-1 text-right font-semibold">{atualLabel} (% receita)</th>
          <th className="pb-1 text-right font-semibold">{alternativaLabel} (R$/mês)</th>
          <th className="pb-1 text-right font-semibold">{alternativaLabel} (% receita)</th>
          <th className="pb-1 text-right font-semibold">Vantagem (R$/mês)</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => {
          const vantagem =
            l.alternativa?.total != null && l.atual?.total != null
              ? l.alternativa.total - l.atual.total
              : null;
          return (
            <tr
              key={l.ano}
              className={`border-t border-border/60 ${l.ano === anoSel ? "bg-secondary/40 font-semibold" : ""}`}
            >
              <td className="py-1.5 text-foreground">{l.ano}</td>
              <td className="py-1.5 text-right tabular-nums text-foreground">
                {l.atual?.total == null ? "—" : brl(l.atual.total)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-foreground">
                {l.atual?.rate == null ? "—" : pct(l.atual.rate * 100)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-foreground">
                {l.alternativa?.total == null ? "—" : brl(l.alternativa.total)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-foreground">
                {l.alternativa?.rate == null ? "—" : pct(l.alternativa.rate * 100)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-foreground">
                {vantagem == null ? "—" : brl(vantagem)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Tabela por imposto: Presumido x Real no ano selecionado — é a tabela que
 * justifica a recomendação ("mais eficiente"), abrindo de onde vem a
 * diferença entre os dois regimes. */
function TabelaPorImposto({
  presumido,
  real,
}: {
  presumido: { categoria: string; valor: number }[];
  real: { categoria: string; valor: number }[];
}) {
  const categorias = CATEGORIAS_IMPOSTO.filter(
    (c) =>
      (presumido.find((l) => l.categoria === c)?.valor ?? 0) > 0 ||
      (real.find((l) => l.categoria === c)?.valor ?? 0) > 0,
  );
  if (categorias.length === 0) return null;
  const totalPresumido = presumido.reduce((a, l) => a + l.valor, 0);
  const totalReal = real.reduce((a, l) => a + l.valor, 0);
  const totalDiff = totalReal - totalPresumido;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted-foreground">
          <th className="pb-1 font-semibold">Imposto</th>
          <th className="pb-1 text-right font-semibold">Presumido</th>
          <th className="pb-1 text-right font-semibold">Real</th>
          <th className="pb-1 text-right font-semibold">Diferença</th>
        </tr>
      </thead>
      <tbody>
        {categorias.map((categoria) => {
          const p = presumido.find((l) => l.categoria === categoria)?.valor ?? 0;
          const r = real.find((l) => l.categoria === categoria)?.valor ?? 0;
          const diff = r - p;
          const economiza = diff < 0;
          return (
            <tr key={categoria} className="border-t border-border/60">
              <td className="py-1.5 text-foreground">{categoria}</td>
              <td className="py-1.5 text-right tabular-nums text-foreground">{brl(p)}</td>
              <td className="py-1.5 text-right tabular-nums text-foreground">{brl(r)}</td>
              <td
                className={`py-1.5 text-right tabular-nums font-medium ${
                  Math.abs(diff) < 0.5
                    ? "text-muted-foreground"
                    : economiza
                      ? "text-emerald-700"
                      : "text-destructive"
                }`}
              >
                {Math.abs(diff) < 0.5 ? "—" : `${economiza ? "▼" : "▲"} ${brl(Math.abs(diff))}`}
              </td>
            </tr>
          );
        })}
        <tr className="border-t border-border/60 font-semibold">
          <td className="py-1.5 text-foreground">Total</td>
          <td className="py-1.5 text-right tabular-nums text-foreground">{brl(totalPresumido)}</td>
          <td className="py-1.5 text-right tabular-nums text-foreground">{brl(totalReal)}</td>
          <td
            className={`py-1.5 text-right tabular-nums ${
              totalDiff < 0 ? "text-emerald-700" : "text-destructive"
            }`}
          >
            {totalDiff < 0 ? "▼" : "▲"} {brl(Math.abs(totalDiff))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Linha de barra horizontal para comparar valores na aba Saldo credor
 * (saldo nominal x valor presente x caixa de cessão) — mesmo padrão visual
 * de barra simples já usado em "Custo mensal" (aba Regimes). */
function BarraComparativa({
  rotulo,
  valor,
  max,
  cor,
}: {
  rotulo: string;
  valor: number;
  max: number;
  cor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-48 shrink-0 text-xs text-muted-foreground">{rotulo}</span>
      <div className="h-6 flex-1 overflow-hidden rounded bg-secondary/50">
        <div
          className={`h-full rounded ${cor}`}
          style={{ width: `${max > 0 ? Math.max(2, (valor / max) * 100) : 0}%` }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-xs tabular-nums text-foreground">{brl(valor)}</span>
    </div>
  );
}

/** Cartão de uma das três possibilidades de uso do saldo de PIS/COFINS —
 * "quando faz sentido" e "prazo e risco" são texto livre do analista
 * (edicoes.secSaldoCredor.pisCofins); o sistema não calcula isso. */
function OpcaoPisCofins({
  numero,
  titulo,
  descricao,
  quandoFazSentido,
  prazoRisco,
  cor,
}: {
  numero: string;
  titulo: string;
  descricao: string;
  quandoFazSentido?: string | undefined;
  prazoRisco?: string | undefined;
  cor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" style={{ borderTop: `3px solid ${cor}` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{numero}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Quando faz sentido</dt>
          <dd className="mt-0.5 text-foreground">
            {quandoFazSentido || <span className="italic text-muted-foreground">A preencher pelo analista</span>}
          </dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Prazo e risco</dt>
          <dd className="mt-0.5 text-foreground">
            {prazoRisco || <span className="italic text-muted-foreground">A preencher pelo analista</span>}
          </dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Base legal</dt>
          <dd className="mt-0.5 text-foreground">Art. 378 da LC 214/2025</dd>
        </div>
      </dl>
    </div>
  );
}

export function ParecerDashboard({
  snapshot,
  edicoes,
  versao,
  geradoEm,
  syncUrl,
  onSair,
  onPdf,
  onApresentar,
}: {
  snapshot: ParecerSnapshot;
  edicoes: ParecerEdicoes;
  versao: number;
  /** Data de geração da versão (ISO), mostrada ao lado de "Versão N" no
   * cabeçalho. Opcional para não quebrar quem ainda não passa isso. */
  geradoEm?: string | null | undefined;
  /** Grava aba/ano na query string (?aba=&ano=) via replaceState e restaura
   * ao carregar — só liga na página pública do relatório; a visão embutida
   * no painel do analista (ParecerPadraoPanel) não pede isso e não deveria
   * poluir a URL daquela tela. */
  syncUrl?: boolean | undefined;
  onSair?: (() => void) | undefined;
  onPdf?: (() => void) | undefined;
  onApresentar?: (() => void) | undefined;

}) {
  const lerEstadoUrl = (): { aba: ModuloId | null; ano: number | null } => {
    if (!syncUrl || typeof window === "undefined") return { aba: null, ano: null };
    const params = new URLSearchParams(window.location.search);
    const aba = params.get("aba");
    const anoParam = Number(params.get("ano"));
    return {
      aba: MODULOS.some((m) => m.id === aba) ? (aba as ModuloId) : null,
      ano: Number.isFinite(anoParam) && anoParam > 0 ? anoParam : null,
    };
  };

  const [modulo, setModulo] = useState<ModuloId>(() => lerEstadoUrl().aba ?? "visao");

  const anos = useMemo(
    () => Array.from(new Set(snapshot.sec6.linhas.map((l) => l.ano))).sort((a, b) => a - b),
    [snapshot.sec6.linhas],
  );
  const [ano, setAno] = useState<number | null>(() => {
    const doUrl = lerEstadoUrl().ano;
    return doUrl != null && anos.includes(doUrl) ? doUrl : (anos[0] ?? null);
  });
  const anoSel = ano != null && anos.includes(ano) ? ano : (anos[0] ?? null);

  // Mantém a URL em sincronia com a aba e o ano selecionados — só quando
  // syncUrl está ligado (página pública do relatório).
  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("aba", modulo);
    if (ABAS_COM_ANO.has(modulo) && anoSel != null) {
      params.set("ano", String(anoSel));
    } else {
      params.delete("ano");
    }
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [modulo, anoSel, syncUrl]);

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

  // Mesmo padrão de reagir à esteira de anos: a carga por tributo recalculada
  // para o ano selecionado, caindo para o par fixo em snapshots antigos sem
  // secCargaTributaria.porAno.
  const cargaAno = useMemo(
    () =>
      snapshot.secCargaTributaria.porAno?.find((p) => p.ano === anoSel) ?? {
        compras: snapshot.secCargaTributaria.compras,
        vendas: snapshot.secCargaTributaria.vendas,
      },
    [snapshot.secCargaTributaria, anoSel],
  );

  // Reage à esteira de anos (igual ao simulador simples): usa a comparação
  // recalculada para o ano selecionado quando disponível, e só cai para o
  // ano-base fixo em snapshots antigos que ainda não tinham sec8.porAno.
  const cenariosAno = useMemo(
    () => snapshot.sec8.porAno?.find((p) => p.ano === anoSel)?.cenarios ?? snapshot.sec8.cenarios,
    [snapshot.sec8.porAno, snapshot.sec8.cenarios, anoSel],
  );

  const melhorRegime = useMemo(() => {
    const disp = cenariosAno.filter((c) => c.total != null);
    return disp.slice().sort((x, y) => (x.total ?? 0) - (y.total ?? 0))[0] ?? null;
  }, [cenariosAno]);

  // Mesma esteira de anos acima, mas para a comparação "hoje x reforma" do
  // regime atual (equivalente ao que o simulador simples mostra em Resultado).
  const atualHojeXReformaAno = useMemo(
    () =>
      snapshot.sec8.atualHojeXReformaPorAno?.find((p) => p.ano === anoSel) ??
      snapshot.sec8.atualHojeXReforma,
    [snapshot.sec8.atualHojeXReformaPorAno, snapshot.sec8.atualHojeXReforma, anoSel],
  );

  const regimeAtualItem = useMemo(
    () => cenariosAno.find((c) => c.atual) ?? null,
    [cenariosAno],
  );

  // Alternativa mais barata entre os regimes disponíveis que não são o
  // atual — usada no cartão de economia e na tabela da aba Regimes. Fixada
  // pelo ano selecionado, para a comparação não trocar de regime sozinha ao
  // percorrer a esteira de anos.
  const melhorAlternativa = useMemo(() => {
    const outros = cenariosAno.filter((c) => c.total != null && !c.atual);
    return outros.slice().sort((a, b) => (a.total ?? 0) - (b.total ?? 0))[0] ?? null;
  }, [cenariosAno]);

  // Diferença entre o regime atual e a melhor alternativa disponível, no ano
  // selecionado — positivo quando o regime atual é o mais barato.
  const gapRegimeAtual = useMemo(() => {
    if (
      !regimeAtualItem ||
      !melhorAlternativa ||
      regimeAtualItem.total == null ||
      regimeAtualItem.rate == null ||
      melhorAlternativa.total == null ||
      melhorAlternativa.rate == null
    ) {
      return null;
    }
    return {
      mensal: melhorAlternativa.total - regimeAtualItem.total,
      pp: (melhorAlternativa.rate - regimeAtualItem.rate) * 100,
    };
  }, [regimeAtualItem, melhorAlternativa]);

  // Série de carga % por regime ao longo de toda a transição, para o
  // gráfico de linha — só entram regimes disponíveis (rate != null) em
  // todos os anos do snapshot; o regime atual sempre fica em primeiro.
  const serieRegimesTransicao = useMemo(() => {
    const porAno = snapshot.sec8.porAno ?? [];
    if (porAno.length === 0) return { labels: [] as string[], pontos: [] as ({ ano: number } & Record<string, number | undefined>)[] };
    const anosOrdenados = porAno.map((p) => p.ano).sort((a, b) => a - b);
    const todosLabels = porAno[0]?.cenarios.map((c) => c.label) ?? [];
    const labels = todosLabels
      .filter((label) =>
        porAno.every((p) => p.cenarios.find((c) => c.label === label)?.rate != null),
      )
      .sort((a, b) => {
        const aAtual = porAno[0]?.cenarios.find((c) => c.label === a)?.atual ?? false;
        const bAtual = porAno[0]?.cenarios.find((c) => c.label === b)?.atual ?? false;
        return aAtual === bAtual ? 0 : aAtual ? -1 : 1;
      });
    const pontos = anosOrdenados.map((ano) => {
      const cenarios = porAno.find((p) => p.ano === ano)?.cenarios ?? [];
      const ponto: { ano: number } & Record<string, number | undefined> = { ano };
      for (const label of labels) {
        const cenario = cenarios.find((c) => c.label === label);
        ponto[label] = cenario?.rate != null ? cenario.rate * 100 : undefined;
        ponto[`${label}__total`] = cenario?.total ?? undefined;
      }
      return ponto;
    });
    return { labels, pontos };
  }, [snapshot.sec8.porAno]);

  // Variação mensal do regime atual frente a hoje, ano a ano — mesma conta
  // do cartão "hoje x reforma" acima, só que aberta pela esteira inteira.
  const variacaoRegimeAtualPorAno = useMemo(
    () =>
      (snapshot.sec8.atualHojeXReformaPorAno ?? []).map((p) => ({
        ano: p.ano,
        hoje: p.hoje.total,
        reforma: p.reforma.total,
        delta: p.reforma.total - p.hoje.total,
      })),
    [snapshot.sec8.atualHojeXReformaPorAno],
  );

  // Presumido e Real no ano selecionado, por rótulo fixo (compareRegimes()
  // sempre usa esses dois rótulos) — base da tabela e das barras por
  // imposto, que abrem de onde vem a diferença entre os dois regimes.
  const presumidoItem = useMemo(
    () => cenariosAno.find((c) => c.label === "Lucro Presumido") ?? null,
    [cenariosAno],
  );
  const realItem = useMemo(
    () => cenariosAno.find((c) => c.label === "Lucro Real") ?? null,
    [cenariosAno],
  );

  // Ponte "hoje x com a reforma" do Lucro Real no ano selecionado.
  const ponteLucroRealAno = useMemo(
    () =>
      snapshot.sec8.ponteLucroRealPorAno?.find((p) => p.ano === anoSel) ??
      snapshot.sec8.ponteLucroRealPorAno?.[0] ??
      null,
    [snapshot.sec8.ponteLucroRealPorAno, anoSel],
  );

  // Cronograma das 240 parcelas de ICMS e comparação "esperar x ceder com
  // deságio" — recalculados no cliente a partir do saldo real (do SPED) e
  // das premissas editáveis do analista, para reagir sem gerar nova versão.
  // O índice de correção das parcelas é o IPCA, fixado pelo art. 134 do
  // ADCT — não é uma premissa editável.
  const resultadoSaldos = useMemo(() => {
    if (!snapshot.secSaldoCredor) return null;
    return calcularSaldos({
      saldoIcms: snapshot.secSaldoCredor.saldoIcmsAtual,
      saldoPisCofins: snapshot.secSaldoCredor.saldoPisCofinsAtual,
      custoOportunidadeAaPct: edicoes.secSaldoCredor?.custoOportunidadeAaPct ?? 12,
      ipcaAaPct: 4,
      desagioCessaoPct: edicoes.secSaldoCredor?.desagioCessaoPct ?? 30,
      mesesCompensacaoCbs: 24,
    });
  }, [snapshot.secSaldoCredor, edicoes.secSaldoCredor]);

  const parcelasIcms = useMemo(() => {
    if (!snapshot.secSaldoCredor) return [];
    return fluxoIcms({
      saldoIcms: snapshot.secSaldoCredor.saldoIcmsAtual,
      saldoPisCofins: 0,
      custoOportunidadeAaPct: edicoes.secSaldoCredor?.custoOportunidadeAaPct ?? 12,
      ipcaAaPct: 4,
      desagioCessaoPct: edicoes.secSaldoCredor?.desagioCessaoPct ?? 30,
      mesesCompensacaoCbs: 24,
    });
  }, [snapshot.secSaldoCredor, edicoes.secSaldoCredor]);

  const saldoIcmsAtual = snapshot.secSaldoCredor?.saldoIcmsAtual ?? 0;
  const saldoPisCofinsAtual = snapshot.secSaldoCredor?.saldoPisCofinsAtual ?? 0;
  const saldoTotalAtual = saldoIcmsAtual + saldoPisCofinsAtual;
  const icmsVazio = saldoIcmsAtual <= 0;
  const pisCofinsVazio = saldoPisCofinsAtual <= 0;

  // Evolução do saldo declarado (ICMS e PIS/COFINS), cada uma como série
  // própria — as duas seções da aba têm seu próprio gráfico.
  const evolucaoIcms = useMemo(
    () =>
      (snapshot.secSaldoCredor?.porPeriodo ?? []).map((p) => ({
        periodo: p.periodo,
        valor: p.saldoIcms,
      })),
    [snapshot.secSaldoCredor],
  );
  const evolucaoPisCofins = useMemo(
    () =>
      (snapshot.secSaldoCredor?.porPeriodo ?? []).map((p) => ({
        periodo: p.periodo,
        valor: p.saldoPisCofins,
      })),
    [snapshot.secSaldoCredor],
  );

  // Simulador: saldo de PIS/COFINS sendo consumido pela CBS devida mês a
  // mês, usando a série real que o sistema já projeta (não um número
  // digitado) — cada ponto é o saldo no INÍCIO daquele mês, antes do
  // abatimento.
  const consumoPisCofins = useMemo(() => {
    if (!snapshot.secSaldoCredor) return [];
    let restante = snapshot.secSaldoCredor.saldoPisCofinsAtual;
    const pontos: { periodo: string; valor: number }[] = [];
    for (const m of snapshot.secSaldoCredor.cbsMensal) {
      pontos.push({ periodo: m.periodo, valor: restante });
      restante = Math.max(0, restante - m.valor);
    }
    return pontos;
  }, [snapshot.secSaldoCredor]);

  const consumoPisCofinsStats = useMemo(() => {
    if (consumoPisCofins.length === 0) return null;
    const indiceZerado = consumoPisCofins.findIndex((p) => p.valor <= 0);
    const janela = indiceZerado === -1 ? consumoPisCofins.length : indiceZerado;
    const cbsMensalMedia =
      janela > 0
        ? (snapshot.secSaldoCredor?.cbsMensal ?? []).slice(0, janela).reduce((a, m) => a + m.valor, 0) /
          janela
        : 0;
    return {
      consumidoDentroDaSerie: indiceZerado !== -1,
      meses: indiceZerado === -1 ? consumoPisCofins.length : indiceZerado,
      cbsMensalMedia,
    };
  }, [consumoPisCofins, snapshot.secSaldoCredor]);

  const competencia = (periodo: string | null) =>
    periodo
      ? new Date(`${periodo}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
      : "—";

  const achados = (edicoes.sec3?.achados ?? snapshot.sec3.achados).filter(
    (a) => a.impacto || a.decisao,
  );

  const precoAno = snapshot.sec5.porAno.find((p) => p.ano === anoSel) ?? null;
  const caixaAno = snapshot.sec7.resumoAnual.find((r) => r.ano === anoSel) ?? null;

  const modulosVisiveis = MODULOS.filter((m) => m.id !== "saldo" || snapshot.secSaldoCredor);
  const moduloAtual = MODULOS.find((m) => m.id === modulo);
  const abaAtualUsaAno = ABAS_COM_ANO.has(modulo);

  // Esmaecido na borda direita da bandeja de abas só quando ela realmente
  // transborda (não um corte fixo por largura de tela) — reage ao
  // ResizeObserver, então também cobre telas médias como 820px.
  const tabsTrayRef = useRef<HTMLDivElement | null>(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);
  useEffect(() => {
    const el = tabsTrayRef.current;
    if (!el) return;
    const checar = () => setTabsOverflow(el.scrollWidth > el.clientWidth + 1);
    checar();
    const ro = new ResizeObserver(checar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [modulosVisiveis.length]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = modulosVisiveis.findIndex((m) => m.id === modulo);
    let proximo: number | null = null;
    if (e.key === "ArrowRight") proximo = (i + 1) % modulosVisiveis.length;
    else if (e.key === "ArrowLeft") proximo = (i - 1 + modulosVisiveis.length) % modulosVisiveis.length;
    else if (e.key === "Home") proximo = 0;
    else if (e.key === "End") proximo = modulosVisiveis.length - 1;
    if (proximo != null) {
      e.preventDefault();
      const alvo = modulosVisiveis[proximo];
      if (alvo) {
        setModulo(alvo.id);
        document.getElementById(`tab-${alvo.id}`)?.focus();
      }
    }
  };

  const onAnoKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (anoSel == null) return;
    const i = anos.indexOf(anoSel);
    let proximo: number | null = null;
    if (e.key === "ArrowRight") proximo = Math.min(anos.length - 1, i + 1);
    else if (e.key === "ArrowLeft") proximo = Math.max(0, i - 1);
    if (proximo != null) {
      e.preventDefault();
      const alvo = anos[proximo];
      if (alvo != null) {
        setAno(alvo);
        document.getElementById(`ano-${alvo}`)?.focus();
      }
    }
  };

  return (
    <section className="space-y-0 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-navy p-6 pb-10 text-navy-foreground">
        <div>
          <span className="inline-block rounded-full bg-mint px-3 py-1 text-xs font-semibold text-navy">
            Diagnóstico com documentos fiscais reais
          </span>
          <h2 className="mt-3 font-presentation-display text-3xl leading-tight">
            {snapshot.sec1.cliente ?? "Cliente não informado"}
          </h2>
          <p className="mt-1 text-sm text-navy-foreground/75">
            {snapshot.sec1.regimeAtual ?? "regime não informado"} ·{" "}
            {ESCOPO_LABEL[snapshot.sec1.escopo].replace(/\s*\([^)]*\)$/, "")}
          </p>
          {snapshot.sec1.objetivo ? (
            <p className="mt-2 max-w-2xl text-sm text-navy-foreground/90">
              {snapshot.sec1.objetivo}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-navy-foreground/10 px-3 py-1 text-xs">
            {geradoEm ? `Gerado em ${new Date(geradoEm).toLocaleDateString("pt-BR")}` : `Versão ${versao}`}
          </span>
          {onApresentar ? (
            <button
              type="button"
              onClick={onApresentar}
              className="rounded-full border border-navy-foreground/50 px-4 py-1.5 text-sm font-semibold text-navy-foreground hover:bg-navy-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-foreground"
            >
              Apresentação guiada
            </button>
          ) : null}
          {onPdf ? (
            <button
              type="button"
              onClick={onPdf}
              className="rounded-full bg-mint px-4 py-1.5 text-sm font-semibold text-navy"
            >
              Baixar PDF
            </button>
          ) : null}
          {onSair ? (
            <button
              type="button"
              onClick={onSair}
              className="rounded-full border border-navy-foreground/30 px-4 py-1.5 text-sm"
            >
              Sair do dashboard
            </button>
          ) : null}
        </div>
      </header>

      <div className="sticky top-2 z-20 mx-3 -mt-5 rounded-2xl border border-border bg-card shadow-md sm:mx-4">
        <div className="relative">
          <div
            ref={tabsTrayRef}
            role="tablist"
            aria-label="Seções do relatório"
            onKeyDown={onTabKeyDown}
            className="m-3 flex w-fit max-w-[calc(100%-1.5rem)] gap-0.5 overflow-x-auto rounded-full bg-secondary p-1"
            style={{ scrollbarWidth: "none" }}
          >
            {modulosVisiveis.map((m) => (
              <button
                key={m.id}
                role="tab"
                id={`tab-${m.id}`}
                aria-selected={modulo === m.id}
                tabIndex={modulo === m.id ? 0 : -1}
                type="button"
                onClick={() => setModulo(m.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                  modulo === m.id
                    ? "bg-navy text-navy-foreground shadow-sm dark:bg-[oklch(0.55_0.18_260)]"
                    : "text-muted-foreground hover:bg-navy/[0.08] hover:text-foreground"
                }`}
              >
                {m.labelPilula}
              </button>
            ))}
          </div>
          <div
            className={`pointer-events-none absolute inset-y-3 right-3 w-7 rounded-r-full bg-gradient-to-l from-secondary to-transparent transition-opacity ${
              tabsOverflow ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        <div className="border-t border-border px-4 py-2.5">
          {abaAtualUsaAno ? (
            <>
              <div
                className="hidden flex-wrap items-center gap-2 sm:flex"
                role="radiogroup"
                aria-label="Ano de referência"
                onKeyDown={onAnoKeyDown}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ano de referência
                </span>
                {anos.map((a) => (
                  <button
                    key={a}
                    role="radio"
                    id={`ano-${a}`}
                    aria-checked={a === anoSel}
                    tabIndex={a === anoSel ? 0 : -1}
                    type="button"
                    onClick={() => setAno(a)}
                    className={`rounded-full border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                      a === anoSel
                        ? "border-navy bg-navy/10 font-semibold text-navy dark:border-sky dark:bg-sky/10 dark:text-sky"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {a}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground">
                  {anoSel} — {(anoSel != null && LEGENDA_ANO[anoSel]) || "transição gradual"}
                </span>
              </div>
              <div className="flex flex-col gap-1 sm:hidden">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ano de referência
                  <select
                    value={anoSel ?? ""}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {anos.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-xs text-muted-foreground">
                  {anoSel} — {(anoSel != null && LEGENDA_ANO[anoSel]) || "transição gradual"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esta aba mostra a situação atual e não depende do ano de referência.
            </p>
          )}
        </div>
      </div>

      <div className="px-1 pt-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-2">
          <h2 className="text-xl font-semibold text-foreground">{moduloAtual?.label}</h2>
          {abaAtualUsaAno && anoSel != null ? (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              Ano de referência: {anoSel}
            </span>
          ) : null}
        </div>

        {modulo === "visao" ? (
        <div className="space-y-4">
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
            <Card tone="sky" titulo="Resultado atual">
              <Numero
                valor={dreAno.atual?.resultadoLiquido == null ? "-" : brl(dreAno.atual.resultadoLiquido)}
                sub={dreAno.atual ? `Receita ${brl(dreAno.atual.receitaBruta)}` : undefined}
              />
            </Card>
            <Card tone="mint" titulo="Resultado projetado">
              <Numero
                valor={
                  dreAno.projetado?.resultadoLiquido == null
                    ? "-"
                    : brl(dreAno.projetado.resultadoLiquido)
                }
                sub={dreAno.projetado ? `Custo ${brl(dreAno.projetado.custo)}` : undefined}
              />
            </Card>
            <Card tone="lavender" titulo="Crédito apurado nas compras">
              <Numero
                valor={brl(snapshot.sec4.creditoTotal)}
                sub={`Sobre ${brl(snapshot.sec4.baseTotal)} de base analisada`}
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {dreAno.atual ? (
              <ComposicaoDonut
                titulo={`Onde a receita vai hoje${anoSel ? ` · ${anoSel}` : ""}`}
                descricao="Composição da receita bruta no cenário atual."
                partes={composicao(dreAno.atual)}
                centroLabel="Receita"
                centroValor={brl(dreAno.atual.receitaBruta)}
              />
            ) : null}
            {dreAno.projetado ? (
              <ComposicaoDonut
                titulo={`Onde a receita vai com a reforma${anoSel ? ` · ${anoSel}` : ""}`}
                descricao="Mesma composição no cenário pós-reforma."
                partes={composicao(dreAno.projetado)}
                centroLabel="Receita"
                centroValor={brl(dreAno.projetado.receitaBruta)}
              />
            ) : null}
          </div>

          {dreAno.atual || dreAno.projetado ? (
            <Card titulo={`DRE do ano — hoje x com a reforma${anoSel ? ` · ${anoSel}` : ""}`}>
              <p className="mb-3 text-xs text-muted-foreground">
                Receita, custo e despesas até o resultado líquido — para ver se a operação fica no
                azul ou no vermelho em cada cenário.
              </p>
              <DreResumoTabela atual={dreAno.atual} projetado={dreAno.projetado} />
            </Card>
          ) : null}

          {cargaAno.compras.length > 0 || cargaAno.vendas.length > 0 ? (
            <Card titulo={`Carga por tributo — hoje x reforma${anoSel ? ` · ${anoSel}` : ""}`}>
              <p className="mb-3 text-xs text-muted-foreground">
                Mesma comparação da DRE acima, aberta imposto a imposto — para sustentar diante do
                cliente de onde vem a diferença. Em "Vendas", o tributo antigo cede espaço ao
                IBS/CBS ano a ano, na fração de transição de {anoSel} — por isso aparece nas duas
                colunas em anos de transição. Em "Compras", o tributo antigo continua embutido no
                preço pago ao fornecedor; o que cresce com a transição é só o crédito de IBS/CBS que
                a empresa passa a recuperar. PIS/COFINS sobre serviço (prestado ou tomado) não entra
                nessa troca — a DRE usa só o ISS do serviço na conta, então essa linha aparece sem
                variação, como referência do que já é pago hoje.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <CargaPorTributoTabela titulo="Compras" linhas={cargaAno.compras} boaSeSobe />
                <CargaPorTributoTabela titulo="Vendas" linhas={cargaAno.vendas} />
              </div>
            </Card>
          ) : null}

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

          <div className="grid gap-4 md:grid-cols-2">
            <Card tone="amber" titulo="Documentos que sustentam o diagnóstico">
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
          {snapshot.avisoRegimeSped ? (
            <Notice tone="warning">{snapshot.avisoRegimeSped}</Notice>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comparação de regimes{anoSel ? ` · ${anoSel}` : ""}
            </p>
            {regimeAtualItem && atualHojeXReformaAno ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Hoje a carga do {regimeAtualItem.label} é de{" "}
                {pct(atualHojeXReformaAno.hoje.rate * 100)} da receita.
                {(() => {
                  const ultimo = serieRegimesTransicao.pontos[serieRegimesTransicao.pontos.length - 1];
                  const valorUltimo = ultimo ? ultimo[regimeAtualItem.label] : undefined;
                  return ultimo && valorUltimo != null
                    ? ` Com a reforma, ela chega a ${pct(valorUltimo)} em ${ultimo.ano}.`
                    : "";
                })()}
                {melhorAlternativa && gapRegimeAtual
                  ? ` A diferença para ${melhorAlternativa.label} é de ${brl(
                      Math.abs(gapRegimeAtual.mensal),
                    )} por mês em ${anoSel}.`
                  : ""}
              </p>
            ) : null}
          </div>

          {regimeAtualItem && melhorAlternativa && gapRegimeAtual ? (
            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
              <Card destaque titulo={`${gapRegimeAtual.mensal >= 0 ? "Economia" : "Diferença"} de ${regimeAtualItem.label} frente a ${melhorAlternativa.label} · ${anoSel}`}>
                <Numero
                  valor={`${brl(Math.abs(gapRegimeAtual.mensal))} por mês`}
                  sub={`${Math.abs(gapRegimeAtual.pp).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })} p.p. de carga · ${brl(Math.abs(gapRegimeAtual.mensal) * 12)} por ano`}
                />
              </Card>
              <Card tone="sky" titulo={`${regimeAtualItem.label} · ${anoSel}`}>
                <p className="break-words font-presentation-display text-2xl leading-tight tabular-nums tracking-tight xl:text-3xl">
                  {brl(regimeAtualItem.total ?? 0)}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  Carga de {pct((regimeAtualItem.rate ?? 0) * 100)}
                  {atualHojeXReformaAno
                    ? (() => {
                        const delta = atualHojeXReformaAno.reforma.total - atualHojeXReformaAno.hoje.total;
                        const bom = delta < 0;
                        return (
                          <span className={bom ? "text-emerald-700" : "text-destructive"}>
                            {" "}
                            · {bom ? "▼" : "▲"} {brl(Math.abs(delta))} vs. hoje
                          </span>
                        );
                      })()
                    : null}
                </p>
              </Card>
              <Card tone="mint" titulo={`${melhorAlternativa.label} · ${anoSel}`}>
                <Numero
                  valor={brl(melhorAlternativa.total ?? 0)}
                  sub={`Carga de ${pct((melhorAlternativa.rate ?? 0) * 100)}`}
                />
              </Card>
            </div>
          ) : null}

          <CargaTransicaoChart
            pontos={serieRegimesTransicao.pontos}
            labels={serieRegimesTransicao.labels}
            anoSel={anoSel}
            cargaAtualPct={atualHojeXReformaAno ? atualHojeXReformaAno.hoje.rate * 100 : null}
            atualLabel={regimeAtualItem?.label ?? null}
            alternativaLabel={melhorAlternativa?.label ?? null}
          />

          {cenariosAno.length === 0 ? (
            <Vazio>Sem comparação de regimes disponível para este Caso.</Vazio>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card titulo={`Custo mensal em ${anoSel}`}>
                <CustoMensalBarras cenarios={cenariosAno} melhorLabel={melhorRegime?.label ?? null} />
              </Card>
              <VariacaoRegimeAtualChart pontos={variacaoRegimeAtualPorAno} anoSel={anoSel} />
            </div>
          )}

          {presumidoItem?.total != null &&
          presumidoItem.porImposto &&
          realItem?.total != null &&
          realItem.porImposto ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card titulo={`Por imposto: Presumido x Real em ${anoSel}`}>
                <TabelaPorImposto presumido={presumidoItem.porImposto} real={realItem.porImposto} />
              </Card>
              <BarrasPorImpostoChart
                dados={[
                  { regime: "Lucro Presumido", total: presumidoItem.total, porImposto: presumidoItem.porImposto },
                  { regime: "Lucro Real", total: realItem.total, porImposto: realItem.porImposto },
                ]}
              />
            </div>
          ) : null}

          {ponteLucroRealAno ? (
            <PonteLucroRealChart
              hoje={ponteLucroRealAno.hoje}
              reforma={ponteLucroRealAno.reforma}
              hojeTotal={ponteLucroRealAno.hojeTotal}
              reformaTotal={ponteLucroRealAno.reformaTotal}
            />
          ) : null}

          <Card titulo="Recomendação do escritório">
            <p className="text-sm text-foreground">
              {edicoes.sec8?.recomendacao ??
                "Recomendação a ser registrada pelo analista antes da entrega."}
            </p>
          </Card>

          <details className="rounded-2xl border border-border bg-card p-5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Ver dados em tabela
            </summary>
            <div className="mt-3 overflow-x-auto">
              <TabelaRegimesPorAno
                porAno={snapshot.sec8.porAno}
                atualLabel={regimeAtualItem?.label ?? null}
                alternativaLabel={melhorAlternativa?.label ?? null}
                anoSel={anoSel}
              />
            </div>
          </details>
        </div>
      ) : null}

      {modulo === "compras" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card tone="sky" titulo="Base de compras">
              <Numero valor={brl(snapshot.sec4.baseTotal)} />
            </Card>
            <Card tone="mint" titulo="Crédito de IBS/CBS">
              <Numero valor={brl(snapshot.sec4.creditoTotal)} />
            </Card>
            <Card tone="magenta" titulo="Concentração no maior fornecedor">
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
          <ParecerFornecedores sec4={snapshot.sec4} />
        </div>
      ) : null}

      {modulo === "servicos" ? (
        <ParecerServicosTomados
          sec4b={snapshot.sec4b}
          ano={anoSel ?? 2033}
          onAno={(a) => setAno(a)}
          syncUrl={syncUrl}
        />
      ) : null}

      {modulo === "clientes" ? (
        <section className="space-y-2">
          <h3 className="font-presentation-display text-lg">Preço e margem por cliente</h3>
          <p className="text-xs text-muted-foreground">
            Selecione um cliente para comparar: absorver o imposto, repassar ao preço ou dividir o
            impacto, ano a ano.
          </p>
          <ParecerClientes
            clientes={snapshot.sec5.clientes ?? []}
            regimeAtualCaso={snapshot.sec1.regimeAtual}
          />
        </section>
      ) : null}

      {modulo === "media" ? (
        <ParecerPrecoVenda
          sec5={snapshot.sec5}
          sec4={snapshot.sec4}
          ano={precoAno?.ano ?? anoSel}
          onAno={(a) => setAno(a)}
        />
      ) : null}



      {modulo === "caixa" ? (
        <div className="space-y-4">
          {!snapshot.sec7.periodo ? (
            <Vazio>Gere o fluxo de caixa do Caso para ler a mecânica do split payment.</Vazio>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card tone="sky" titulo="1. Venda bruta">
                  <Numero valor={brl(snapshot.sec7.vendasBrutas)} />
                </Card>
                <Card tone="magenta" titulo="2. Retido na origem">
                  <Numero valor={brl(snapshot.sec7.debitoRetido)} />
                </Card>
                <Card tone="mint" titulo="3. Crédito disponível">
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

      {modulo === "saldo" && snapshot.secSaldoCredor ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Saldo credor acumulado
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              O ICMS é ressarcido em parcelas e pode ser cedido; o PIS/COFINS é usado contra a CBS ou
              outros tributos federais, ou ressarcido pela Receita. Por isso aparecem em seções
              separadas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="#saldo-icms"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_ICMS }} />
              ICMS
            </a>
            <a
              href="#saldo-piscofins"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_PISCOFINS }} />
              PIS/COFINS
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card destaque titulo="Saldo credor total">
              <Numero
                valor={brl(saldoTotalAtual)}
                sub={
                  snapshot.secSaldoCredor.competenciaIcms || snapshot.secSaldoCredor.competenciaPisCofins
                    ? `ICMS + PIS/COFINS · base: último SPED importado`
                    : undefined
                }
              />
            </Card>
            <Card titulo="Saldo credor de ICMS">
              <Numero
                valor={brl(saldoIcmsAtual)}
                sub={`Competência: ${competencia(snapshot.secSaldoCredor.competenciaIcms)}`}
              />
              <span
                className="mt-2 inline-block rounded-full px-3 py-1 text-xs"
                style={{ background: "color-mix(in srgb, " + COR_ICMS + " 14%, transparent)", color: COR_ICMS }}
              >
                {icmsVazio ? "Nada a ressarcir" : "Esperar ou ceder"}
              </span>
            </Card>
            <Card titulo="Saldo credor de PIS/COFINS">
              <Numero
                valor={brl(saldoPisCofinsAtual)}
                sub={`Competência: ${competencia(snapshot.secSaldoCredor.competenciaPisCofins)}`}
              />
              <span
                className="mt-2 inline-block rounded-full px-3 py-1 text-xs"
                style={{
                  background: "color-mix(in srgb, " + COR_PISCOFINS + " 14%, transparent)",
                  color: COR_PISCOFINS,
                }}
              >
                {pisCofinsVazio ? "Nada a compensar" : "Compensar ou ressarcir"}
              </span>
            </Card>
          </div>

          {/* ICMS */}
          <section
            id="saldo-icms"
            className="scroll-mt-20 space-y-4 border-l-4 pl-4"
            style={{ borderColor: COR_ICMS }}
          >
            <div>
              <h3 className="text-lg font-semibold text-foreground">ICMS</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                O saldo homologado é ressarcido em 240 parcelas mensais, corrigidas pelo IPCA, a partir
                de 2033 (art. 134 do ADCT, EC 132/2023). A pergunta é se vale esperar ou ceder o crédito
                a um terceiro.
              </p>
            </div>

            {icmsVazio ? (
              <Vazio>
                Sem saldo credor de ICMS declarado no último SPED importado
                {snapshot.secSaldoCredor.competenciaIcms
                  ? ` (${competencia(snapshot.secSaldoCredor.competenciaIcms)})`
                  : ""}
                . Não há valor a ressarcir em parcelas nem a ceder, então as análises de valor presente
                e de cessão não se aplicam.
              </Vazio>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <SaldoLinhaChart
                    pontos={evolucaoIcms}
                    titulo="Evolução do saldo de ICMS"
                    descricao="Saldo declarado no SPED, mês a mês."
                    nomeSerie="Saldo ICMS"
                    cor={COR_ICMS}
                  />
                  <Card titulo="Esperar as 240 parcelas ou ceder a terceiro">
                    <p className="text-xs text-muted-foreground">Premissas do analista (editáveis no painel):</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">
                        Deságio da cessão: {(edicoes.secSaldoCredor?.desagioCessaoPct ?? 30).toLocaleString("pt-BR")}%
                      </span>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">
                        Custo de oportunidade: {(edicoes.secSaldoCredor?.custoOportunidadeAaPct ?? 12).toLocaleString("pt-BR")}% a.a.
                      </span>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">
                        IPCA (fixado pela EC 132/2023): 4% a.a.
                      </span>
                    </div>
                    {resultadoSaldos ? (
                      <>
                        <div className="mt-4 space-y-2">
                          <BarraComparativa
                            rotulo="Saldo nominal"
                            valor={resultadoSaldos.icms.saldo}
                            max={Math.max(
                              resultadoSaldos.icms.saldo,
                              resultadoSaldos.icms.vplInercia,
                              resultadoSaldos.icms.caixaCessao,
                            )}
                            cor="bg-secondary-foreground/30"
                          />
                          <BarraComparativa
                            rotulo="Valor presente esperando as 240 parcelas"
                            valor={resultadoSaldos.icms.vplInercia}
                            max={Math.max(
                              resultadoSaldos.icms.saldo,
                              resultadoSaldos.icms.vplInercia,
                              resultadoSaldos.icms.caixaCessao,
                            )}
                            cor="bg-navy"
                          />
                          <BarraComparativa
                            rotulo="Caixa imediato cedendo a terceiro"
                            valor={resultadoSaldos.icms.caixaCessao}
                            max={Math.max(
                              resultadoSaldos.icms.saldo,
                              resultadoSaldos.icms.vplInercia,
                              resultadoSaldos.icms.caixaCessao,
                            )}
                            cor="bg-emerald-600"
                          />
                        </div>
                        <div
                          className="mt-3 rounded-lg p-3 text-xs text-muted-foreground"
                          style={{ background: "color-mix(in srgb, " + COR_ICMS + " 8%, transparent)" }}
                        >
                          {resultadoSaldos.icms.ganhoCessao >= 0 ? (
                            <>
                              Com essas premissas, <strong className="text-foreground">ceder rende {brl(resultadoSaldos.icms.ganhoCessao)} a mais</strong> que
                              esperar. A cessão compensa até um deságio de equilíbrio de{" "}
                              <strong className="text-foreground">{resultadoSaldos.icms.desagioEquilibrioPct.toLocaleString("pt-BR")}%</strong>.
                              A perda do valor presente frente ao saldo nominal é de{" "}
                              {brl(resultadoSaldos.icms.perdaInercia)} ({resultadoSaldos.icms.perdaInerciaPct.toLocaleString("pt-BR")}%).
                            </>
                          ) : (
                            <>
                              Com essas premissas, <strong className="text-foreground">esperar rende {brl(Math.abs(resultadoSaldos.icms.ganhoCessao))} a mais</strong> que
                              ceder. O deságio de equilíbrio é de{" "}
                              <strong className="text-foreground">{resultadoSaldos.icms.desagioEquilibrioPct.toLocaleString("pt-BR")}%</strong>: abaixo
                              disso a cessão perde para a espera.
                            </>
                          )}
                        </div>
                      </>
                    ) : null}
                  </Card>
                </div>

                <ParcelasIcmsChart parcelas={parcelasIcms} cor={COR_ICMS} />

                <p className="text-xs leading-relaxed text-muted-foreground">{AVISO_SALDOS}</p>
              </>
            )}
          </section>

          {/* PIS/COFINS */}
          <section
            id="saldo-piscofins"
            className="scroll-mt-20 space-y-4 border-l-4 pl-4"
            style={{ borderColor: COR_PISCOFINS }}
          >
            <div>
              <h3 className="text-lg font-semibold text-foreground">PIS/COFINS</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                O saldo não pode ser cedido a terceiros (art. 378 da LC 214/2025). Ele pode ser
                compensado com a CBS devida, compensado com outros tributos federais ou ressarcido em
                dinheiro pela Receita Federal.
              </p>
            </div>

            {pisCofinsVazio ? (
              <Vazio>
                Sem saldo credor de PIS/COFINS declarado no último SPED importado
                {snapshot.secSaldoCredor.competenciaPisCofins
                  ? ` (${competencia(snapshot.secSaldoCredor.competenciaPisCofins)})`
                  : ""}
                . Se surgir saldo em período futuro, as opções de uso aparecem aqui.
              </Vazio>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <SaldoLinhaChart
                    pontos={evolucaoPisCofins}
                    titulo="Evolução do saldo de PIS/COFINS"
                    descricao="Saldo declarado no SPED, mês a mês."
                    nomeSerie="Saldo PIS/COFINS"
                    cor={COR_PISCOFINS}
                  />
                  <div className="space-y-3">
                    <SaldoLinhaChart
                      pontos={consumoPisCofins}
                      titulo="Simulação: o saldo sendo consumido pela CBS"
                      descricao="Saldo restante se for abatido da CBS devida projetada mês a mês."
                      nomeSerie="Saldo restante"
                      cor={COR_PISCOFINS}
                    />
                    {consumoPisCofinsStats ? (
                      <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
                        <div>
                          Meses para consumir o saldo
                          <p className="text-xl font-semibold text-foreground">
                            {consumoPisCofinsStats.consumidoDentroDaSerie
                              ? `${consumoPisCofinsStats.meses} ${consumoPisCofinsStats.meses === 1 ? "mês" : "meses"}`
                              : `mais de ${consumoPisCofinsStats.meses} meses`}
                          </p>
                        </div>
                        <div>
                          CBS mensal projetada (média até consumir)
                          <p className="text-xl font-semibold text-foreground">
                            {brl(consumoPisCofinsStats.cbsMensalMedia)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  A CBS mensal é uma aproximação: o motor de cálculo não separa CBS de IBS, então o
                  valor é estimado pela fatia da CBS dentro do débito combinado já projetado no fluxo
                  de caixa. Diferente do ICMS, não há cálculo de antecipação com deságio para este
                  saldo — o que se compara é o caminho de uso.
                </p>

                <div className="grid gap-4 lg:grid-cols-3">
                  <OpcaoPisCofins
                    numero="Opção 1"
                    titulo="Compensar com a CBS devida"
                    descricao="O saldo é abatido da CBS que a empresa passa a recolher."
                    quandoFazSentido={edicoes.secSaldoCredor?.pisCofins?.compensacaoCbs?.quandoFazSentido}
                    prazoRisco={edicoes.secSaldoCredor?.pisCofins?.compensacaoCbs?.prazoRisco}
                    cor={COR_PISCOFINS}
                  />
                  <OpcaoPisCofins
                    numero="Opção 2"
                    titulo="Compensar com outros tributos federais"
                    descricao="O saldo é usado para quitar outros tributos administrados pela Receita Federal."
                    quandoFazSentido={edicoes.secSaldoCredor?.pisCofins?.outrosTributos?.quandoFazSentido}
                    prazoRisco={edicoes.secSaldoCredor?.pisCofins?.outrosTributos?.prazoRisco}
                    cor={COR_PISCOFINS}
                  />
                  <OpcaoPisCofins
                    numero="Opção 3"
                    titulo="Ressarcimento em dinheiro"
                    descricao="Pedido de ressarcimento à Receita Federal, por meio do PER/DCOMP."
                    quandoFazSentido={edicoes.secSaldoCredor?.pisCofins?.ressarcimento?.quandoFazSentido}
                    prazoRisco={edicoes.secSaldoCredor?.pisCofins?.ressarcimento?.prazoRisco}
                    cor={COR_PISCOFINS}
                  />
                </div>
              </>
            )}
          </section>
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

      {modulo === "saldo" ? (
        <footer className="space-y-1 border-t border-border pt-3">
          {snapshot.sec10.limitacoes
            .filter((l) => l === LIMITACOES.saldoCredor || l === LIMITACOES.aliquota)
            .map((l) => (
              <p key={l} className="text-[11px] leading-relaxed text-muted-foreground">
                {l}
              </p>
            ))}
          {snapshot.sec10.limitacoes.some(
            (l) => l !== LIMITACOES.saldoCredor && l !== LIMITACOES.aliquota,
          ) ? (
            <details>
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                Demais ressalvas do relatório
              </summary>
              <div className="mt-1 space-y-1">
                {snapshot.sec10.limitacoes
                  .filter((l) => l !== LIMITACOES.saldoCredor && l !== LIMITACOES.aliquota)
                  .map((l) => (
                    <p key={l} className="text-[11px] leading-relaxed text-muted-foreground">
                      {l}
                    </p>
                  ))}
              </div>
            </details>
          ) : null}
        </footer>
      ) : (
        <footer className="space-y-1 border-t border-border pt-3">
          {snapshot.sec10.limitacoes.map((l) => (
            <p key={l} className="text-[11px] leading-relaxed text-muted-foreground">
              {l}
            </p>
          ))}
        </footer>
      )}
      </div>
    </section>
  );
}
