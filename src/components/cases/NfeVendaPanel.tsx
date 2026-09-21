import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  applyNotasVenda,
  classifyClientesVenda,
  getClientesExistentes,
  saveNotasVenda,
} from "@/lib/nfe-venda.functions";
import {
  aggregateVendas,
  readNfeVendaFiles,
  type NfeVendaNota,
} from "@/lib/nfe/parse-venda";
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
  /** Ainda não consultado nesta sessão. */
  pendente: boolean;
}

const REGIME_OPTIONS: { value: Regime; label: string }[] = [
  { value: "simples", label: "Simples Nacional" },
  { value: "regular", label: "Regime Regular" },
  { value: "erro", label: "Não classificado" },
];

const cacheKey = (caseId: string) => `nfe-venda-draft:${caseId}`;

export function NfeVendaPanel({
  caseId,
  onApplied,
}: {
  caseId: string;
  onApplied: () => void | Promise<void>;
}) {
  const save = useServerFn(saveNotasVenda);
  const apply = useServerFn(applyNotasVenda);
  const classify = useServerFn(classifyClientesVenda);
  const existentesFn = useServerFn(getClientesExistentes);

  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState<NfeVendaNota[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [existentes, setExistentes] = useState<string[]>([]);
  const [substituir, setSubstituir] = useState(true);
  const [busy, setBusy] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // retoma o rascunho deixado na sessão anterior (processamento resumível)
  useEffect(() => {
    const raw = localStorage.getItem(cacheKey(caseId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { notas: NfeVendaNota[]; drafts: DraftRow[] };
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
  const pendentes = drafts.filter((d) => d.pendente);
  const semRegime = drafts.filter((d) => d.regime === "erro" && !d.pendente);
  const conferido = drafts.length > 0 && pendentes.length === 0 && semRegime.length === 0;
  const conflitos = drafts.filter((d) => existentes.includes(d.cnpj));

  const patch = (cnpj: string, values: Partial<DraftRow>) =>
    setDrafts((prev) => prev.map((row) => (row.cnpj === cnpj ? { ...row, ...values } : row)));

  /** Consulta em fila, em lotes, para não disparar tudo de uma vez. */
  const classificar = async (alvos: string[]) => {
    if (alvos.length === 0) return;
    setClassificando(true);
    try {
      for (let i = 0; i < alvos.length; i += 8) {
        const lote = alvos.slice(i, i + 8);
        try {
          const res = await withAuthRetry(() => classify({ data: { cnpjs: lote } }));
          setDrafts((prev) =>
            prev.map((row) => {
              const found = res.results.find((r) => r.cnpj === row.cnpj);
              if (!found) return row;
              return { ...row, regime: found.regime, fonte: found.fonte, pendente: false };
            }),
          );
        } catch {
          setDrafts((prev) =>
            prev.map((row) =>
              lote.includes(row.cnpj) ? { ...row, regime: "erro", pendente: false } : row,
            ),
          );
        }
      }
    } finally {
      setClassificando(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let lidas: NfeVendaNota[];
      try {
        lidas = await readNfeVendaFiles(Array.from(files));
      } catch {
        setError("Não foi possível ler os arquivos. Envie .xml de NF-e ou um .zip com as notas.");
        return;
      }
      if (lidas.length === 0) {
        setError("Nenhum XML de NF-e encontrado nos arquivos enviados.");
        return;
      }
      setNotas(lidas);
      const agregados = aggregateVendas(lidas);
      setDrafts(
        agregados.map((a) => ({
          cnpj: a.cnpj,
          nome: a.nome,
          valor: a.valor,
          notas: a.notas,
          regime: "erro" as Regime,
          fonte: "",
          pendente: true,
        })),
      );
      setOpen(true);
      setStatus(`${lidas.length} nota(s) lida(s) · ${agregados.length} cliente(s) encontrado(s).`);

      try {
        await withAuthRetry(() => save({ data: { caseId, notas: lidas } }));
      } catch {
        setError(
          "Os arquivos foram lidos, mas não foi possível registrar as notas agora. Você ainda pode conferir e salvar a composição.",
        );
      }
      try {
        const res = await withAuthRetry(() => existentesFn({ data: { caseId } }));
        setExistentes(res.cnpjs);
      } catch {
        /* aviso de conflito é opcional */
      }
      await classificar(agregados.map((a) => a.cnpj));
    } finally {
      setBusy(false);
    }
  };

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
              fonte: d.fonte,
            })),
          },
        }),
      );
      setDrafts([]);
      setNotas([]);
      setOpen(false);
      setStatus(`${res.inserted} cliente(s) gravados na composição de carteira.`);
      await onApplied();
    } catch {
      setError("Não foi possível gravar os clientes na composição de carteira.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-input p-3">
      <p className="text-sm font-semibold text-foreground">
        Notas fiscais de venda (XML de NF-e)
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Via alternativa ao relatório de clientes: envie vários .xml de NF-e de venda ou um .zip com
        as notas. O regime de cada cliente é consultado pelo CNPJ do destinatário.
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
            {notas.length === 1 ? "" : "s"} · {drafts.length} cliente
            {drafts.length === 1 ? "" : "s"}
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
            <table className="w-full min-w-[860px] text-left text-sm">
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
                      {row.pendente ? (
                        <span className="text-xs text-muted-foreground">Consultando…</span>
                      ) : (
                        <select
                          value={row.regime}
                          onChange={(e) =>
                            patch(row.cnpj, { regime: e.target.value as Regime })
                          }
                          className="rounded border border-input bg-card px-2 py-1 text-sm"
                        >
                          {REGIME_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <input
                          value={row.fonte}
                          onChange={(e) => patch(row.cnpj, { fonte: e.target.value })}
                          placeholder="—"
                          className="w-52 rounded border border-input bg-card px-2 py-1 text-xs"
                        />
                        {!row.pendente && row.regime === "erro" ? (
                          <button
                            type="button"
                            className="whitespace-nowrap rounded border border-input px-2 py-1 text-xs font-semibold text-navy hover:bg-secondary"
                            onClick={() => {
                              patch(row.cnpj, { pendente: true });
                              void classificar([row.cnpj]);
                            }}
                          >
                            Tentar novamente
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-muted-foreground">
            {drafts.length} cliente{drafts.length === 1 ? "" : "s"} ·{" "}
            {brl(drafts.reduce((acc, d) => acc + d.valor, 0))} em vendas
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
                    {n.status === "sem_cnpj_destinatario"
                      ? "não classificável — sem CNPJ do destinatário"
                      : n.status === "nao_e_nfe"
                        ? "arquivo não é uma NF-e"
                        : "XML inválido"}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {classificando || pendentes.length > 0 ? (
            <Notice>
              Consultando o regime de {pendentes.length} CNPJ
              {pendentes.length === 1 ? "" : "s"} na fila. Pode sair da tela e voltar depois.
            </Notice>
          ) : null}

          {!conferido && pendentes.length === 0 ? (
            <Notice tone="warning">
              {semRegime.length} cliente{semRegime.length === 1 ? "" : "s"} sem classificação. Use
              "Tentar novamente" ou informe o regime manualmente antes de gravar.
            </Notice>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || classificando || !conferido} onClick={() => void confirmar()}>
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
