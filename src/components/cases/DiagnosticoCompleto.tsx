import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

import { Button, Notice } from "@/components/simulator/ui";
import { CarteiraResult } from "@/components/cases/CarteiraResult";
import { PgdasdPanel } from "@/components/cases/PgdasdPanel";
import { NfeUnificadoPanel } from "@/components/cases/NfeUnificadoPanel";
import { CreditoNcmPanel } from "@/components/cases/CreditoNcmPanel";
import { NfseServicoPanel } from "@/components/cases/NfseServicoPanel";
import { CreditoNbsPanel } from "@/components/cases/CreditoNbsPanel";
import { withAuthRetry } from "@/lib/auth-retry";
import {
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
  DIAGNOSTIC_DOCS,
  DOC_STATUS_LABELS,
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

  const [rows, setRows] = useState<CarteiraRow[]>([]);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [savedMapping, setSavedMapping] = useState<SavedMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  // O PGDAS-D só existe no Simples Nacional.
  const isSimples = (caseItem.simulations[0]?.input as { taxpayerType?: string } | undefined)?.taxpayerType ===
    "simples";

  /* ---------------- upload e mapeamento ---------------- */

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    try {
      const parsed: Upload[] = [];
      for (const file of Array.from(files)) {
        const sheet = await readSheet(file);
        parsed.push({
          id: `${file.name}-${parsed.length}`,
          sheet,
          tipo: "coluna",
          mapping: guessMapping(sheet.headers, savedMapping),
        });
      }
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
      all.push(...aggregate(upload.sheet, upload.mapping, { tipoFixo }));
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
            rows: validDrafts.map((d) => ({
              nome: d.nome,
              cnpj: onlyDigits(d.cnpj),
              tipo: d.tipo,
              valor: d.valor,
            })),
          },
        }),
      );
      if (!res.ok) throw new Error("fail");
      setUploads([]);
      setDrafts([]);
      setStep("docs");
      await refresh();
    } catch {
      setError("Não foi possível gravar a composição de carteira.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- processamento ---------------- */

  const runDiagnostic = async (ids?: string[]) => {
    setRunning(true);
    stopRef.current = false;
    setError("");
    const total = ids?.length ?? rows.filter((r) => r.status_consulta !== "ok").length;
    let done = 0;
    setProgress({ done: 0, total });
    try {
      let guard = 0;
      // eslint-disable-next-line no-constant-condition
      while (!stopRef.current && guard < 500) {
        guard += 1;
        const res = await withAuthRetry(() =>
          process({ data: { caseId: caseItem.id, ...(ids ? { ids } : {}) } }),
        );
        done += res.processed;
        setProgress({ done, total: Math.max(total, done) });
        if (res.processed === 0 || ids) break;
        if (res.remaining === 0) break;
      }
      await refresh();
    } catch {
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

  const handleDeleteRow = async (id: string) => {
    await withAuthRetry(() => removeRow({ data: { caseId: caseItem.id, id } }));
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
                      onChange={(e) =>
                        patchDraft(index, { tipo: e.target.value as CarteiraTipo })
                      }
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

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Documentos do Diagnóstico Completo
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Anexe os documentos do cliente. A verificação só roda depois que os anexos forem
          confirmados.
        </p>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      <ul className="space-y-3">
        {DIAGNOSTIC_DOCS.filter((doc) => doc.key !== "dados_regime" || isSimples).map((doc) => {
          const status =
            doc.key === "composicao_carteira"
              ? carteiraStatus
              : doc.key === "dados_regime"
                ? (docs["dados_regime"] ?? regimeStatus)
                : doc.key === "servicos_tomados"
                  ? servicosStatus
                  : "nao_enviado";
          return (
            <li
              key={doc.key}
              className={`rounded-xl border border-border bg-card p-4 ${doc.active ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{doc.description}</p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {DOC_STATUS_LABELS[status]}
                </span>
              </div>

              {doc.key === "dados_regime" ? (
                <div className="mt-3">
                  <PgdasdPanel caseItem={caseItem} onStatus={setRegimeStatus} />
                </div>
              ) : doc.key === "servicos_tomados" ? (
                <NfseServicoPanel
                  caseId={caseItem.id}
                  caseCnpj={caseItem.cnpj}
                  onSaved={() => setServicosStatus("processado")}
                />
              ) : doc.active ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-navy hover:bg-secondary">
                      Anexar relatório (.xlsx ou .csv)
                      <input
                        type="file"
                        multiple
                        accept=".xlsx,.csv,.xls"
                        className="hidden"
                        onChange={(e) => void handleFiles(e.target.files)}
                      />
                    </label>
                    <Button variant="ghost" onClick={() => downloadModel()}>
                      Baixar modelo sugerido
                    </Button>
                    {rows.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {rows.length} contrapartes na composição atual
                      </span>
                    ) : null}
                  </div>
                  {doc.key === "composicao_carteira" ? (
                    <>
                      <NfeUnificadoPanel
                        caseId={caseItem.id}
                        caseCnpj={caseItem.cnpj}
                        onApplied={refresh}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={running || rows.length === 0}
          onClick={() => void runDiagnostic()}
        >
          {running ? "Processando..." : "Rodar Diagnóstico"}
        </Button>
        {progress ? (
          <span className="text-sm text-muted-foreground">
            Consultando {progress.done} de {progress.total} CNPJs...
          </span>
        ) : rows.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            Anexe e confirme a composição de carteira para liberar o processamento.
          </span>
        ) : null}
      </div>

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
        onDeleteRow={(id) => void handleDeleteRow(id)}
      />

      <CreditoNcmPanel caseId={caseItem.id} />

      <CreditoNbsPanel key={servicosStatus} caseId={caseItem.id} />

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
