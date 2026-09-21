import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { saveNotasServico } from "@/lib/nfse.functions";
import { parseNfseXml, type NfseNota } from "@/lib/nfse/parse";
import { readNfeRawFiles } from "@/lib/nfe/parse";
import { formatCnpjMask, onlyDigits } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

type Lado = "tomado" | "prestado" | "nao_identificado";

interface Draft {
  nota: NfseNota;
  lado: Lado;
  incluir: boolean;
}

const LADO_LABEL: Record<Lado, string> = {
  tomado: "Serviço tomado",
  prestado: "Serviço prestado",
  nao_identificado: "Não identificado",
};

/** Envio das notas de serviço (NFS-e) tomadas pelo cliente do Caso. */
export function NfseServicoPanel({
  caseId,
  caseCnpj,
  onSaved,
}: {
  caseId: string;
  caseCnpj: string | null;
  onSaved?: () => void | Promise<void>;
}) {
  const salvar = useServerFn(saveNotasServico);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const cnpjCaso = onlyDigits(caseCnpj ?? "");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const brutos = await readNfeRawFiles(Array.from(files));
      const lidas = brutos
        .map((b) => parseNfseXml(b.xml, b.arquivo))
        .filter((n) => n.status !== "nao_e_nfse");
      if (lidas.length === 0) {
        setError("Nenhuma nota de serviço (NFS-e) foi encontrada nos arquivos enviados.");
        return;
      }
      setDrafts(
        lidas.map((nota) => {
          const lado: Lado = !cnpjCaso
            ? "nao_identificado"
            : nota.cnpjTomador === cnpjCaso
              ? "tomado"
              : nota.cnpjPrestador === cnpjCaso
                ? "prestado"
                : "nao_identificado";
          return { nota, lado, incluir: lado !== "nao_identificado" };
        }),
      );
    } catch {
      setError("Não foi possível ler os arquivos. Envie .xml de NFS-e ou um .zip com eles.");
    } finally {
      setBusy(false);
    }
  };

  const selecionadas = useMemo(() => drafts.filter((d) => d.incluir), [drafts]);
  const totalSelecionado = selecionadas.reduce((acc, d) => acc + d.nota.valorTotal, 0);

  const confirmar = async () => {
    setBusy(true);
    setError("");
    try {
      const tomadas = selecionadas.filter((d) => d.lado !== "prestado").map((d) => d.nota);
      const prestadas = selecionadas.filter((d) => d.lado === "prestado").map((d) => d.nota);
      let notasGravadas = 0;
      let servicos = 0;
      if (tomadas.length > 0) {
        const res = await withAuthRetry(() =>
          salvar({ data: { caseId, notas: tomadas, direcao: "tomado" } }),
        );
        notasGravadas += res.inserted;
        servicos += res.itens;
      }
      if (prestadas.length > 0) {
        const res = await withAuthRetry(() =>
          salvar({ data: { caseId, notas: prestadas, direcao: "prestado" } }),
        );
        notasGravadas += res.inserted;
        servicos += res.itens;
      }
      setDrafts([]);
      setInfo(
        `${notasGravadas} nota(s) de serviço gravada(s), ${servicos} serviço(s) apurado(s). Notas repetidas foram ignoradas.`,
      );
      await onSaved?.();
    } catch {
      setError("Não foi possível gravar as notas de serviço.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-navy hover:bg-secondary">
          Anexar NFS-e (.xml ou .zip)
          <input
            type="file"
            multiple
            accept=".xml,.zip"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </label>
        {!cnpjCaso ? (
          <span className="text-xs text-muted-foreground">
            O Caso está sem CNPJ: marque manualmente quais notas são de serviços tomados.
          </span>
        ) : null}
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}
      {info ? <Notice>{info}</Notice> : null}

      {drafts.length > 0 ? (
        <>
          <div className="max-h-[24rem] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Incluir</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Prestador</th>
                  <th className="px-3 py-2">Lado</th>
                  <th className="px-3 py-2 text-right">Serviços</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, index) => (
                  <tr key={`${d.nota.arquivo}-${index}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={d.incluir}
                        onChange={(e) =>
                          setDrafts((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, incluir: e.target.checked } : row,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{d.nota.numero ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">{d.nota.arquivo}</span>
                    </td>
                    <td className="px-3 py-2">
                      {d.nota.razaoSocialPrestador ?? "—"}
                      {d.nota.cnpjPrestador ? (
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          {formatCnpjMask(d.nota.cnpjPrestador)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{LADO_LABEL[d.lado]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.nota.itens.length}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(d.nota.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-muted-foreground">
            {selecionadas.length} nota(s) marcada(s) como serviço tomado ·{" "}
            {brl(totalSelecionado)} no total. Nada é gravado antes da confirmação.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || selecionadas.length === 0} onClick={() => void confirmar()}>
              {busy ? "Gravando..." : "Confirmar e salvar"}
            </Button>
            <Button variant="ghost" onClick={() => setDrafts([])}>
              Cancelar
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
