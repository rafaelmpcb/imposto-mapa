/**
 * Aba "Clientes e crédito transferido" do relatório executivo.
 * Camada puramente visual: consome o snapshot já compilado (sec5.clientes).
 * Não recalcula débito, crédito ou classificação — apenas organiza e apresenta.
 * Aqui, "crédito transferido" é o IBS/CBS destacado nas notas emitidas ao
 * cliente, que ele aproveita como crédito quando é contribuinte do regime normal.
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

import { brl } from "@/lib/tax/calc";
import type { ClienteDetalheSnap } from "@/lib/parecer/tipos";

const COR_NORMAL = "#12234a";
const COR_SIMPLES = "#e05fa8";
const COR_OUTRO = "#c7cbd6";
const CORES_COMPARA = ["#7c6cf5", "#12234a", "#2ec4a6", "#f97316"];

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const competenciaLabel = (c: string) => {
  if (!/^\d{4}-\d{2}$/.test(c)) return c;
  const [ano, mes] = c.split("-");
  return `${mes}/${ano!.slice(2)}`;
};

const dataLabel = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "sem data");

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

/** Visão detalhada de um cliente: faturamento, notas e crédito transferido. */
function DetalheCliente({
  d,
  totalBase,
  onVoltar,
}: {
  d: ClienteDetalheSnap;
  totalBase: number;
  onVoltar: () => void;
}) {
  const serie = d.meses.map((m) => ({
    mes: competenciaLabel(m.competencia),
    vendas: m.valorBase,
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
            ← Voltar para todos clientes
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
          Gerar defesa de margem / negociação
        </button>
      </div>

      <FichaNegociacaoDialog
        aberto={ficha}
        onOpenChange={setFicha}
        relacao="cliente"
        detalhe={d}
        totalBase={totalBase}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Box titulo="Total faturado">
          <p className="font-presentation-display text-2xl text-foreground">{brl(d.valorBase)}</p>
          <p className="text-xs text-muted-foreground">{pct(share)} do faturamento analisado</p>
        </Box>
        <Box titulo="Crédito transferido de IBS/CBS">
          <p className="font-presentation-display text-2xl text-foreground">{brl(d.credito)}</p>
          <p className="text-xs text-muted-foreground">{pct(efetiva)} sobre a base deste cliente</p>
        </Box>
        <Box titulo="Itens classificados">
          <p className="font-presentation-display text-2xl text-foreground">{d.itens}</p>
          <p className="text-xs text-muted-foreground">{d.pendentes} em revisão</p>
        </Box>
        <Box titulo="Custo líquido para o cliente">
          <p className="font-presentation-display text-2xl text-foreground">
            {brl(d.regime === "simples" ? d.valorBase : d.valorBase - d.credito)}
          </p>
          <p className="text-xs text-muted-foreground">
            {d.regime === "simples"
              ? "Optante do Simples não aproveita o crédito"
              : "Valor faturado menos o crédito aproveitável"}
          </p>
        </Box>
      </div>

      <Box titulo="Faturamento, crédito transferido e participação">
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
                  width={70}
                />
                <YAxis
                  yAxisId="p"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  unit="%"
                />
                <Tooltip
                  formatter={(v: number, n: string) =>
                    n === "Participação" ? pct(v) : brl(v)
                  }
                />
                <Bar yAxisId="v" dataKey="vendas" name="Faturado" fill="#7c6cf5" radius={[4, 4, 0, 0]} />
                <Bar
                  yAxisId="v"
                  dataKey="credito"
                  name="Crédito transferido"
                  fill="#2ec4a6"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="p"
                  type="monotone"
                  dataKey="participacao"
                  name="Participação"
                  stroke="#12234a"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Box>

      <div className="grid gap-4 lg:grid-cols-2">
        <Box titulo="Principais NCM/NBS faturados">
          {d.topNcms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem itens classificados.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {d.topNcms.map((n) => (
                  <tr key={n.ncm} className="border-t border-border/70 first:border-0">
                    <td className="py-2">
                      <p className="text-foreground">{n.ncm}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {n.descricao ?? "sem descrição"}
                      </p>
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {brl(n.valorBase)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {brl(n.credito)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Box>

        <Box titulo="Notas emitidas">
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 font-semibold">Nota</th>
                  <th className="py-1 text-right font-semibold">Valor</th>
                  <th className="py-1 text-right font-semibold">Crédito</th>
                </tr>
              </thead>
              <tbody>
                {d.notas.map((n, i) => (
                  <tr key={`${n.chave ?? n.numero ?? i}`} className="border-t border-border/70">
                    <td className="py-2">
                      <p className="text-foreground">
                        {n.numero ? `nº ${n.numero}` : "sem número"}
                        {n.serie ? ` · série ${n.serie}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{dataLabel(n.data)}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {brl(n.valorTotal)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {brl(n.credito)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      </div>
    </div>
  );
}

/** Comparação lado a lado de 2 a 4 clientes. */
function CompararClientes({
  itens,
  totalBase,
  onFechar,
}: {
  itens: ClienteDetalheSnap[];
  totalBase: number;
  onFechar: () => void;
}) {
  const meses = [...new Set(itens.flatMap((d) => d.meses.map((m) => m.competencia)))].sort();
  const serie = meses.map((c) => {
    const linha: Record<string, string | number> = { mes: competenciaLabel(c) };
    itens.forEach((d, i) => {
      const m = d.meses.find((x) => x.competencia === c);
      linha[`v${i}`] = m?.valorBase ?? 0;
      linha[`p${i}`] = Number((m?.participacaoPct ?? 0).toFixed(2));
    });
    return linha;
  });

  const linhas: { label: string; valor: (d: ClienteDetalheSnap) => string }[] = [
    { label: "Regime", valor: (d) => regimeLabel(d.regime) },
    { label: "Total faturado", valor: (d) => brl(d.valorBase) },
    {
      label: "Participação no faturamento",
      valor: (d) => pct(totalBase > 0 ? (d.valorBase / totalBase) * 100 : 0),
    },
    { label: "Crédito transferido", valor: (d) => brl(d.credito) },
    {
      label: "Alíquota efetiva",
      valor: (d) => pct(d.valorBase > 0 ? (d.credito / d.valorBase) * 100 : 0),
    },
    {
      label: "Custo líquido para o cliente",
      valor: (d) => brl(d.regime === "simples" ? d.valorBase : d.valorBase - d.credito),
    },
    { label: "Notas emitidas", valor: (d) => String(d.notas.length) },
    { label: "Itens classificados", valor: (d) => String(d.itens) },
    { label: "Itens em revisão", valor: (d) => String(d.pendentes) },
    { label: "Meses com movimento", valor: (d) => String(d.meses.length) },
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onFechar}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Voltar para todos clientes
      </button>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Indicador</th>
              {itens.map((d, i) => (
                <th key={d.chave} className="px-4 py-2 font-semibold">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ background: CORES_COMPARA[i] }}
                  />
                  {d.nome ?? d.cnpj ?? "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.label} className="border-t border-border/70">
                <td className="px-4 py-2 text-muted-foreground">{l.label}</td>
                {itens.map((d) => (
                  <td key={d.chave} className="px-4 py-2 tabular-nums text-foreground">
                    {l.valor(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Box titulo="Faturamento e participação mês a mês">
        {serie.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem datas de emissão nas notas.</p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ef" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="v" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                <YAxis
                  yAxisId="p"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  unit="%"
                />
                <Tooltip
                  formatter={(v: number, n: string) => (n.startsWith("Part.") ? pct(v) : brl(v))}
                />
                {itens.map((d, i) => (
                  <Bar
                    key={`b${d.chave}`}
                    yAxisId="v"
                    dataKey={`v${i}`}
                    name={`Faturado · ${d.nome ?? d.cnpj ?? "—"}`}
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
        Crédito transferido considera apenas itens já classificados; itens em revisão ficam fora.
      </p>
    </div>
  );
}

export function ParecerClientes({ clientes }: { clientes: ClienteDetalheSnap[] }) {
  const [filtro, setFiltro] = useState<"todos" | "simples" | "regular">("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string[]>([]);
  const [modoComparar, setModoComparar] = useState(false);

  const totais = useMemo(
    () =>
      clientes.reduce(
        (a, c) => ({
          base: a.base + c.valorBase,
          credito: a.credito + c.credito,
          pendentes: a.pendentes + c.pendentes,
        }),
        { base: 0, credito: 0, pendentes: 0 },
      ),
    [clientes],
  );

  const porRegime = useMemo(() => {
    const acc = { regular: 0, simples: 0, outro: 0 };
    const cred = { regular: 0, simples: 0, outro: 0 };
    for (const c of clientes) {
      const k = c.regime === "simples" ? "simples" : c.regime === "regular" ? "regular" : "outro";
      acc[k] += c.valorBase;
      cred[k] += c.credito;
    }
    const total = acc.regular + acc.simples + acc.outro;
    return {
      total,
      creditoAproveitavel: cred.regular,
      creditoPerdido: cred.simples,
      partes: [
        { nome: "Regime Normal (aproveita crédito)", valor: acc.regular, cor: COR_NORMAL },
        { nome: "Simples Nacional (não aproveita)", valor: acc.simples, cor: COR_SIMPLES },
        { nome: "Não classificado", valor: acc.outro, cor: COR_OUTRO },
      ].filter((p) => p.valor > 0),
    };
  }, [clientes]);

  const abc = useMemo(() => {
    const ordenada = [...clientes].sort((a, b) => b.valorBase - a.valorBase);
    const total = ordenada.reduce((a, c) => a + c.valorBase, 0);
    const grupos = { A: [] as ClienteDetalheSnap[], B: [] as ClienteDetalheSnap[], C: [] as ClienteDetalheSnap[] };
    let acumulado = 0;
    for (const c of ordenada) {
      const antes = total > 0 ? acumulado / total : 0;
      if (antes < 0.8) grupos.A.push(c);
      else if (antes < 0.95) grupos.B.push(c);
      else grupos.C.push(c);
      acumulado += c.valorBase;
    }
    const resumo = (["A", "B", "C"] as const).map((k) => {
      const itens = grupos[k];
      const valor = itens.reduce((a, c) => a + c.valorBase, 0);
      return { curva: `Curva ${k}`, n: itens.length, valor, share: total > 0 ? (valor / total) * 100 : 0 };
    });
    return { total, resumo, ordenada };
  }, [clientes]);

  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return abc.ordenada.filter((c) => {
      const reg = c.regime === "simples" ? "simples" : c.regime === "regular" ? "regular" : "outro";
      if (filtro !== "todos" && reg !== filtro) return false;
      if (!termo) return true;
      return `${c.nome ?? ""} ${c.cnpj ?? ""}`.toLowerCase().includes(termo);
    });
  }, [abc.ordenada, filtro, busca]);

  if (clientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Sem notas de venda ou de serviço prestado processadas neste Caso. Gere uma nova versão do
        parecer após enviar os documentos.
      </div>
    );
  }

  const aberto = selecionado ? clientes.find((c) => c.chave === selecionado) : undefined;
  if (aberto) {
    return <DetalheCliente d={aberto} totalBase={abc.total} onVoltar={() => setSelecionado(null)} />;
  }

  const selecionados = clientes.filter((c) => comparar.includes(c.chave));
  if (modoComparar && selecionados.length >= 2) {
    return (
      <CompararClientes
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

  const maior = abc.ordenada[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Box titulo="Faturamento analisado" className="border-transparent bg-lavender-soft">
          <p className="font-presentation-display text-2xl text-foreground">{brl(totais.base)}</p>
          <p className="text-xs text-muted-foreground">{clientes.length} cliente(s)</p>
        </Box>
        <Box titulo="Crédito transferido total" className="border-transparent bg-mint-soft">
          <p className="font-presentation-display text-2xl text-foreground">{brl(totais.credito)}</p>
          <p className="text-xs text-muted-foreground">
            {pct(totais.base > 0 ? (totais.credito / totais.base) * 100 : 0)} sobre o faturamento
          </p>
        </Box>
        <Box titulo="Crédito aproveitável pelo cliente" className="border-transparent bg-sky-soft">
          <p className="font-presentation-display text-2xl text-foreground">
            {brl(porRegime.creditoAproveitavel)}
          </p>
          <p className="text-xs text-muted-foreground">Clientes do regime normal</p>
        </Box>
        <Box titulo="Crédito sem aproveitamento" className="border-transparent bg-magenta-soft">
          <p className="font-presentation-display text-2xl text-foreground">
            {brl(porRegime.creditoPerdido)}
          </p>
          <p className="text-xs text-muted-foreground">Clientes optantes do Simples</p>
        </Box>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Box titulo="Perfil dos clientes por regime">
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
                    <p className="text-xs text-muted-foreground">{p.nome}</p>
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
            Cliente do regime normal recupera o IBS/CBS destacado; para ele, o que pesa é o preço
            líquido de crédito, e não o valor cheio da nota.
          </p>
        </Box>

        <Box titulo="Curva ABC de clientes">
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
                  {r.n} cliente(s) ({pct(r.share)})
                </span>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {brl(r.valor)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Curva A concentra ~80% do faturamento: é onde um pedido de revisão contratual tem maior
            efeito.
          </p>
        </Box>

        <Box titulo="Maior cliente">
          <p className="truncate font-presentation-display text-xl text-foreground">
            {maior?.nome ?? maior?.cnpj ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{regimeLabel(maior?.regime)}</p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              Faturado: <span className="tabular-nums">{brl(maior?.valorBase ?? 0)}</span>
            </p>
            <p>
              Participação:{" "}
              <span className="tabular-nums">
                {pct(abc.total > 0 ? ((maior?.valorBase ?? 0) / abc.total) * 100 : 0)}
              </span>
            </p>
            <p>
              Crédito transferido:{" "}
              <span className="tabular-nums">{brl(maior?.credito ?? 0)}</span>
            </p>
          </div>
        </Box>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Todos clientes</p>
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
            Marque de 2 a 4 clientes para comparar lado a lado
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
                <th className="px-4 py-2 font-semibold">Cliente</th>
                <th className="px-4 py-2 text-right font-semibold">Faturado</th>
                <th className="px-4 py-2 text-right font-semibold">Crédito transferido</th>
                <th className="px-4 py-2 text-right font-semibold">Custo líquido</th>
                <th className="px-4 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((c) => {
                const share = abc.total > 0 ? (c.valorBase / abc.total) * 100 : 0;
                const liquido = c.regime === "simples" ? c.valorBase : c.valorBase - c.credito;
                return (
                  <tr
                    key={c.chave}
                    className="cursor-pointer border-t border-border/70 hover:bg-secondary/40"
                    onClick={() => setSelecionado(c.chave)}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Selecionar para comparar"
                        checked={comparar.includes(c.chave)}
                        onChange={() => alternar(c.chave)}
                        className="h-4 w-4 cursor-pointer accent-[#7c6cf5]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-foreground">
                        {c.nome ?? c.cnpj ?? "Sem identificação"}
                        <span className="ml-2 text-[11px] font-semibold text-lavender">
                          ver detalhe →
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.cnpj ?? "CNPJ não informado"} · {regimeLabel(c.regime)} ·{" "}
                        {c.notas.length} nota(s)
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(c.valorBase)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {brl(c.credito)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(liquido)}
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
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Itens em revisão: {totais.pendentes}. O custo líquido supõe que o cliente do regime normal
        aproveita integralmente o crédito destacado; optantes do Simples não aproveitam.
      </p>
    </div>
  );
}
