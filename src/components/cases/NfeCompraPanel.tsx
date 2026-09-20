import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  applyNotasCompra,
  classifyCnpjs,
  getFornecedoresExistentes,
  saveNotasCompra,
} from "@/lib/nfe.functions";
import { aggregateNotas, readNfeFiles, type NfeNota } from "@/lib/nfe/parse";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

type Regime = "simples" | "regular" | "erro";

interface DraftRow {
  cnpj: string;
  nome: string;
  valor: number;
  notas: number;
  regime: Regime;
  fonte: string;
  ultimaEmissao: string | null;
  classificado: boolean;
}

const REGIME_OPTIONS: { value: Regime; label: string }[] = [
  { value: "simples", label: "Simples Nacional" },
  { value: "regular", label: "Regime Regular" },
  { value: "erro", label: "Não classificado" },
];

const cacheKey = (caseId: string) => `nfe-compra-draft:${caseId}`;

export function NfeCompraPanel({
  caseId,
  onApplied,
}: {
  caseId: string;
  onApplied: () => void | Promise<void>;
}) {
  const save = useServerFn(saveNotasCompra);
  const classify = useServerFn(classifyCnpjs);
  const apply = useServerFn(applyNotasCompra);
  const existentesFn = useServerFn(getFornecedoresExistentes);

  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState<NfeNota[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [existentes, setExistentes] = useState<string[]>([]);
  const [substituir, setSubstituir] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // retoma o rascunho deixado na sessão anterior
  useEffect(() => {
    const raw = localStorage.getItem(cacheKey(caseId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { notas: NfeNota[]; drafts: DraftRow[] };
      if (parsed.drafts?.length) {
        setNotas(parsed.notas ?? []);
        setDrafts(parsed.drafts);
        setOpen(true);
      }
    } catch {
      /* rascunho inválido */
    }
  }, [caseId]);

  useEffect(() => {
    if (drafts.length === 0) localStorage.removeItem(cacheKey(caseId));
    else localStorage.setItem(cacheKey(caseId), JSON.stringify({ notas, drafts }));
  }, [caseId, notas, drafts]);

  const semCnpj = useMemo(() => notas.filter((n) => n.status !== "ok"), [notas]);
  const pendentes = drafts.filter((d) => !d.classificado);
  const conferido = drafts.length > 0 && pendentes.length === 0;
  const conflitos = drafts.filter((d) => existentes.includes(d.cnpj));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const lidas = await readNfeFiles(Array.from(files));
      if (lidas.length === 0) {
        setError("Nenhum XML de NF-e encontrado nos arquivos enviados.");
        return;
      }
      setNotas(lidas);
      const agregados = aggregateNotas(lidas);
      setDrafts(
        agregados.map((a) => ({
          cnpj: a.cnpj,
          nome: a.nome,
          valor: a.valor,
          notas: a.notas,
          regime: "erro" as Regime,
          fonte: "",
          ultimaEmissao: a.ultimaEmissao,
          classificado: false,
        })),
      );
      setOpen(true);
      await withAuthRetry(() => save({ data: { caseId, notas: lidas } }));
      const res = await withAuthRetry(() => existentesFn({ data: { caseId } }));
      setExistentes(res.cnpjs);
    } catch {
      setError("Não foi possível ler os arquivos. Envie .xml de NF-e ou um .zip com as notas.");
    } finally {
      setBusy(false);
    }
  };

  const classifyRows = async (targets: string[]) => {
    if (targets.length === 0) return;
    setBusy(true);
    setError("");
    let done = 0;
    setProgress({ done: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i += 12) {
        const slice = targets.slice(i, i + 12);
        const res = await withAuthRetry(() => classify({ data: { cnpjs: slice } }));
        setDrafts((prev) =>
          prev.map((row) => {
            const hit = res.results.find((r) => r.cnpj === row.cnpj);
            if (!hit) return row;
            return {
              ...row,
              regime: hit.regime,
              fonte: hit.fonte,
              classificado: hit.status === "ok",
            };
          }),
        );
        done += slice.length;
        setProgress({ done, total: targets.length });
      }
    } catch {
      setError("A consulta foi interrompida. Você pode tentar novamente.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const patch = (cnpj: string, values: Partial<DraftRow>) =>
    setDrafts((prev) => prev.map((row) => (row.cnpj === cnpj ? { ...row, ...values } : row)));

  const confirmar = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await withAuthRetry(() =>
        apply({
          data: {
            caseId,
            substituir,
            rows: drafts.map((d) => ({
              cnpj: d.cnpj,
              nome: d.nome,
              valor: d.valor,
              regime: d.regime,
              fonte: d.fonte || "conferência manual",
              dataClassificacao: d.ultimaEmissao,
            })),
          },
        }),
      );
      setDrafts([]);
      setNotas([]);
      setOpen(false);
      setStatus(`${res.inserted} fornecedor(es) gravados na composição de carteira.`);
      await onApplied();
    } catch {
      setError("Não foi possível gravar os fornecedores na composição de carteira.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-input p-3">
      <p className="text-sm font-semibold text-foreground">
        Notas fiscais de compra (XML de NF-e)
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Via alternativa ao relatório de fornecedores: envie vários .xml de NF-e de compra ou um
        .zip com as notas. Usamos apenas o cabeçalho da nota (emitente, valor e data).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-navy hover:bg-secondary">
          Anexar XML ou ZIP
          <input
            type="file"
            multiple
            accept=".xml,.zip"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </label>
        {notas.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {notas.length} nota{notas.length === 1 ? "" : "s"} lida
            {notas.length === 1 ? "" : "s"} · {drafts.length} fornecedor
            {drafts.length === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      ) : null}
      {status ? (
        <div className="mt-3">
          <Notice>{status}</Notice>
        </div>
      ) : null}

      {open && drafts.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={busy || pendentes.length === 0}
              onClick={() => void classifyRows(pendentes.map((d) => d.cnpj))}
            >
              {busy && progress ? "Consultando..." : "Classificar regime dos fornecedores"}
            </Button>
            {progress ? (
              <span className="text-xs text-muted-foreground">
                {progress.done} de {progress.total} CNPJs consultados
              </span>
            ) : null}
          </div>

          {conflitos.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-medium text-foreground">
                {conflitos.length} CNPJ
                {conflitos.length === 1 ? "" : "s"} já existe
                {conflitos.length === 1 ? "" : "m"} na composição atual (vindos do relatório).
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={substituir} onChange={() => setSubstituir(true)} />
                  Substituir pelos dados do XML
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!substituir} onChange={() => setSubstituir(false)} />
                  Manter o que já está gravado
                </label>
              </div>
            </div>
          ) : null}

          <div className="max-h-[24rem] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">CNPJ</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-right">Notas</th>
                  <th className="px-3 py-2">Regime</th>
                  <th className="px-3 py-2">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((row) => (
                  <tr key={row.cnpj} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        value={row.nome}
                        onChange={(e) => patch(row.cnpj, { nome: e.target.value })}
                        className="w-full rounded border border-input bg-card px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatCnpjMask(row.cnpj)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={String(row.valor)}
                        onChange={(e) =>
                          patch(row.cnpj, {
                            valor: Number(e.target.value.replace(",", ".")) || 0,
                          })
                        }
                        className="w-32 rounded border border-input bg-card px-2 py-1 text-right text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.notas}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.regime}
                        onChange={(e) =>
                          patch(row.cnpj, {
                            regime: e.target.value as Regime,
                            classificado: e.target.value !== "erro",
                            fonte: row.fonte || "conferência manual",
                          })
                        }
                        className="rounded border border-input bg-card px-2 py-1 text-sm"
                      >
                        {REGIME_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.fonte || "—"}
                      {!row.classificado && row.fonte ? (
                        <Button
                          variant="ghost"
                          onClick={() => void classifyRows([row.cnpj])}
                        >
                          Tentar novamente
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-muted-foreground">
            {drafts.length} fornecedor{drafts.length === 1 ? "" : "es"} ·{" "}
            {brl(drafts.reduce((acc, d) => acc + d.valor, 0))} em compras
          </p>

          {semCnpj.length > 0 ? (
            <details className="rounded-xl border border-border bg-secondary p-3 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">
                {semCnpj.length} nota{semCnpj.length === 1 ? "" : "s"} não aproveitada
                {semCnpj.length === 1 ? "" : "s"} (apenas informativo)
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {semCnpj.slice(0, 50).map((n, i) => (
                  <li key={`${n.arquivo}-${i}`}>
                    {n.arquivo} —{" "}
                    {n.status === "sem_cnpj_emitente"
                      ? "sem CNPJ de emitente"
                      : n.status === "nao_e_nfe"
                        ? "arquivo não é uma NF-e"
                        : "XML inválido"}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {!conferido ? (
            <Notice tone="warning">
              Classifique (ou ajuste manualmente) o regime de todos os fornecedores antes de
              gravar.
            </Notice>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !conferido} onClick={() => void confirmar()}>
              {busy ? "Gravando..." : "Confirmar e salvar"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDrafts([]);
                setNotas([]);
                setOpen(false);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
