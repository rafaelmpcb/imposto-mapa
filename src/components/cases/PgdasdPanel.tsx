import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { onlyDigits, formatCnpjMask } from "@/lib/carteira/types";
import type { CaseRecord } from "@/lib/cases.functions";
import {
  deletePgdasd,
  listPgdasd,
  markPgdasdApplied,
  savePgdasd,
} from "@/lib/pgdasd.functions";
import { isCompetenciaAntiga, readPgdasd } from "@/lib/pgdasd/parse";
import {
  emptyExtraction,
  PGDASD_STATUS_LABELS,
  type PgdasdExtraction,
  type PgdasdRecord,
} from "@/lib/pgdasd/types";
import { brl } from "@/lib/tax/calc";
import { RESTORE_KEY } from "@/lib/tax/session";

const num = (v: number | null) => (v === null ? "" : String(v));
const toNum = (v: string) => {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && v.trim() !== "" ? n : null;
};

export function PgdasdPanel({
  caseItem,
  onStatus,
}: {
  caseItem: CaseRecord;
  onStatus?: (status: string) => void;
}) {
  const navigate = useNavigate();
  const load = useServerFn(listPgdasd);
  const save = useServerFn(savePgdasd);
  const markApplied = useServerFn(markPgdasdApplied);
  const remove = useServerFn(deletePgdasd);

  const [items, setItems] = useState<PgdasdRecord[]>([]);
  const [draft, setDraft] = useState<PgdasdExtraction | null>(null);
  const [fileName, setFileName] = useState("");
  const [anexoEscolhido, setAnexoEscolhido] = useState("III");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const latestSim = caseItem.simulations[0];
  const motor = (latestSim?.input ?? {}) as {
    revenue?: number;
    payroll?: number;
    simplesAnexo?: string;
    rbt12?: number;
  };

  const refresh = async () => {
    try {
      const res = await withAuthRetry(() => load({ data: { caseId: caseItem.id } }));
      setItems(res.items);
      onStatus?.(res.items.length > 0 ? "processado" : "nao_enviado");
    } catch {
      /* silencioso: o painel principal já reporta falha de carregamento */
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem.id]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const extraction = await readPgdasd(file);
      setFileName(file.name);
      setDraft(extraction);
      setAnexoEscolhido(
        extraction.anexos[0]?.anexo ?? (motor.simplesAnexo as string | undefined) ?? "III",
      );
    } catch {
      setError("Não foi possível ler este PDF. Confira o arquivo ou preencha os campos à mão.");
      setFileName(file.name);
      setDraft({ ...emptyExtraction(), status: "sem_texto", faltantes: ["texto do PDF"] });
    } finally {
      setBusy(false);
    }
  };

  const cnpjDivergente = useMemo(() => {
    const caseCnpj = onlyDigits(caseItem.cnpj ?? "");
    const docCnpj = onlyDigits(draft?.cnpj ?? "");
    return caseCnpj.length === 14 && docCnpj.length === 14 && caseCnpj !== docCnpj;
  }, [caseItem.cnpj, draft?.cnpj]);

  const confirmar = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await withAuthRetry(() =>
        save({
          data: {
            caseId: caseItem.id,
            arquivo: fileName,
            competencia: draft.competencia,
            cnpj: draft.cnpj,
            razaoSocial: draft.razaoSocial,
            rbt12: draft.rbt12,
            receitaBrutaPa: draft.receitaBrutaPa,
            anexos:
              draft.anexos.length > 0
                ? draft.anexos
                : [{ anexo: anexoEscolhido, receita: draft.receitaBrutaPa, percentual: null }],
            folha12Meses: draft.folha12Meses,
            valorTotalDas: draft.valorTotalDas,
            tributos: draft.tributos,
            status: draft.status,
          },
        }),
      );
      setDraft(null);
      setFileName("");
      await refresh();
    } catch {
      setError("Não foi possível gravar os dados do PGDAS-D.");
    } finally {
      setBusy(false);
    }
  };

  const abrirSimulador = (record: PgdasdRecord) => {
    const anexo = record.anexos?.[0]?.anexo ?? motor.simplesAnexo ?? "III";
    const folhaMensal =
      record.folha_12_meses && record.folha_12_meses > 0 ? record.folha_12_meses / 12 : undefined;
    localStorage.setItem(
      RESTORE_KEY,
      JSON.stringify({
        input: {
          ...(latestSim?.input ?? {}),
          taxpayerType: "simples",
          ...(record.rbt12 ? { rbt12: record.rbt12 } : {}),
          ...(record.receita_bruta_pa ? { revenue: record.receita_bruta_pa } : {}),
          simplesAnexo: anexo,
          ...(folhaMensal ? { payroll: Math.round(folhaMensal * 100) / 100 } : {}),
        },
        year: latestSim?.year_id,
        clientName: latestSim?.client_name ?? caseItem.client_name ?? "",
        cnpjData: latestSim?.cnpj_data ?? null,
        pgdasdOrigin: {
          competencia: record.competencia,
          anexo,
          rbt12: record.rbt12,
        },
      }),
    );
    void withAuthRetry(() => markApplied({ data: { id: record.id } })).catch(() => undefined);
    void navigate({ to: "/simulador" });
  };

  const apagar = async (id: string) => {
    await withAuthRetry(() => remove({ data: { id } }));
    await refresh();
  };

  /* ---------------- conferência ---------------- */

  if (draft) {
    const competenciaAntiga = isCompetenciaAntiga(draft.competencia);
    const patch = (p: Partial<PgdasdExtraction>) => setDraft((prev) => ({ ...prev!, ...p }));
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            Conferência do PGDAS-D — {fileName}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {PGDASD_STATUS_LABELS[draft.status]}. Confira os valores ao lado do que o motor usa
            hoje. Nada é aplicado antes da sua confirmação.
          </p>
        </div>

        {draft.status === "sem_texto" ? (
          <Notice tone="warning">
            Este PDF não tem texto selecionável (provavelmente é imagem digitalizada). Preencha os
            campos manualmente abaixo.
          </Notice>
        ) : null}
        {draft.faltantes.length > 0 && draft.status !== "sem_texto" ? (
          <Notice tone="warning">
            Não encontramos no PDF: {draft.faltantes.join(", ")}. Complete manualmente.
          </Notice>
        ) : null}
        {cnpjDivergente ? (
          <Notice tone="warning">
            O CNPJ do documento ({formatCnpjMask(draft.cnpj ?? "")}) é diferente do CNPJ do Caso (
            {formatCnpjMask(caseItem.cnpj ?? "")}). Confira antes de aplicar.
          </Notice>
        ) : null}
        {competenciaAntiga ? (
          <Notice tone="warning">
            A competência {draft.competencia} tem mais de 12 meses. O RBT12 pode não refletir a
            situação atual.
          </Notice>
        ) : null}

        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Campo</th>
                <th className="px-3 py-2">Extraído do PGDAS-D (editável)</th>
                <th className="px-3 py-2">Hoje no motor</th>
              </tr>
            </thead>
            <tbody className="[&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-input [&_input]:bg-card [&_input]:px-2 [&_input]:py-1">
              <tr className="border-t border-border">
                <td className="px-3 py-2">Competência (MM/AAAA)</td>
                <td className="px-3 py-2">
                  <input
                    value={draft.competencia ?? ""}
                    onChange={(e) => patch({ competencia: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">CNPJ</td>
                <td className="px-3 py-2">
                  <input
                    value={draft.cnpj ?? ""}
                    onChange={(e) => patch({ cnpj: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {caseItem.cnpj ? formatCnpjMask(caseItem.cnpj) : "—"}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">Razão social</td>
                <td className="px-3 py-2">
                  <input
                    value={draft.razaoSocial ?? ""}
                    onChange={(e) => patch({ razaoSocial: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {caseItem.client_name ?? "—"}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">RBT12</td>
                <td className="px-3 py-2">
                  <input
                    value={num(draft.rbt12)}
                    onChange={(e) => patch({ rbt12: toNum(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {motor.revenue
                    ? `${brl(motor.revenue * 12)} (faturamento mensal × 12)`
                    : "—"}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">Receita bruta do período</td>
                <td className="px-3 py-2">
                  <input
                    value={num(draft.receitaBrutaPa)}
                    onChange={(e) => patch({ receitaBrutaPa: toNum(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {motor.revenue ? brl(motor.revenue) : "—"}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">Folha de salários (12 meses)</td>
                <td className="px-3 py-2">
                  <input
                    value={num(draft.folha12Meses)}
                    onChange={(e) => patch({ folha12Meses: toNum(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {motor.payroll ? `${brl(motor.payroll)} por mês` : "—"}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">Valor total do DAS</td>
                <td className="px-3 py-2">
                  <input
                    value={num(draft.valorTotalDas)}
                    onChange={(e) => patch({ valorTotalDas: toNum(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2">Anexo usado pelo motor</td>
                <td className="px-3 py-2">
                  <select
                    value={anexoEscolhido}
                    onChange={(e) => setAnexoEscolhido(e.target.value)}
                    className="w-full rounded border border-input bg-card px-2 py-1"
                  >
                    {["I", "II", "III", "IV", "V"].map((a) => (
                      <option key={a} value={a}>
                        Anexo {a}
                      </option>
                    ))}
                  </select>
                  {draft.anexos.length > 1 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      O documento traz mais de um anexo (
                      {draft.anexos
                        .map(
                          (a) =>
                            `Anexo ${a.anexo}${a.receita ? ` · ${brl(a.receita)}` : ""}${
                              a.percentual ? ` · ${a.percentual}%` : ""
                            }`,
                        )
                        .join("; ")}
                      ). O motor usa um anexo por cálculo — escolha qual.
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {motor.simplesAnexo ? `Anexo ${motor.simplesAnexo}` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {draft.tributos.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Detalhamento lido: {draft.tributos.map((t) => `${t.tributo} ${brl(t.valor)}`).join(" · ")}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void confirmar()}>
            {busy ? "Gravando..." : "Confirmar dados do PGDAS-D"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(null);
              setFileName("");
            }}
          >
            Cancelar
          </Button>
        </div>
        {error ? <Notice tone="warning">{error}</Notice> : null}
      </div>
    );
  }

  /* ---------------- lista ---------------- */

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-navy hover:bg-secondary">
          {busy ? "Lendo o PDF..." : "Anexar extrato do PGDAS-D (.pdf)"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>
        {items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {items.length} extrato{items.length === 1 ? "" : "s"} conferido
            {items.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-secondary p-3 text-sm">
          <p className="font-semibold text-foreground">
            {item.competencia ? `Competência ${item.competencia}` : "Competência não informada"} ·{" "}
            {item.arquivo_original || "arquivo"}
          </p>
          <p className="mt-1 text-muted-foreground">
            RBT12 {item.rbt12 ? brl(Number(item.rbt12)) : "—"} · Receita do período{" "}
            {item.receita_bruta_pa ? brl(Number(item.receita_bruta_pa)) : "—"} · Anexo{" "}
            {item.anexos?.[0]?.anexo ?? "—"} ·{" "}
            {item.folha_12_meses ? `Folha 12m ${brl(Number(item.folha_12_meses))}` : "Folha —"}
          </p>
          {caseItem.simulations.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Este Caso já tem cálculo salvo. Nada foi recalculado automaticamente: abra o
              simulador para aplicar estes dados e salvar de novo, se quiser.
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => abrirSimulador(item)}>Abrir simulador com estes dados</Button>
            <Button variant="ghost" onClick={() => void apagar(item.id)}>
              Remover
            </Button>
          </div>
          {item.aplicado_ao_calculo ? (
            <p className="mt-2 text-xs text-muted-foreground">Já levado ao motor de cálculo.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
