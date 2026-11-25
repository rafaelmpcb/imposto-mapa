import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { SimuladorTabs } from "@/components/simulator/SimuladorTabs";
import { Button, Field, MoneyInput, NumberInput, Notice, Select } from "@/components/simulator/ui";
import { listCasosParaAluguel } from "@/lib/aluguel.functions";
import { withAuthRetry } from "@/lib/auth-retry";
import { readSheet, type ParsedSheet } from "@/lib/carteira/parse";
import { parseAmount } from "@/lib/carteira/types";
import {
  AVISO_EQUIPARACAO,
  calcularEquiparacao,
  classificarReceita,
  indebitoSelicReal,
  resumirSegregacao,
  type CategoriaReceita,
  type LinhaReceita,
} from "@/lib/equiparacao/calculo";
import { SELIC_ATUALIZADA_ATE, SELIC_MENSAL } from "@/lib/equiparacao/selic";
import { obterSelicAtualizada } from "@/lib/equiparacao/selic.functions";
import { salvarEstudoEquiparacao } from "@/lib/equiparacao.functions";
import { lookupCnpj } from "@/lib/cnpj.functions";
import { onlyDigits } from "@/lib/cnpj/types";
import { Upload } from "lucide-react";
import { parseNfseArquivo, readNfseRawFiles } from "@/lib/nfse/parse";
import { brl } from "@/lib/tax/calc";

const TITLE = "Equiparação Hospitalar — cálculo completo";
const DESCRIPTION =
  "Estime a economia de IRPJ e CSLL e o indébito dos últimos 5 anos de clínicas médicas no Lucro Presumido, com segregação automática entre consultas e procedimentos.";

export const Route = createFileRoute("/_authenticated/equiparacao-completa")({
  head: () => ({
    meta: [
      { title: `${TITLE} | RCB Inteligência Tributária` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EquiparacaoPage,
});

const CAT_LABEL: Record<CategoriaReceita, string> = {
  procedimento: "Procedimento (8% / 12%)",
  consulta: "Consulta (32%)",
  revisar: "A revisar",
};

const ELEGIBILIDADE = [
  "Sociedade empresária (LTDA ou S/A), não sociedade simples",
  "Alvará sanitário e cumprimento das normas da Anvisa",
  "Tributação pelo Lucro Presumido no período",
  "Receitas de consultas separadas das de procedimentos",
];

function EquiparacaoPage() {
  const [receita, setReceita] = useState(0);
  const [pct, setPct] = useState(60);
  const [meses, setMeses] = useState(60);
  const [exito, setExito] = useState(20);
  const [linhas, setLinhas] = useState<LinhaReceita[]>([]);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [colDesc, setColDesc] = useState(0);
  const [colValor, setColValor] = useState(0);
  const [colData, setColData] = useState(-1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<boolean[]>(ELEGIBILIDADE.map(() => false));
  const fileRef = useRef<HTMLInputElement>(null);
  const [casos, setCasos] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [casoId, setCasoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [clinica, setClinica] = useState({ nome: "", cnpj: "", endereco: "" });
  const [selic, setSelic] = useState<{ tabela: ReadonlyArray<readonly [string, number]>; atualizadaAte: string; fonte: "bcb" | "embutida" }>({
    tabela: SELIC_MENSAL,
    atualizadaAte: SELIC_ATUALIZADA_ATE,
    fonte: "embutida",
  });
  const carregarCasos = useServerFn(listCasosParaAluguel);
  const salvar = useServerFn(salvarEstudoEquiparacao);
  const buscarCnpjFn = useServerFn(lookupCnpj);
  const carregarSelic = useServerFn(obterSelicAtualizada);

  useEffect(() => {
    void withAuthRetry(() => carregarCasos({}))
      .then((res) => setCasos(res.items))
      .catch(() => setCasos([]));
    void carregarSelic().then(setSelic).catch(() => undefined);
  }, [carregarCasos, carregarSelic]);

  const seg = useMemo(() => resumirSegregacao(linhas), [linhas]);
  const usaArquivos = linhas.length > 0;
  const fracao = usaArquivos ? seg.fracaoProcedimentos : pct / 100;
  const receitaBase = usaArquivos && seg.receitaMensalMedia > 0 ? seg.receitaMensalMedia : receita;
  const r = calcularEquiparacao({
    receitaMensal: receitaBase,
    fracaoProcedimentos: fracao,
    mesesRetroativos: meses,
    selicAcumuladaPct: 0,
    exitoPct: exito,
  });
  const ind = useMemo(
    () => indebitoSelicReal(r.economiaMensal * 3, meses, new Date(), selic.tabela),
    [r.economiaMensal, meses, selic.tabela],
  );
  const honorarios = ind.atualizado * (Math.max(0, exito) / 100);

  const buscarCnpj = async (valor: string) => {
    const digits = onlyDigits(valor);
    if (digits.length !== 14) return;
    setCnpjMsg("Buscando dados da clínica...");
    try {
      const res = await buscarCnpjFn({ data: { cnpj: digits } });
      if (res.ok) {
        setClinica({ nome: res.data.razao_social || res.data.nome_fantasia, cnpj: res.data.cnpj, endereco: res.data.endereco });
        setCnpjMsg("Dados da clínica preenchidos automaticamente.");
      } else {
        setClinica({ nome: "", cnpj: "", endereco: "" });
        setCnpjMsg(res.error);
      }
    } catch {
      setCnpjMsg("Não foi possível consultar o CNPJ agora. Tente novamente.");
    }
  };

  const onCaso = (id: string) => {
    setCasoId(id);
    const c = casos.find((x) => x.id === id);
    if (c?.cnpj) {
      setCnpjInput(c.cnpj);
      void buscarCnpj(c.cnpj);
    }
  };

  const handleSalvar = async () => {
    setAviso("");
    setSalvando(true);
    try {
      const nomeCaso = casos.find((c) => c.id === casoId)?.nome ?? (clinica.nome || undefined);
      await withAuthRetry(() =>
        salvar({
          data: {
            caseId: casoId || null,
            titulo: titulo.trim() || (nomeCaso ? `Equiparação — ${nomeCaso}` : "Estudo de equiparação hospitalar"),
            receitaMensal: receitaBase,
            fracaoProcedimentos: fracao,
            mesesRetroativos: meses,
            exitoPct: exito,
            origemSegregacao: usaArquivos ? "arquivos" : "percentual",
            segregacao: { procedimento: seg.procedimento, consulta: seg.consulta, revisar: seg.revisar, meses: seg.meses, linhas: linhas.length, clinica },
            resultado: {
              economiaMensal: r.economiaMensal,
              economiaAnual: r.economiaAnual,
              indebitoNominal: ind.nominal,
              indebitoAtualizado: ind.atualizado,
              selicMediaPct: ind.selicMediaPct,
              honorarios,
              trimestres: ind.linhas,
            },
          },
        }),
      );
      setAviso(casoId ? "Estudo salvo e registrado no histórico do Caso." : "Estudo salvo sem vínculo com Caso.");
    } catch {
      setAviso("Não foi possível salvar o estudo.");
    } finally {
      setSalvando(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMsg("");
    try {
      const list = [...files];
      const planilha = list.find((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
      if (planilha) {
        const s = await readSheet(planilha);
        const find = (re: RegExp) => s.headers.findIndex((h) => re.test(h));
        setSheet(s);
        setColDesc(Math.max(0, find(/descr|servi|procedim|hist/i)));
        setColValor(Math.max(0, find(/valor|total|vl/i)));
        setColData(find(/data|emiss|compet/i));
      }
      const notasArq = await readNfseRawFiles(list.filter((f) => !/\.(xlsx|xls|csv)$/i.test(f.name)));
      const novas: LinhaReceita[] = [];
      for (const a of notasArq) {
        for (const n of parseNfseArquivo(a)) {
          if (n.status === "xml_invalido" || n.status === "nao_e_nfse" || n.valorTotal <= 0) continue;
          const desc = n.itens.map((i) => i.descricao).filter(Boolean).join(" | ");
          const cod = n.itens[0]?.itemLc116 ?? n.codigoServico;
          novas.push({
            id: `${a.arquivo}-${novas.length}`,
            descricao: desc || `Nota ${n.numero ?? a.arquivo}${cod ? ` · cód. ${cod}` : ""}`,
            valor: n.valorTotal,
            data: n.dataEmissao,
            categoria: classificarReceita(desc, cod),
          });
        }
      }
      if (novas.length) setLinhas((prev) => [...prev, ...novas]);
      setMsg(
        `${novas.length} nota${novas.length === 1 ? "" : "s"} lida${novas.length === 1 ? "" : "s"}${planilha ? " e 1 planilha carregada — confira as colunas abaixo" : ""}.`,
      );
    } catch {
      setMsg("Não foi possível ler os arquivos. Envie XMLs de NFS-e, ZIP ou planilha (.xlsx/.csv).");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const importarPlanilha = () => {
    if (!sheet) return;
    const novas: LinhaReceita[] = [];
    sheet.rows.forEach((row, i) => {
      const valor = parseAmount(row[colValor] ?? "") ?? 0;
      if (!valor || valor <= 0) return;
      const descricao = (row[colDesc] ?? "").toString();
      const rawData = colData >= 0 ? (row[colData] ?? "").toString() : "";
      const m = rawData.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const data = m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}/.test(rawData) ? rawData : null;
      novas.push({ id: `pl-${i}`, descricao, valor, data, categoria: classificarReceita(descricao, null) });
    });
    setLinhas((prev) => [...prev.filter((l) => !l.id.startsWith("pl-")), ...novas]);
    setSheet(null);
    setMsg(`${novas.length} linhas da planilha classificadas.`);
  };

  const setCat = (id: string, categoria: CategoriaReceita) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, categoria } : l)));
  const setCatTodasRevisar = (categoria: CategoriaReceita) =>
    setLinhas((prev) => prev.map((l) => (l.categoria === "revisar" ? { ...l, categoria } : l)));

  return (
    <main className="min-h-screen bg-background">
      <div className="print:hidden">
        <SimuladorTabs />
      </div>
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
            Tese tributária · Lei 9.249/95 · Tema 217/STJ
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">{TITLE}</h1>
          <p className="mt-3 max-w-3xl text-sm text-navy-foreground/80">{DESCRIPTION}</p>
        </div>
      </header>

      {clinica.nome ? (
        <div className="mx-auto max-w-6xl px-5 pt-8">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Estudo elaborado para</p>
            <p className="mt-1 font-display text-xl font-bold">{clinica.nome}</p>
            <p className="text-sm text-muted-foreground">CNPJ {clinica.cnpj}{clinica.endereco ? ` · ${clinica.endereco}` : ""}</p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-6">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 print:hidden">
            <h2 className="font-display text-lg font-bold">Caso da clínica</h2>
            <Field label="Vincular ao Caso">
              <Select value={casoId} onChange={(e) => onCaso(e.target.value)}>
                <option value="">Sem vínculo</option>
                {casos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cnpj ? ` · ${c.cnpj}` : ""}</option>)}
              </Select>
            </Field>
            <Field label="CNPJ da clínica" hint={cnpjMsg || "Digite o CNPJ: nome e endereço são preenchidos automaticamente."}>
              <input
                value={cnpjInput}
                onChange={(e) => { setCnpjInput(e.target.value); if (onlyDigits(e.target.value).length === 14) void buscarCnpj(e.target.value); }}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="Título do estudo (opcional)">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" placeholder="Equiparação — nome da clínica" />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">1. Dados da clínica</h2>
            <Field label="Faturamento médio mensal" {...(usaArquivos && seg.receitaMensalMedia > 0 ? { hint: `Usando a média dos arquivos: ${brl(seg.receitaMensalMedia)}` } : {})}>
              <MoneyInput value={receita} onChange={setReceita} />
            </Field>
            <Field label="Meses no Lucro Presumido sem a equiparação" hint="Limitado aos últimos 60 meses (prescrição).">
              <NumberInput value={meses} onChange={setMeses} suffix="meses" max={60} />
            </Field>
            <Field label="Honorários de êxito">
              <NumberInput value={exito} onChange={setExito} suffix="%" />
            </Field>
            <Notice>
              {selic.fonte === "bcb"
                ? `Selic sincronizada automaticamente com o Banco Central (dados até ${selic.atualizadaAte.split("-").reverse().join("/")}).`
                : `Correção pela Selic oficial do Banco Central (tabela interna até ${selic.atualizadaAte.split("-").reverse().join("/")}; a atualização automática será tentada de novo ao abrir a página).`}
            </Notice>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">2. Segregação das receitas</h2>
            {!usaArquivos ? (
              <Field label={`Procedimentos e exames: ${pct}% da receita`} hint="Estimativa rápida. Envie as notas abaixo para calcular com os dados reais.">
                <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-[var(--color-navy)]" />
              </Field>
            ) : (
              <Notice>
                Segregação calculada pelos arquivos: {(seg.fracaoProcedimentos * 100).toFixed(1)}% em procedimentos.
                {seg.revisar > 0 ? ` ${brl(seg.revisar)} ainda está "a revisar" e não entra no percentual.` : ""}
              </Notice>
            )}
            <div
              className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors print:hidden ${arrastando ? "border-accent bg-accent/10" : "border-input"}`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); void onFiles(e.dataTransfer.files); }}
            >
              <p className="text-sm font-semibold">Segregação automática</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Envie os XMLs das NFS-e emitidas (ou um ZIP) ou a planilha de faturamento do sistema da clínica. O sistema separa consultas e procedimentos pela descrição e pelo código do serviço.
              </p>
              <input ref={fileRef} type="file" multiple accept=".xml,.json,.zip,.xlsx,.xls,.csv" onChange={(e) => void onFiles(e.target.files)} className="hidden" disabled={busy} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground shadow-md transition hover:opacity-90 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {busy ? "Lendo arquivos..." : "Selecionar arquivos (XML, ZIP ou planilha)"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">ou arraste os arquivos para esta área</p>
              {msg ? <p className="mt-3 text-sm font-medium text-foreground">{msg}</p> : null}
            </div>

            {sheet ? (
              <div className="space-y-3 rounded-lg bg-secondary p-4">
                <p className="text-sm font-semibold">Colunas da planilha {sheet.fileName}</p>
                {([["Descrição do serviço", colDesc, setColDesc, false], ["Valor", colValor, setColValor, false], ["Data (opcional)", colData, setColData, true]] as const).map(([label, v, set, opt]) => (
                  <Field key={label} label={label}>
                    <Select value={v} onChange={(e) => set(Number(e.target.value))}>
                      {opt ? <option value={-1}>Sem data</option> : null}
                      {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                    </Select>
                  </Field>
                ))}
                <Button onClick={importarPlanilha}>Classificar linhas</Button>
              </div>
            ) : null}

            {usaArquivos ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {(["procedimento", "consulta", "revisar"] as const).map((c) => (
                    <div key={c} className="rounded-lg bg-secondary p-2">
                      <p className="text-muted-foreground">{CAT_LABEL[c]}</p>
                      <p className="font-bold">{brl(seg[c])}</p>
                    </div>
                  ))}
                </div>
                {seg.revisar > 0 ? (
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <Button variant="ghost" onClick={() => setCatTodasRevisar("procedimento")}>"A revisar" → procedimento</Button>
                    <Button variant="ghost" onClick={() => setCatTodasRevisar("consulta")}>"A revisar" → consulta</Button>
                  </div>
                ) : null}
                <div className="max-h-80 overflow-auto rounded-lg border border-border print:hidden">
                  <table className="w-full text-xs">
                    <tbody>
                      {[...linhas].sort((a, b) => (a.categoria === "revisar" ? -1 : 0) - (b.categoria === "revisar" ? -1 : 0)).map((l) => (
                        <tr key={l.id} className="border-b border-border">
                          <td className="p-2">{l.descricao || "—"}</td>
                          <td className="whitespace-nowrap p-2 text-right">{brl(l.valor)}</td>
                          <td className="p-2">
                            <select value={l.categoria} onChange={(e) => setCat(l.id, e.target.value as CategoriaReceita)} className="rounded border border-input bg-card px-1 py-1">
                              {(Object.keys(CAT_LABEL) as CategoriaReceita[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="ghost" onClick={() => setLinhas([])}>Limpar arquivos</Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">3. Elegibilidade</h2>
            {ELEGIBILIDADE.map((t, i) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={check[i]} onChange={() => setCheck((p) => p.map((v, j) => (j === i ? !v : v)))} className="mt-1" />
                {t}
              </label>
            ))}
            {check.some((c) => !c) ? <p className="text-xs text-muted-foreground">Itens não confirmados devem ser verificados antes da proposta.</p> : null}
          </div>
        </section>

        <section className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl bg-navy p-6 text-navy-foreground">
            <p className="text-xs uppercase tracking-widest text-navy-foreground/70">Indébito estimado (corrigido pela Selic real)</p>
            <p className="mt-1 font-display text-4xl font-bold">{brl(ind.atualizado)}</p>
            <p className="mt-1 text-xs text-navy-foreground/70">Nominal {brl(ind.nominal)} · {ind.linhas.length} trimestres · Selic média {ind.selicMediaPct.toFixed(2)}%</p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-navy-foreground/70">Economia mensal</p><p className="text-xl font-bold">{brl(r.economiaMensal)}</p></div>
              <div><p className="text-navy-foreground/70">Economia anual</p><p className="text-xl font-bold">{brl(r.economiaAnual)}</p></div>
              <div><p className="text-navy-foreground/70">Procedimentos</p><p className="text-xl font-bold">{(fracao * 100).toFixed(1)}%</p></div>
              <div><p className="text-navy-foreground/70">Honorários de êxito</p><p className="text-xl font-bold">{brl(honorarios)}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-bold">Comparativo por trimestre</h3>
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1"></th><th className="text-right">Atual (32%)</th><th className="text-right">Equiparado</th></tr></thead>
              <tbody>
                {([["Base IRPJ", "baseIrpj"], ["IRPJ + adicional", "irpj"], ["Base CSLL", "baseCsll"], ["CSLL (9%)", "csll"], ["Total", "total"]] as const).map(([l, k]) => (
                  <tr key={k} className={`border-t border-border ${k === "total" ? "font-bold" : ""}`}>
                    <td className="py-1.5">{l}</td>
                    <td className="text-right">{brl(r.atual[k])}</td>
                    <td className="text-right">{brl(r.equiparado[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ind.linhas.length > 0 && r.economiaMensal > 0 ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display font-bold">Memória de cálculo — Selic por trimestre</h3>
              <div className="mt-3 max-h-72 overflow-auto print:max-h-none">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-1">Trimestre</th><th>Pago em</th><th className="text-right">Nominal</th><th className="text-right">Selic</th><th className="text-right">Atualizado</th></tr></thead>
                  <tbody>
                    {ind.linhas.map((l) => (
                      <tr key={l.trimestre} className="border-t border-border">
                        <td className="py-1">{l.trimestre}</td>
                        <td>{l.pagamento.split("-").reverse().join("/")}</td>
                        <td className="text-right">{brl(l.nominal)}</td>
                        <td className="text-right">{l.selicPct.toFixed(2)}%</td>
                        <td className="text-right">{brl(l.atualizado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <Notice tone="warning">{AVISO_EQUIPARACAO}</Notice>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button onClick={() => void handleSalvar()} disabled={salvando || r.economiaMensal <= 0}>
              {salvando ? "Salvando..." : casoId ? "Salvar no Caso" : "Salvar estudo"}
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>Baixar relatório (PDF)</Button>
          </div>
          {aviso ? <p className="text-sm text-muted-foreground print:hidden">{aviso}</p> : null}
        </section>
      </div>
    </main>
  );
}
