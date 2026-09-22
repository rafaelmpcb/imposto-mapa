/**
 * Aba "Fornecedores e créditos" do relatório executivo.
 * Camada puramente visual: consome o snapshot já compilado (sec4) e apenas
 * organiza/apresenta. Não recalcula crédito, imposto ou classificação.
 */
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FichaNegociacaoDialog } from "@/components/cases/FichaNegociacaoDialog";
import { brl } from "@/lib/tax/calc";
import type { FornecedorDetalheSnap, ParecerSnapshot } from "@/lib/parecer/tipos";

const COR_NORMAL = "#f97316";
const COR_SIMPLES = "#12234a";
const COR_OUTRO = "#c7cbd6";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const competenciaLabel = (c: string) => {
  if (!/^\d{4}-\d{2}$/.test(c)) return c;
  const [ano, mes] = c.split("-");
  return `${mes}/${ano!.slice(2)}`;
};

const dataLabel = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "sem data";

type Forn = ParecerSnapshot["sec4"]["fornecedores"][number];

function regimeLabel(r: string | null | undefined) {
  if (r === "simples") return "Simples Nacional";
  if (r === "regular") return "Regime Normal";
  return "Não classificado";
}

function Box({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Visão detalhada de um fornecedor: histórico, notas, créditos e participação. */
function DetalheFornecedor({
  d,
  totalBase,
  onVoltar,
}: {
  d: FornecedorDetalheSnap;
  totalBase: number;
  onVoltar: () => void;
}) {
  const serie = d.meses.map((m) => ({
    mes: competenciaLabel(m.competencia),
    compras: m.valorBase,
    credito: m.credito,
    participacao: Number(m.participacaoPct.toFixed(2)),
  }));
  const share = totalBase > 0 ? (d.valorBase / totalBase) * 100 : 0;
  const efetiva = d.valorBase > 0 ? (d.credito / d.valorBase) * 100 : 0;
  const [ficha, setFicha] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onVoltar}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            ← Voltar para todos fornecedores
          </button>
          <h4 className="mt-1 truncate font-presentation-display text-xl text-foreground">
            {d.nome ?? d.cnpj ?? "Sem identificação"}
          </h4>
          <p className="text-xs text-muted-foreground">
            {d.cnpj ?? "CNPJ não informado"} · {regimeLabel(d.regime)} · {d.notas.length} nota(s)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFicha(true)}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Gerar argumentário de negociação
        </button>
      </div>

      <FichaNegociacaoDialog
        aberto={ficha}
        onOpenChange={setFicha}
        relacao="fornecedor"
        detalhe={d}
        totalBase={totalBase}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Box titulo="Total comprado">
          <p className="font-presentation-display text-2xl text-foreground">{brl(d.valorBase)}</p>
          <p className="text-xs text-muted-foreground">{pct(share)} do total de compras</p>
        </Box>
        <Box titulo="Crédito estimado de IBS/CBS">
          <p className="font-presentation-display text-2xl text-foreground">{brl(d.credito)}</p>
          <p className="text-xs text-muted-foreground">
            {pct(efetiva)} sobre a base deste fornecedor
          </p>
        </Box>
        <Box titulo="Itens classificados">
          <p className="font-presentation-display text-2xl text-foreground">{d.itens}</p>
          <p className="text-xs text-muted-foreground">{d.pendentes} em revisão</p>
        </Box>
        <Box titulo="Período com movimento">
          <p className="font-presentation-display text-2xl text-foreground">{d.meses.length}</p>
          <p className="text-xs text-muted-foreground">
            {d.meses.length > 0
              ? `${competenciaLabel(d.meses[0]!.competencia)} a ${competenciaLabel(
                  d.meses[d.meses.length - 1]!.competencia,
                )}`
              : "sem datas nas notas"}
          </p>
        </Box>
      </div>

      <Box titulo="Histórico de compras e participação no total">
        {serie.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem datas de emissão nas notas.</p>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ef" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="v"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => brl(v)}
                  width={90}
                />
                <YAxis
                  yAxisId="p"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  width={45}
                />
                <Tooltip
                  formatter={(v: number, n: string) =>
                    n === "Participação no mês" ? pct(v) : brl(v)
                  }
                />
                <Bar yAxisId="v" dataKey="compras" name="Compras" fill="#12234a" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="v" dataKey="credito" name="Crédito" fill="#7c6cf5" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="p"
                  type="monotone"
                  dataKey="participacao"
                  name="Participação no mês"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Box>

      {d.topNcms.length > 0 ? (
        <Box titulo="Principais NCMs comprados deste fornecedor">
          <div className="space-y-2">
            {d.topNcms.map((n) => (
              <div
                key={n.ncm}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-foreground">{n.descricao ?? "Sem descrição"}</p>
                  <p className="text-[11px] text-muted-foreground">NCM {n.ncm}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums text-foreground">{brl(n.valorBase)}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    crédito {brl(n.credito)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Box>
      ) : null}

      <div className="rounded-xl border border-border bg-card">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
          Notas fiscais deste fornecedor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Nota</th>
                <th className="px-4 py-2 font-semibold">Emissão</th>
                <th className="px-4 py-2 text-right font-semibold">Valor da nota</th>
                <th className="px-4 py-2 text-right font-semibold">Base</th>
                <th className="px-4 py-2 text-right font-semibold">Crédito</th>
                <th className="px-4 py-2 text-right font-semibold">Itens</th>
              </tr>
            </thead>
            <tbody>
              {d.notas.map((n, i) => (
                <tr key={`${n.chave ?? n.numero ?? "n"}-${i}`} className="border-t border-border/70">
                  <td className="px-4 py-2">
                    <p className="text-foreground">
                      {n.numero ? `Nº ${n.numero}` : "Sem número"}
                      {n.serie ? ` · série ${n.serie}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {n.chave ?? "sem chave de acesso"}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{dataLabel(n.data)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {brl(n.valorTotal)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {brl(n.valorBase)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-foreground">
                    {brl(n.credito)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {n.itens}
                    {n.pendentes > 0 ? ` (${n.pendentes} em revisão)` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Crédito estimado a partir dos itens já classificados; itens em revisão não entram no valor.
      </p>
    </div>
  );
}

const CORES_COMPARA = ["#12234a", "#f97316", "#7c6cf5", "#10b981"];

/** Comparação lado a lado de 2 a 4 fornecedores selecionados. */
function CompararFornecedores({
  itens,
  totalBase,
  onFechar,
}: {
  itens: FornecedorDetalheSnap[];
  totalBase: number;
  onFechar: () => void;
}) {
  const meses = Array.from(
    new Set(itens.flatMap((d) => d.meses.map((m) => m.competencia))),
  ).sort();

  const serie = meses.map((c) => {
    const row: Record<string, string | number> = { mes: competenciaLabel(c) };
    itens.forEach((d, i) => {
      const m = d.meses.find((x) => x.competencia === c);
      row[`v${i}`] = m?.valorBase ?? 0;
      row[`p${i}`] = Number((m?.participacaoPct ?? 0).toFixed(2));
    });
    return row;
  });

  const linhas: { rotulo: string; valor: (d: FornecedorDetalheSnap) => string }[] = [
    { rotulo: "Regime", valor: (d) => regimeLabel(d.regime) },
    { rotulo: "Total comprado", valor: (d) => brl(d.valorBase) },
    {
      rotulo: "Participação no total",
      valor: (d) => pct(totalBase > 0 ? (d.valorBase / totalBase) * 100 : 0),
    },
    { rotulo: "Crédito estimado", valor: (d) => brl(d.credito) },
    {
      rotulo: "Alíquota efetiva de crédito",
      valor: (d) => pct(d.valorBase > 0 ? (d.credito / d.valorBase) * 100 : 0),
    },
    {
      rotulo: "Custo líquido (compras - crédito)",
      valor: (d) => brl(d.valorBase - d.credito),
    },
    { rotulo: "Notas fiscais", valor: (d) => String(d.notas.length) },
    { rotulo: "Itens classificados", valor: (d) => String(d.itens) },
    { rotulo: "Itens em revisão", valor: (d) => String(d.pendentes) },
    { rotulo: "Meses com movimento", valor: (d) => String(d.meses.length) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={onFechar}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Voltar para todos fornecedores
        </button>
        <h4 className="mt-1 font-presentation-display text-xl text-foreground">
          Comparação de {itens.length} fornecedores
        </h4>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Indicador</th>
              {itens.map((d, i) => (
                <th key={d.chave} className="px-4 py-2 text-right font-semibold">
                  <span className="flex items-center justify-end gap-2 normal-case">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: CORES_COMPARA[i] }}
                    />
                    <span className="truncate text-foreground">
                      {d.nome ?? d.cnpj ?? "Sem identificação"}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo} className="border-t border-border/70">
                <td className="px-4 py-2 text-muted-foreground">{l.rotulo}</td>
                {itens.map((d) => (
                  <td
                    key={d.chave}
                    className="px-4 py-2 text-right tabular-nums text-foreground"
                  >
                    {l.valor(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Box titulo="Evolução do volume comprado e da participação no total">
        {serie.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem datas de emissão nas notas.</p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ef" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="v"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => brl(v)}
                  width={90}
                />
                <YAxis
                  yAxisId="p"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  width={45}
                />
                <Tooltip
                  formatter={(v: number, n: string) => (n.startsWith("Part.") ? pct(v) : brl(v))}
                />
                {itens.map((d, i) => (
                  <Bar
                    key={`b${d.chave}`}
                    yAxisId="v"
                    dataKey={`v${i}`}
                    name={`Compras · ${d.nome ?? d.cnpj ?? "—"}`}
                    fill={CORES_COMPARA[i]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
                {itens.map((d, i) => (
                  <Line
                    key={`l${d.chave}`}
                    yAxisId="p"
                    type="monotone"
                    dataKey={`p${i}`}
                    name={`Part. · ${d.nome ?? d.cnpj ?? "—"}`}
                    stroke={CORES_COMPARA[i]}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 2 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Box>

      <p className="text-[11px] text-muted-foreground">
        Crédito estimado a partir dos itens já classificados; itens em revisão não entram no valor.
      </p>
    </div>
  );
}

export function ParecerFornecedores({ sec4 }: { sec4: ParecerSnapshot["sec4"] }) {
  const [filtro, setFiltro] = useState<"todos" | "simples" | "regular">("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string[]>([]);
  const [modoComparar, setModoComparar] = useState(false);

  const lista = sec4.fornecedores;
  const detalhes = useMemo(() => {
    const m = new Map<string, FornecedorDetalheSnap>();
    for (const d of sec4.detalhes ?? []) {
      if (d.cnpj) m.set(String(d.cnpj).replace(/\D/g, ""), d);
      if (d.nome) m.set(d.nome.toLowerCase(), d);
    }
    return m;
  }, [sec4.detalhes]);

  const detalheDe = (f: Forn) =>
    (f.cnpj ? detalhes.get(String(f.cnpj).replace(/\D/g, "")) : undefined) ??
    (f.nome ? detalhes.get(f.nome.toLowerCase()) : undefined);

  /* ---- Regime Normal x Simples Nacional ---- */
  const porRegime = useMemo(() => {
    const acc = { regular: 0, simples: 0, outro: 0 };
    for (const f of lista) {
      const k = f.regime === "simples" ? "simples" : f.regime === "regular" ? "regular" : "outro";
      acc[k] += f.valorBase;
    }
    const total = acc.regular + acc.simples + acc.outro;
    return {
      total,
      partes: [
        { nome: "Regime Normal", valor: acc.regular, cor: COR_NORMAL },
        { nome: "Simples Nacional", valor: acc.simples, cor: COR_SIMPLES },
        { nome: "Não classificado", valor: acc.outro, cor: COR_OUTRO },
      ].filter((p) => p.valor > 0),
    };
  }, [lista]);

  /* ---- Curva ABC por volume de compra ---- */
  const abc = useMemo(() => {
    const ordenada = [...lista].sort((a, b) => b.valorBase - a.valorBase);
    const total = ordenada.reduce((a, f) => a + f.valorBase, 0);
    const grupos = { A: [] as Forn[], B: [] as Forn[], C: [] as Forn[] };
    let acumulado = 0;
    for (const f of ordenada) {
      const antes = total > 0 ? acumulado / total : 0;
      if (antes < 0.8) grupos.A.push(f);
      else if (antes < 0.95) grupos.B.push(f);
      else grupos.C.push(f);
      acumulado += f.valorBase;
    }
    const resumo = (["A", "B", "C"] as const).map((k) => {
      const itens = grupos[k];
      const valor = itens.reduce((a, f) => a + f.valorBase, 0);
      return {
        curva: `Curva ${k}`,
        n: itens.length,
        valor,
        share: total > 0 ? (valor / total) * 100 : 0,
      };
    });
    return { total, resumo, ordenada };
  }, [lista]);

  /* ---- Pulverização (cauda longa) ---- */
  const cauda = useMemo(() => {
    const ordenada = abc.ordenada;
    const total = abc.total;
    const pequenos = ordenada.filter((f) => (total > 0 ? f.valorBase / total : 0) < 0.01);
    const valor = pequenos.reduce((a, f) => a + f.valorBase, 0);
    const ticket = pequenos.length > 0 ? valor / pequenos.length : 0;
    const vals = pequenos.map((f) => f.valorBase).sort((a, b) => a - b);
    const mediana =
      vals.length === 0
        ? 0
        : vals.length % 2
          ? vals[(vals.length - 1) / 2]!
          : (vals[vals.length / 2 - 1]! + vals[vals.length / 2]!) / 2;
    return {
      n: pequenos.length,
      valor,
      share: total > 0 ? (valor / total) * 100 : 0,
      ticket,
      mediana,
    };
  }, [abc]);

  /* ---- Tabela filtrada ---- */
  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return abc.ordenada.filter((f) => {
      const reg = f.regime === "simples" ? "simples" : f.regime === "regular" ? "regular" : "outro";
      if (filtro !== "todos" && reg !== filtro) return false;
      if (!termo) return true;
      return `${f.nome ?? ""} ${f.cnpj ?? ""}`.toLowerCase().includes(termo);
    });
  }, [abc.ordenada, filtro, busca]);

  const totalFiltrado = filtrada.reduce(
    (a, f) => ({
      base: a.base + f.valorBase,
      credito: a.credito + f.valorApurado,
      itens: a.itens + f.itens,
    }),
    { base: 0, credito: 0, itens: 0 },
  );

  if (lista.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Sem notas de compra processadas neste Caso.
      </div>
    );
  }

  const aberto = selecionado
    ? (sec4.detalhes ?? []).find((d) => d.chave === selecionado)
    : undefined;
  if (aberto) {
    return (
      <DetalheFornecedor
        d={aberto}
        totalBase={abc.total}
        onVoltar={() => setSelecionado(null)}
      />
    );
  }

  const selecionados = (sec4.detalhes ?? []).filter((d) => comparar.includes(d.chave));
  if (modoComparar && selecionados.length >= 2) {
    return (
      <CompararFornecedores
        itens={selecionados}
        totalBase={abc.total}
        onFechar={() => setModoComparar(false)}
      />
    );
  }

  const alternar = (chave: string) =>
    setComparar((atual) =>
      atual.includes(chave)
        ? atual.filter((c) => c !== chave)
        : atual.length >= 4
          ? atual
          : [...atual, chave],
    );



  return (
    <div className="space-y-4">
      {/* topo: três blocos analíticos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Box titulo="Regime Normal x Simples Nacional">
          <div className="flex items-center gap-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porRegime.partes}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius={44}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {porRegime.partes.map((p) => (
                      <Cell key={p.nome} fill={p.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 space-y-2 text-sm">
              {porRegime.partes.map((p) => (
                <div key={p.nome} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: p.cor }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{p.nome}</p>
                    <p className="tabular-nums font-semibold text-foreground">{brl(p.valor)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {pct(porRegime.total > 0 ? (p.valor / porRegime.total) * 100 : 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Compra de fornecedor do Simples tende a gerar menos crédito de IBS/CBS.
          </p>
        </Box>

        <Box titulo="Curva ABC">
          <div className="space-y-2">
            {abc.resumo.map((r) => (
              <div
                key={r.curva}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2"
              >
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  {r.curva}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.n} forn. ({pct(r.share)})
                </span>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {brl(r.valor)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Curva A concentra ~80% do volume; é onde a renegociação tem maior efeito.
          </p>
        </Box>

        <Box titulo="Pulverização de fornecedores">
          <p className="font-presentation-display text-2xl text-foreground">{brl(cauda.valor)}</p>
          <p className="text-xs text-muted-foreground">
            {pct(cauda.share)} do volume em {cauda.n} fornecedor(es) com menos de 1% cada
          </p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              Ticket médio: <span className="tabular-nums">{brl(cauda.ticket)}</span>
            </p>
            <p>
              Mediana: <span className="tabular-nums">{brl(cauda.mediana)}</span>
            </p>
            <p>
              Maior fornecedor:{" "}
              <span className="tabular-nums">
                {sec4.concentracaoTopPct == null ? "—" : pct(sec4.concentracaoTopPct)}
              </span>
            </p>
          </div>
        </Box>
      </div>

      {/* tabela analítica */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Todos fornecedores</p>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["todos", "Todos"],
                ["simples", "Simples"],
                ["regular", "Normal"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(k)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filtro === k
                    ? "bg-navy text-navy-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou CNPJ"
              className="h-8 w-44 rounded-full border border-border bg-background px-3 text-xs outline-none focus:border-lavender"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            Marque de 2 a 4 fornecedores para comparar lado a lado
            {comparar.length > 0 ? ` · ${comparar.length} selecionado(s)` : ""}
          </p>
          <div className="flex items-center gap-2">
            {comparar.length > 0 ? (
              <button
                type="button"
                onClick={() => setComparar([])}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            ) : null}
            <button
              type="button"
              disabled={comparar.length < 2}
              onClick={() => setModoComparar(true)}
              className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-navy-foreground transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Comparar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-2 font-semibold" />
                <th className="px-4 py-2 font-semibold">Fornecedor</th>
                <th className="px-4 py-2 text-right font-semibold">Total bruto</th>
                <th className="px-4 py-2 text-right font-semibold">Total crédito</th>
                <th className="px-4 py-2 text-right font-semibold">Itens</th>
                <th className="px-4 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((f, i) => {
                const share = abc.total > 0 ? (f.valorBase / abc.total) * 100 : 0;
                const det = detalheDe(f);
                return (
                  <tr
                    key={`${f.cnpj ?? f.nome ?? "x"}-${i}`}
                    className={`border-t border-border/70 ${det ? "cursor-pointer hover:bg-secondary/40" : ""}`}
                    onClick={det ? () => setSelecionado(det.chave) : undefined}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      {det ? (
                        <input
                          type="checkbox"
                          aria-label="Selecionar para comparar"
                          checked={comparar.includes(det.chave)}
                          onChange={() => alternar(det.chave)}
                          className="h-4 w-4 cursor-pointer accent-[#7c6cf5]"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-foreground">
                        {f.nome ?? f.cnpj ?? "Sem identificação"}
                        {det ? (
                          <span className="ml-2 text-[11px] font-semibold text-lavender">
                            ver detalhe →
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.cnpj ?? "CNPJ não informado"} · {regimeLabel(f.regime)}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(f.valorBase)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {brl(f.valorApurado)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {f.itens}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                          <span
                            className="block h-full rounded-full bg-lavender"
                            style={{ width: `${Math.min(100, share)}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {pct(share)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-foreground">{filtrada.length} fornecedor(es)</td>
                <td className="px-4 py-2 text-right tabular-nums">{brl(totalFiltrado.base)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{brl(totalFiltrado.credito)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalFiltrado.itens}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {pct(abc.total > 0 ? (totalFiltrado.base / abc.total) * 100 : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Itens em revisão: {sec4.pendentes}. Crédito considerado apenas para itens já classificados.
      </p>
    </div>
  );
}
