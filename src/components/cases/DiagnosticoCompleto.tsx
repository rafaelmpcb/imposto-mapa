import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

import { Button, Notice } from "@/components/simulator/ui";
import { CarteiraResult } from "@/components/cases/CarteiraResult";
import { PgdasdPanel } from "@/components/cases/PgdasdPanel";
import { NfeUnificadoPanel } from "@/components/cases/NfeUnificadoPanel";
import { NfseCarteiraPanel } from "@/components/cases/NfseCarteiraPanel";
import { UploadUnicoPanel, type PacoteTriado } from "@/components/cases/UploadUnicoPanel";
import { PainelCargaPanel } from "@/components/cases/PainelCargaPanel";
import { SpedPanel } from "@/components/cases/SpedPanel";
import { CreditoNcmPanel } from "@/components/cases/CreditoNcmPanel";
import { DebitoNcmPanel } from "@/components/cases/DebitoNcmPanel";
import { CreditoNbsPanel } from "@/components/cases/CreditoNbsPanel";
import { DebitoNbsPanel } from "@/components/cases/DebitoNbsPanel";
import { PrecoNecessarioPanel } from "@/components/cases/PrecoNecessarioPanel";
import { RevisaoNbsPanel } from "@/components/cases/RevisaoNbsPanel";
import { ApuracaoLiquidaPanel } from "@/components/cases/ApuracaoLiquidaPanel";
import { ConcentracaoPanel } from "@/components/cases/ConcentracaoPanel";
import { DrePanel } from "@/components/cases/DrePanel";
import { FluxoCaixaPanel } from "@/components/cases/FluxoCaixaPanel";
import { SplitPaymentPanel } from "@/components/cases/SplitPaymentPanel";
import { ContratosAlugueisPanel } from "@/components/cases/ContratosAlugueisPanel";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  classifyCarteiraRowManually,
  deleteCarteiraRow,
  getCarteira,
  processCarteiraBatch,
  resetCarteiraRows,
  saveCarteira,
} from "@/lib/carteira.functions";
import {
  aggregate,
  downloadModel,
  guessMapping,
  readSheet,
  toSavedMapping,
  type ParsedSheet,
} from "@/lib/carteira/parse";
import {
  onlyDigits,
  summarize,
  type CarteiraDraftRow,
  type CarteiraField,
  type CarteiraRow,
  type CarteiraTipo,
  type ColumnMapping,
  type SavedMapping,
} from "@/lib/carteira/types";
import type { CaseRecord } from "@/lib/cases.functions";
import { brl } from "@/lib/tax/calc";
import { RESTORE_KEY } from "@/lib/tax/session";

type Upload = {
  id: string;
  sheet: ParsedSheet;
  tipo: "coluna" | CarteiraTipo;
  mapping: ColumnMapping;
};

const FIELD_LABELS: Record<CarteiraField, string> = {
  nome: "Nome / Razão Social",
  cnpj: "CNPJ",
  valor: "Valor movimentado",
  tipo: "Tipo (cliente ou fornecedor)",
};

const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function DiagnosticoCompleto({ caseItem }: { caseItem: CaseRecord }) {
  const navigate = useNavigate();
  const load = useServerFn(getCarteira);
  const save = useServerFn(saveCarteira);
  const process = useServerFn(processCarteiraBatch);
  const removeRow = useServerFn(deleteCarteiraRow);
  const resetRows = useServerFn(resetCarteiraRows);
  const classifyManually = useServerFn(classifyCarteiraRowManually);

  const [rows, setRows] = useState<CarteiraRow[]>([]);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [savedMapping, setSavedMapping] = useState<SavedMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [step, setStep] = useState<"docs" | "mapping" | "review">("docs");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [drafts, setDrafts] = useState<CarteiraDraftRow[]>([]);
  const [replace, setReplace] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);

  const refresh = async () => {
    try {
      const res = await withAuthRetry(() => load({ data: { caseId: caseItem.id } }));
      if (res.ok) {
        setRows(res.rows);
        setDocs(res.docs);
        setSavedMapping(res.mapping);
      }
    } catch {
      setError("Não foi possível carregar os documentos do diagnóstico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      stopRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem.id]);

  const carteiraStatus = docs["composicao_carteira"] ?? "nao_enviado";
  const [regimeStatus, setRegimeStatus] = useState("nao_enviado");
  const [tomadosStatus, setTomadosStatus] = useState("nao_enviado");
  const [prestadosStatus, setPrestadosStatus] = useState("nao_enviado");
  const [pgdasCount, setPgdasCount] = useState(0);
  const [spedStatus, setSpedStatus] = useState({ icmsMeses: 0, contribMeses: 0 });
  // Lista de contrapartes fica fechada por padrão e só abre sozinha quando
  // chega um envio novo nesta sessão — fora isso, o analista decide.
  const [listaAberta, setListaAberta] = useState(false);
  const [nbsReload, setNbsReload] = useState(0);
  const docsDialogRef = useRef<HTMLDialogElement>(null);
  // O PGDAS-D só existe no Simples Nacional.
  const isSimples = (caseItem.simulations[0]?.input as { taxpayerType?: string } | undefined)?.taxpayerType ===
    "simples";

  /* ---------------- upload e mapeamento ---------------- */

  const [pacote, setPacote] = useState<PacoteTriado | null>(null);
  // Planilha de contas a pagar de serviços tomados (sem XML): mesmo fluxo de
  // mapeamento/conferência da composição geral, mas sempre "fornecedor" e
  // marcada à parte (servico_tomado) para alimentar a aba "Serviços tomados".
  const [servicoTomadoUpload, setServicoTomadoUpload] = useState(false);

  const handleFiles = async (files: FileList | File[] | null, opts?: { servicoTomado?: boolean }) => {
    if (!files || files.length === 0) return;
    setError("");
    const servicoTomado = opts?.servicoTomado === true;
    try {
      const parsed: Upload[] = [];
      for (const file of Array.from(files)) {
        const sheet = await readSheet(file);
        parsed.push({
          id: `${file.name}-${parsed.length}`,
          sheet,
          tipo: servicoTomado ? "fornecedor" : "coluna",
          mapping: guessMapping(sheet.headers, servicoTomado ? null : savedMapping),
        });
      }
      setServicoTomadoUpload(servicoTomado);
      setUploads(parsed);
      setStep("mapping");
    } catch {
      setError("Não foi possível ler o arquivo. Envie um .xlsx ou .csv.");
    }
  };

  const buildDrafts = () => {
    const all: CarteiraDraftRow[] = [];
    for (const upload of uploads) {
      const tipoFixo = upload.tipo === "coluna" ? null : upload.tipo;
      all.push(
        ...aggregate(upload.sheet, upload.mapping, { tipoFixo, servicoTomadoFixo: servicoTomadoUpload }),
      );
    }
    // soma o mesmo CNPJ que apareça em mais de um arquivo, por tipo
    const merged = new Map<string, CarteiraDraftRow>();
    const invalids: CarteiraDraftRow[] = [];
    for (const row of all) {
      if (row.invalido === "cnpj") {
        invalids.push(row);
        continue;
      }
      const key = `${row.tipo}:${row.cnpj}`;
      const found = merged.get(key);
      if (found) {
        found.valor = Math.round((found.valor + row.valor) * 100) / 100;
        found.linhas += row.linhas;
        found.nomesDivergentes = [...new Set([...found.nomesDivergentes, ...row.nomesDivergentes])];
        found.servicoTomado = found.servicoTomado || row.servicoTomado;
      } else {
        merged.set(key, { ...row });
      }
    }
    setDrafts([...merged.values()].sort((a, b) => b.valor - a.valor).concat(invalids));
    setStep("review");
  };

  const mappingReady = uploads.every(
    (u) =>
      u.mapping.nome !== undefined &&
      u.mapping.cnpj !== undefined &&
      u.mapping.valor !== undefined &&
      (u.tipo !== "coluna" || u.mapping.tipo !== undefined),
  );

  const patchDraft = (index: number, patch: Partial<CarteiraDraftRow>) => {
    setDrafts((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        next.invalido =
          onlyDigits(next.cnpj).length !== 14 ? "cnpj" : next.valor > 0 ? null : "valor";
        return next;
      }),
    );
  };

  const validDrafts = drafts.filter((d) => d.invalido === null);

  const confirmDrafts = async () => {
    setSaving(true);
    setError("");
    try {
      const mapping = uploads[0]
        ? toSavedMapping(uploads[0].sheet.headers, uploads[0].mapping)
        : null;
      const res = await withAuthRetry(() =>
        save({
          data: {
            caseId: caseItem.id,
            replace,
            mapping,
            servicoTomado: servicoTomadoUpload,
            rows: validDrafts.map((d) => ({
              nome: d.nome,
              cnpj: onlyDigits(d.cnpj),
              tipo: d.tipo,
              valor: d.valor,
              servicoTomado: d.servicoTomado,
            })),
          },
        }),
      );
      if (!res.ok) throw new Error("fail");
      if (servicoTomadoUpload) setTomadosStatus("processado");
      setUploads([]);
      setDrafts([]);
      setServicoTomadoUpload(false);
      setStep("docs");
      setListaAberta(true);
      await refresh();
      if (servicoTomadoUpload) void runDiagnostic();
    } catch {
      setError("Não foi possível gravar a composição de carteira.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- processamento ---------------- */

  const runDiagnostic = async (ids?: string[], knownTotal?: number) => {
    setRunning(true);
    stopRef.current = false;
    setError("");
    setInfo("");
    const total =
      knownTotal ?? ids?.length ?? rows.filter((r) => r.status_consulta === "pendente").length;
    setProgress({ done: 0, total });
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let lastFallback = 0;
    let idleRounds = 0;
    let remaining = total;
    try {
      let guard = 0;
      while (!stopRef.current && guard < 600) {
        guard += 1;
        // Reserva CNPJá: no máximo 1 chamada a cada 13 s (5/min com margem).
        const allowFallback = Date.now() - lastFallback >= 13_000;
        const res = await withAuthRetry(() =>
          process({ data: { caseId: caseItem.id, allowFallback, ...(ids ? { ids } : {}) } }),
        );
        if (res.usedFallback) lastFallback = Date.now();
        remaining = res.remaining;
        setProgress({ done: Math.max(0, total - remaining), total });
        if (remaining === 0) break;
        if (res.finalized === 0 && res.transient > 0) {
          // Só erros transitórios: espera até a próxima janela da reserva CNPJá
          // (com backoff leve), para que a próxima rodada possa usá-la.
          idleRounds += 1;
          const untilFallback = Math.max(0, 13_000 - (Date.now() - lastFallback));
          await sleep(Math.max(untilFallback, Math.min(2_000 * idleRounds, 13_000)));
        } else {
          idleRounds = 0;
          if (!allowFallback) await sleep(1_000);
        }
      }
      await refresh();
      if (remaining > 0) {
        setInfo(
          `Processamento pausado: ${remaining} CNPJ(s) ainda aguardam consulta. Clique em "Rodar Diagnóstico" para continuar.`,
        );
      }
    } catch {
      await refresh();
      setError("O processamento foi interrompido. Você pode retomar a qualquer momento.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const handleRefreshRows = async (ids: string[]) => {
    await withAuthRetry(() => resetRows({ data: { caseId: caseItem.id, ids } }));
    await runDiagnostic(ids);
  };

  const handleRetryErrors = async () => {
    const ids = rows.filter((r) => r.status_consulta === "erro").map((r) => r.id);
    if (ids.length === 0) return;
    await withAuthRetry(() => resetRows({ data: { caseId: caseItem.id, ids } }));
    const pendentes = rows.filter((r) => r.status_consulta === "pendente").length;
    await runDiagnostic(undefined, pendentes + ids.length);
  };

  const handleDeleteRow = async (id: string) => {
    await withAuthRetry(() => removeRow({ data: { caseId: caseItem.id, id } }));
    await refresh();
  };

  const handleClassifyManually = async (id: string, regime: "simples" | "regular") => {
    await withAuthRetry(() => classifyManually({ data: { caseId: caseItem.id, id, regime } }));
    await refresh();
  };

  /* ---------------- conexões com o motor de regime ---------------- */

  const fornecedores = useMemo(() => summarize(rows, "fornecedor"), [rows]);
  const clientes = useMemo(() => summarize(rows, "cliente"), [rows]);
  const hasSaved = caseItem.simulations.length > 0;

  const openSimulator = () => {
    const latest = caseItem.simulations[0];
    localStorage.setItem(
      RESTORE_KEY,
      JSON.stringify({
        input: latest?.input ?? undefined,
        year: latest?.year_id,
        clientName: latest?.client_name ?? caseItem.client_name ?? "",
        cnpjData: latest?.cnpj_data ?? null,
        suggestedSimplesSupplierShare: Math.round(fornecedores.simplesPct * 10) / 10,
      }),
    );
    void navigate({ to: "/simulador" });
  };

  /* ---------------- render ---------------- */

  if (loading) return <Notice>Carregando o Diagnóstico Completo...</Notice>;

  if (step === "mapping") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Mapeamento das colunas</h3>
        <p className="text-sm text-muted-foreground">
          Indique qual coluna do arquivo corresponde a cada informação. Pré-selecionamos o que deu
          para reconhecer — confira antes de seguir.
        </p>
        {uploads.map((upload, uIndex) => (
          <div key={upload.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">{upload.sheet.fileName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {upload.sheet.rows.length} linha{upload.sheet.rows.length === 1 ? "" : "s"} ·{" "}
              {upload.sheet.headers.length} colunas detectadas
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-foreground">
                  Este arquivo contém
                </span>
                <select
                  value={upload.tipo}
                  onChange={(e) =>
                    setUploads((prev) =>
                      prev.map((u, i) =>
                        i === uIndex ? { ...u, tipo: e.target.value as Upload["tipo"] } : u,
                      ),
                    )
                  }
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="coluna">Clientes e fornecedores (o tipo está numa coluna)</option>
                  <option value="cliente">Somente clientes</option>
                  <option value="fornecedor">Somente fornecedores</option>
                </select>
              </label>

              {(["nome", "cnpj", "valor", "tipo"] as CarteiraField[])
                .filter((f) => f !== "tipo" || upload.tipo === "coluna")
                .map((field) => (
                  <label key={field} className="text-sm">
                    <span className="mb-1 block font-medium text-foreground">
                      {FIELD_LABELS[field]}
                    </span>
                    <select
                      value={upload.mapping[field] ?? -1}
                      onChange={(e) =>
                        setUploads((prev) =>
                          prev.map((u, i) =>
                            i === uIndex
                              ? { ...u, mapping: { ...u.mapping, [field]: Number(e.target.value) } }
                              : u,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                    >
                      <option value={-1}>Selecione a coluna</option>
                      {upload.sheet.headers.map((h, idx) => (
                        <option key={`${h}-${idx}`} value={idx}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </div>
          </div>
        ))}

        {!mappingReady ? (
          <Notice tone="warning">
            Indique as colunas de nome, CNPJ e valor (e o tipo, quando ele vier dentro do arquivo).
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={!mappingReady} onClick={buildDrafts}>
            Conferir dados
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setUploads([]);
              setStep("docs");
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    const invalid = drafts.filter((d) => d.invalido !== null).length;
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Conferência</h3>
        <p className="text-sm text-muted-foreground">
          Uma linha por CNPJ, com as repetições já somadas. Nada é gravado antes da sua confirmação.
        </p>

        {rows.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium text-foreground">
              Este caso já tem uma composição de carteira enviada.
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" checked={replace} onChange={() => setReplace(true)} />
                Substituir a composição atual
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!replace} onChange={() => setReplace(false)} />
                Somar como nova versão (mantém a anterior)
              </label>
            </div>
          </div>
        ) : null}

        {invalid > 0 ? (
          <Notice tone="warning">
            {invalid} linha{invalid === 1 ? "" : "s"} com CNPJ ou valor inválido. Corrija ou remova —
            elas não entram na soma.
          </Notice>
        ) : null}

        <div className="max-h-[28rem] overflow-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">CNPJ</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Valor total</th>
                <th className="px-3 py-2">Serviço tomado?</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((row, index) => (
                <tr
                  key={`${row.cnpj}-${row.tipo}-${index}`}
                  className={`border-t border-border ${row.invalido ? "bg-danger/5" : ""}`}
                >
                  <td className="px-3 py-2">
                    <input
                      value={row.nome}
                      onChange={(e) => patchDraft(index, { nome: e.target.value })}
                      className="w-full rounded border border-input bg-card px-2 py-1 text-sm"
                    />
                    {row.nomesDivergentes.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Também apareceu como: {row.nomesDivergentes.join(", ")}
                      </p>
                    ) : null}
                    {row.linhas > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        {row.linhas} linhas somadas
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.cnpj}
                      onChange={(e) => patchDraft(index, { cnpj: e.target.value })}
                      className={`w-44 rounded border px-2 py-1 text-sm tabular-nums ${
                        row.invalido === "cnpj" ? "border-danger" : "border-input"
                      } bg-card`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.tipo}
                      onChange={(e) => {
                        const tipo = e.target.value as CarteiraTipo;
                        patchDraft(index, {
                          tipo,
                          servicoTomado: tipo === "fornecedor" ? row.servicoTomado : false,
                        });
                      }}
                      className="rounded border border-input bg-card px-2 py-1 text-sm"
                    >
                      <option value="cliente">Cliente</option>
                      <option value="fornecedor">Fornecedor</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={String(row.valor)}
                      onChange={(e) =>
                        patchDraft(index, { valor: Number(e.target.value.replace(",", ".")) || 0 })
                      }
                      className={`w-32 rounded border px-2 py-1 text-right text-sm tabular-nums ${
                        row.invalido === "valor" ? "border-danger" : "border-input"
                      } bg-card`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {row.tipo === "fornecedor" ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={row.servicoTomado}
                          onChange={(e) => patchDraft(index, { servicoTomado: e.target.checked })}
                        />
                        Entra em "Serviços tomados"
                      </label>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">
          {validDrafts.length} contraparte{validDrafts.length === 1 ? "" : "s"} válida
          {validDrafts.length === 1 ? "" : "s"} ·{" "}
          {brl(validDrafts.reduce((acc, d) => acc + d.valor, 0))} no total
        </p>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving || validDrafts.length === 0} onClick={() => void confirmDrafts()}>
            {saving ? "Gravando..." : "Confirmar composição"}
          </Button>
          <Button variant="ghost" onClick={() => setStep("mapping")}>
            Voltar ao mapeamento
          </Button>
        </div>
      </div>
    );
  }

  const carteiraCount = rows.filter((r) => !r.servico_tomado).length;
  const servicoTomadoCount = rows.filter((r) => r.servico_tomado).length;
  const carteiraEnviado = carteiraStatus !== "nao_enviado" || carteiraCount > 0;
  const tomadosEnviado = tomadosStatus === "processado" || servicoTomadoCount > 0;
  const prestadosEnviado = prestadosStatus === "processado";
  const pgdasEnviado = (docs["dados_regime"] ?? regimeStatus) !== "nao_enviado";
  const icmsEnviado = spedStatus.icmsMeses > 0;
  const contribEnviado = spedStatus.contribMeses > 0;
  const spedEnviado = icmsEnviado || contribEnviado;

  type DocKey = "carteira" | "tomadas" | "prestadas" | "pgdas" | "icms" | "contrib";
  const docsTipos: {
    key: DocKey;
    chip: string;
    titulo: string;
    descricao: string;
    enviado: boolean;
    statusTexto: string;
  }[] = [
    {
      key: "carteira",
      chip: "Carteira",
      titulo: "Carteira de clientes e fornecedores",
      descricao:
        "Relatório de contas a receber/pagar ou razão analítico (.xlsx/.csv). Alternativa: NF-e em XML, compra e venda juntas.",
      enviado: carteiraEnviado,
      statusTexto: carteiraEnviado
        ? `✓ ${carteiraCount} contraparte${carteiraCount === 1 ? "" : "s"} na composição`
        : "Não enviado",
    },
    {
      key: "tomadas",
      chip: "NFS-e tomadas",
      titulo: "NFS-e tomadas",
      descricao:
        "Serviços contratados pelo cliente (.xml, .json ou .zip do Portal Nacional). Sem XML, dá para enviar a planilha de contas a pagar.",
      enviado: tomadosEnviado,
      statusTexto:
        tomadosStatus === "processado"
          ? "✓ Enviado"
          : servicoTomadoCount > 0
            ? `✓ ${servicoTomadoCount} fornecedor${servicoTomadoCount === 1 ? "" : "es"} (planilha)`
            : "Não enviado",
    },
    {
      key: "prestadas",
      chip: "NFS-e prestadas",
      titulo: "NFS-e prestadas",
      descricao: "Serviços prestados pelo cliente (.xml, .json ou .zip do Portal Nacional).",
      enviado: prestadosEnviado,
      statusTexto: prestadosEnviado ? "✓ Enviado" : "Não enviado",
    },
    ...(isSimples
      ? [
          {
            key: "pgdas" as const,
            chip: "PGDAS-D",
            titulo: "Extrato do PGDAS-D",
            descricao: "Apuração mensal do Simples Nacional (.pdf).",
            enviado: pgdasEnviado,
            statusTexto:
              pgdasCount > 0 ? `✓ ${pgdasCount} mês(es)` : pgdasEnviado ? "✓ Enviado" : "Não enviado",
          },
        ]
      : []),
    {
      key: "icms",
      chip: "SPED ICMS-IPI",
      titulo: "SPED EFD ICMS-IPI",
      descricao: "Escrituração fiscal de ICMS e IPI (.txt). Por enquanto, só pelo pacote único.",
      enviado: icmsEnviado,
      statusTexto: icmsEnviado ? `✓ ${spedStatus.icmsMeses} mês(es)` : "Não enviado",
    },
    {
      key: "contrib",
      chip: "SPED Contribuições",
      titulo: "SPED EFD Contribuições",
      descricao: "Escrituração de PIS/COFINS (.txt). Por enquanto, só pelo pacote único.",
      enviado: contribEnviado,
      statusTexto: contribEnviado ? `✓ ${spedStatus.contribMeses} mês(es)` : "Não enviado",
    },
  ];
  const totalTipos = docsTipos.length;
  const enviadosCount = docsTipos.filter((d) => d.enviado).length;
  const footTxt =
    rows.length === 0
      ? "Envie ao menos um documento para rodar o diagnóstico."
      : enviadosCount === totalTipos
        ? "Todos os tipos enviados. Confirme e rode o diagnóstico."
        : `Faltam ${totalTipos - enviadosCount} tipo(s). Você pode rodar o diagnóstico mesmo assim; a análise fica mais completa com todos.`;

  return (
    <div className="space-y-5">
      {error ? <Notice tone="warning">{error}</Notice> : null}

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Documentos do diagnóstico</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Envie tudo de uma vez: o sistema separa por tipo. Depois confira abaixo e reenvie só
              o que faltar.
            </p>
          </div>
          <div className="min-w-[150px] text-right">
            <p className="text-xs font-semibold text-foreground">
              {enviadosCount} de {totalTipos} tipos enviados
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary sm:w-40">
              <div
                className="h-full rounded-full bg-mint transition-all"
                style={{ width: `${totalTipos > 0 ? (enviadosCount / totalTipos) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <UploadUnicoPanel
          caseCnpj={caseItem.cnpj}
          onTriado={(p) => {
            setPacote(p);
            if (p.resultado.planilhas.length > 0) void handleFiles(p.resultado.planilhas);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap gap-2" aria-label="Situação por tipo de documento">
            {docsTipos.map((d) => (
              <span
                key={d.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                  d.enviado
                    ? "bg-mint-soft text-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <i
                  className={`inline-block h-2 w-2 rounded-full border ${
                    d.enviado ? "border-mint bg-mint" : "border-muted-foreground bg-transparent"
                  }`}
                  aria-hidden
                />
                {d.chip}
              </span>
            ))}
          </div>
          <Button
            variant="ghost"
            onClick={() => docsDialogRef.current?.showModal()}
            aria-haspopup="dialog"
          >
            {enviadosCount === totalTipos ? "Ver ou substituir documentos" : "Enviar por tipo de documento"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{footTxt}</p>
          <Button disabled={running || rows.length === 0} onClick={() => void runDiagnostic()}>
            {running ? "Processando..." : "Rodar Diagnóstico"}
          </Button>
        </div>
        {progress ? (
          <span className="text-sm text-muted-foreground">
            Consultando {progress.done} de {progress.total} CNPJs...
          </span>
        ) : null}
      </section>

      {/* O wrapper fica sempre no DOM (só a visibilidade é alternada com
       * "hidden") para o SpedPanel continuar montado e poder carregar e
       * avisar, via onStatus, se há SPED gravado — se fosse removido do DOM
       * enquanto "spedEnviado" é false, ele nunca chegaria a carregar e essa
       * variável nunca sairia de false, mesmo com SPED já enviado numa
       * sessão anterior. */}
      <div hidden={!spedEnviado} className="rounded-xl border border-border bg-card p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Conferência do SPED{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">Ver conferência</span>
          </summary>
          <div className="mt-3">
            <SpedPanel caseId={caseItem.id} pacote={pacote} onStatus={setSpedStatus} />
          </div>
        </details>
      </div>

      <dialog
        ref={docsDialogRef}
        aria-labelledby="docs-modal-title"
        className="w-[min(720px,calc(100vw-24px))] max-h-[calc(100vh-40px)] rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50"
        onClick={(e) => {
          if (e.target === docsDialogRef.current) docsDialogRef.current?.close();
        }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card p-4">
          <div>
            <h2 id="docs-modal-title" className="text-base font-semibold text-foreground">
              Envio por tipo de documento
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use para enviar, reenviar ou corrigir um tipo específico. O pacote único continua
              valendo para tudo de uma vez.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => docsDialogRef.current?.close()}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(100vh-170px)] overflow-y-auto p-4">
          <div className="divide-y divide-border rounded-xl border border-border">
            {docsTipos.map((d) => (
              <div
                key={d.key}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px] ${
                      d.enviado
                        ? "border-mint bg-mint text-navy-foreground"
                        : "border-border text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{d.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.descricao}</p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs ${
                        d.enviado ? "bg-mint-soft text-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {d.statusTexto}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {d.key === "carteira" ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
                          {carteiraEnviado ? "Substituir relatório" : "Anexar relatório (.xlsx/.csv)"}
                          <input
                            type="file"
                            multiple
                            accept=".xlsx,.csv,.xls"
                            className="hidden"
                            onChange={(e) => void handleFiles(e.target.files)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => downloadModel()}
                          className="text-xs text-accent underline underline-offset-2 hover:opacity-80"
                        >
                          Baixar modelo sugerido
                        </button>
                      </div>
                      <NfeUnificadoPanel
                        caseId={caseItem.id}
                        caseCnpj={caseItem.cnpj}
                        onApplied={async () => {
                          setListaAberta(true);
                          await refresh();
                          void runDiagnostic();
                        }}
                        incoming={pacote ? { id: pacote.id, files: pacote.resultado.nfe } : null}
                      />
                    </>
                  ) : d.key === "tomadas" ? (
                    <>
                      <NfseCarteiraPanel
                        caseId={caseItem.id}
                        ladoFixo="tomado"
                        incoming={
                          pacote
                            ? { id: pacote.id, tomado: pacote.resultado.nfseTomado, prestado: [] }
                            : null
                        }
                        onApplied={async () => {
                          setTomadosStatus("processado");
                          setListaAberta(true);
                          await refresh();
                          setNbsReload((v) => v + 1);
                          void runDiagnostic();
                        }}
                      />
                      <label className="cursor-pointer text-xs text-accent underline underline-offset-2 hover:opacity-80">
                        Sem XML? Enviar planilha de contas a pagar
                        <input
                          type="file"
                          multiple
                          accept=".xlsx,.csv,.xls"
                          className="hidden"
                          onChange={(e) => void handleFiles(e.target.files, { servicoTomado: true })}
                        />
                      </label>
                    </>
                  ) : d.key === "prestadas" ? (
                    <NfseCarteiraPanel
                      caseId={caseItem.id}
                      ladoFixo="prestado"
                      incoming={
                        pacote
                          ? { id: pacote.id, tomado: [], prestado: pacote.resultado.nfsePrestado }
                          : null
                      }
                      onApplied={async () => {
                        setPrestadosStatus("processado");
                        setListaAberta(true);
                        await refresh();
                        setNbsReload((v) => v + 1);
                        void runDiagnostic();
                      }}
                    />
                  ) : d.key === "pgdas" ? (
                    <PgdasdPanel
                      caseItem={caseItem}
                      onStatus={setRegimeStatus}
                      onCount={setPgdasCount}
                      incoming={
                        pacote?.resultado.pgdasd[0]
                          ? { id: pacote.id, file: pacote.resultado.pgdasd[0] }
                          : null
                      }
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Enviado pelo pacote único.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">
            {enviadosCount} de {totalTipos} tipos enviados
          </span>
          <Button onClick={() => docsDialogRef.current?.close()}>Concluir</Button>
        </div>
      </dialog>

      {running ? (
        <Notice>
          As consultas respeitam o limite da API pública (5 por minuto), por isso levam alguns
          minutos. Você pode sair desta tela: o que já foi consultado fica gravado e o processamento
          retoma de onde parou.
        </Notice>
      ) : null}

      <CarteiraResult
        rows={rows}
        busy={running}
        onRefreshRows={(ids) => void handleRefreshRows(ids)}
        onRetryErrors={() => void handleRetryErrors()}
        onDeleteRow={(id) => void handleDeleteRow(id)}
        onClassifyManually={(id, regime) => void handleClassifyManually(id, regime)}
        listaAberta={listaAberta}
        onToggleLista={setListaAberta}
      />

      <PainelCargaPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <CreditoNcmPanel caseId={caseItem.id} />

      <DebitoNcmPanel caseId={caseItem.id} />


      <CreditoNbsPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <DebitoNbsPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <PrecoNecessarioPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <ContratosAlugueisPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <DrePanel caseId={caseItem.id} reloadKey={nbsReload} />

      <SplitPaymentPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <FluxoCaixaPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <RevisaoNbsPanel caseId={caseItem.id} onResolved={() => setNbsReload((v) => v + 1)} />

      <ApuracaoLiquidaPanel caseId={caseItem.id} reloadKey={nbsReload} />

      <ConcentracaoPanel caseId={caseItem.id} reloadKey={nbsReload} />

      {fornecedores.classificadas > 0 ? (
        <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
          <p className="text-sm font-semibold text-foreground">
            Crédito de IBS/CBS sugerido pelo Diagnóstico Completo
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pct1(fornecedores.regularPct)} da carteira de fornecedores, em valor, está em regime
            regular (gera crédito). Os {pct1(fornecedores.simplesPct)} do Simples Nacional, pela
            convenção adotada, entram como não geradores de crédito.
          </p>
          <p className="mt-2 text-sm text-foreground">
            Valor sugerido para “% das compras vindas de fornecedores do Simples”:{" "}
            <strong className="tabular-nums">{pct1(fornecedores.simplesPct)}</strong>
          </p>
          {hasSaved ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Este caso já tem cálculo salvo com valor digitado manualmente. Nada foi recalculado: a
              sugestão só é aplicada se você abrir o simulador e confirmar.
            </p>
          ) : null}
          <div className="mt-3">
            <Button onClick={openSimulator}>Abrir simulador com este valor sugerido</Button>
          </div>
        </div>
      ) : null}

      {clientes.classificadas > 0 ? (
        <div className="rounded-xl border border-border bg-secondary p-4">
          <p className="text-sm font-semibold text-foreground">
            Composição de clientes — contexto para a decisão (não entra no cálculo)
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pct1(clientes.regularPct)} da carteira de clientes, em valor, está em regime regular e{" "}
            {pct1(clientes.simplesPct)} no Simples Nacional. Esse dado não altera a carga tributária
            do próprio caso.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Referência para avaliar Simples tradicional x Simples híbrido, já que clientes em
              regime regular aproveitam crédito.
            </li>
            <li>Referência para a decisão de repasse de preço aos clientes.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
