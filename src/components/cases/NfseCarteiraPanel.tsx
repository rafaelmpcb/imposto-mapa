import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  FONTE_NFSE_DOCUMENTO,
  applyNotasServico,
  classifyContrapartesServico,
  getContrapartesExistentes,
  saveNotasServico,
} from "@/lib/nfse.functions";
import {
  aggregateNfse,
  parseNfseArquivo,
  readNfseRawFiles,
  type NfseArquivo,
  type NfseNota,
} from "@/lib/nfse/parse";
import { formatCnpjMask } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

type Regime = "simples" | "regular" | "erro";
type Lado = "tomado" | "prestado";

interface DraftRow {
  cnpj: string;
  nome: string;
  valor: number;
  notas: number;
  regime: Regime;
  fonte: string;
  pendente: boolean;
}

interface NaoProcessada {
  arquivo: string;
  motivo: string;
}

const REGIME_OPTIONS: { value: Regime; label: string }[] = [
  { value: "simples", label: "Simples Nacional" },
  { value: "regular", label: "Regime Regular" },
  { value: "erro", label: "Não classificado" },
];

const TIPO_POR_LADO: Record<Lado, "fornecedor" | "cliente"> = {
  tomado: "fornecedor",
  prestado: "cliente",
};

/**
 * Notas de serviço (NFS-e Nacional) alimentando a composição de carteira.
 * A direção é definida pelo botão de envio, nunca inferida do documento.
 */
export function NfseCarteiraPanel({
  caseId,
  onApplied,
}: {
  caseId: string;
  onApplied: () => void | Promise<void>;
}) {
  const salvarNotas = useServerFn(saveNotasServico);
  const classificar = useServerFn(classifyContrapartesServico);
  const existentesFn = useServerFn(getContrapartesExistentes);
  const aplicar = useServerFn(applyNotasServico);

  const [lado, setLado] = useState<Lado | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [naoProcessadas, setNaoProcessadas] = useState<NaoProcessada[]>([]);
  const [existentes, setExistentes] = useState<string[]>([]);
  const [substituir, setSubstituir] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const conflitos = useMemo(
    () => drafts.filter((d) => existentes.includes(d.cnpj)),
    [drafts, existentes],
  );
  const total = drafts.reduce((acc, d) => acc + d.valor, 0);

  const patch = (cnpj: string, values: Partial<DraftRow>) =>
    setDrafts((prev) => prev.map((row) => (row.cnpj === cnpj ? { ...row, ...values } : row)));

  /** Consulta o regime em fila, em lotes, para os CNPJs sem regime no documento. */
  const consultar = async (alvos: string[], ladoAtual: Lado) => {
    if (alvos.length === 0) return;
    for (let i = 0; i < alvos.length; i += 8) {
      const lote = alvos.slice(i, i + 8);
      try {
        const res = await withAuthRetry(() =>
          classificar({ data: { cnpjs: lote, lado: ladoAtual } }),
        );
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
  };

  const handleFiles = async (files: FileList | null, ladoAtual: Lado) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    setStatus("");
    setLado(ladoAtual);
    try {
      let brutos: { arquivo: string; xml: string }[];
      try {
        brutos = await readNfeRawFiles(Array.from(files));
      } catch {
        setError("Não foi possível ler os arquivos. Envie .xml/.json de NFS-e ou um .zip com eles.");
        return;
      }
      if (brutos.length === 0) {
        setError("Nenhum arquivo de NFS-e foi encontrado no que você enviou.");
        return;
      }

      const validas: NfseNota[] = [];
      const recusadas: NaoProcessada[] = [];
      for (const { arquivo, xml } of brutos) {
        const nota = parseNfseXml(xml, arquivo);
        if (nota.status === "ok" || nota.status === "sem_cnpj") {
          validas.push(nota);
        } else {
          recusadas.push({
            arquivo,
            motivo: "não processado — não é NFS-e Nacional reconhecida",
          });
        }
      }
      setNaoProcessadas(recusadas);

      if (validas.length === 0) {
        setDrafts([]);
        setError("Nenhuma NFS-e Nacional válida foi reconhecida nos arquivos enviados.");
        return;
      }

      const agregados = aggregateNfse(validas, ladoAtual);
      const semCnpj = validas.filter((n) =>
        ladoAtual === "tomado" ? !n.cnpjPrestador : !n.cnpjTomador,
      ).length;

      setDrafts(
        agregados.map((a) => {
          const doDocumento = ladoAtual === "tomado" ? a.regimeDocumento : null;
          return {
            cnpj: a.cnpj,
            nome: a.nome,
            valor: a.valor,
            notas: a.notas,
            regime: doDocumento ?? ("erro" as Regime),
            fonte: doDocumento ? FONTE_NFSE_DOCUMENTO : "",
            pendente: !doDocumento,
          };
        }),
      );
      setStatus(
        `${validas.length} nota(s) lida(s) · ${agregados.length} contraparte(s) · ${recusadas.length} não processada(s)` +
          (semCnpj > 0 ? ` · ${semCnpj} sem CNPJ (não classificável)` : "") +
          ".",
      );

      try {
        await withAuthRetry(() =>
          salvarNotas({ data: { caseId, notas: validas, direcao: ladoAtual } }),
        );
      } catch {
        setError(
          "As notas foram lidas, mas não foi possível registrá-las agora. Você ainda pode conferir e salvar a composição.",
        );
      }
      try {
        const res = await withAuthRetry(() =>
          existentesFn({ data: { caseId, tipo: TIPO_POR_LADO[ladoAtual] } }),
        );
        setExistentes(res.cnpjs);
      } catch {
        /* aviso de conflito é opcional */
      }
      await consultar(
        agregados.filter((a) => !(ladoAtual === "tomado" && a.regimeDocumento)).map((a) => a.cnpj),
        ladoAtual,
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmar = async () => {
    if (!lado) return;
    setBusy(true);
    setError("");
    try {
      const res = await withAuthRetry(() =>
        aplicar({
          data: {
            caseId,
            tipo: TIPO_POR_LADO[lado],
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
      setNaoProcessadas([]);
      setStatus(`${res.inserted} contraparte(s) gravada(s) na composição de carteira.`);
      await onApplied();
    } catch {
      setError("Não foi possível gravar as contrapartes na composição de carteira.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-input p-3">
      <p className="text-sm font-semibold text-foreground">Notas de serviço (NFS-e Nacional)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Envie os arquivos do Portal Nacional da NFS-e (.xml, .json ou um .zip com vários). Use o
        botão da direção certa: o serviço tomado entra como fornecedor, o serviço prestado entra como
        cliente. Leiautes municipais antigos não são reconhecidos e ficam listados à parte.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-navy hover:bg-secondary">
          Notas de serviço tomado
          <input
            type="file"
            multiple
            accept=".xml,.json,.zip"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files, "tomado")}
          />
        </label>
        <label className="cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-navy hover:bg-secondary">
          Notas de serviço prestado
          <input
            type="file"
            multiple
            accept=".xml,.json,.zip"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files, "prestado")}
          />
        </label>
        {busy ? <span className="text-xs text-muted-foreground">Processando…</span> : null}
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

      {drafts.length > 0 && lado ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-foreground">
            Conferência — {lado === "tomado" ? "fornecedores de serviço" : "clientes de serviço"}
          </p>

          {conflitos.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-medium text-foreground">
                {conflitos.length} CNPJ{conflitos.length === 1 ? "" : "s"} já existe
                {conflitos.length === 1 ? "" : "m"} na composição atual.
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={substituir} onChange={() => setSubstituir(true)} />
                  Substituir pelos dados da NFS-e
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!substituir} onChange={() => setSubstituir(false)} />
                  Manter o que já está gravado
                </label>
              </div>
            </div>
          ) : null}

          <div className="max-h-[24rem] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[880px] text-left text-sm">
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
                          patch(row.cnpj, { valor: Number(e.target.value.replace(",", ".")) || 0 })
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
                          onChange={(e) => patch(row.cnpj, { regime: e.target.value as Regime })}
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
                          className="w-56 rounded border border-input bg-card px-2 py-1 text-xs"
                        />
                        {!row.pendente && row.regime === "erro" ? (
                          <button
                            type="button"
                            className="whitespace-nowrap rounded border border-input px-2 py-1 text-xs font-semibold text-navy hover:bg-secondary"
                            onClick={() => {
                              patch(row.cnpj, { pendente: true });
                              void consultar([row.cnpj], lado);
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
            {drafts.length} contraparte{drafts.length === 1 ? "" : "s"} · {brl(total)} em serviços.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy} onClick={() => void confirmar()}>
              Confirmar e salvar
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDrafts([]);
                setNaoProcessadas([]);
                setStatus("");
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      {naoProcessadas.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-3 text-sm">
          <p className="font-medium text-foreground">
            {naoProcessadas.length} arquivo{naoProcessadas.length === 1 ? "" : "s"} não processado
            {naoProcessadas.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {naoProcessadas.map((n) => (
              <li key={n.arquivo}>
                {n.arquivo} — {n.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
