import { useRef, useState } from "react";

import { Notice } from "@/components/simulator/ui";
import { triarPacote, type TriagemResultado } from "@/lib/carga/triagem";

export interface PacoteTriado {
  id: number;
  resultado: TriagemResultado;
}

/**
 * Caixa única: recebe o pacote do jeito que veio (ReceitaNetBX, contador, ERP)
 * e distribui cada arquivo para o leitor certo do Caso.
 */
export function UploadUnicoPanel({
  caseCnpj,
  onTriado,
}: {
  caseCnpj: string | null;
  onTriado: (p: PacoteTriado) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [resumo, setResumo] = useState<TriagemResultado | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processar = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const resultado = await triarPacote(Array.from(list), caseCnpj);
      setResumo(resultado);
      onTriado({ id: Date.now(), resultado });
    } catch {
      setError("Não foi possível abrir o pacote enviado.");
    } finally {
      setBusy(false);
    }
  };

  const semCnpj = (caseCnpj ?? "").replace(/\D/g, "").length !== 14;
  const tiposReconhecidos = resumo
    ? [
        resumo.nfe.length > 0,
        resumo.nfseTomado.length > 0,
        resumo.nfsePrestado.length > 0,
        resumo.pgdasd.length > 0,
        resumo.planilhas.length > 0,
        resumo.sped.length > 0,
      ].filter(Boolean).length
    : 0;

  return (
    <div>
      {semCnpj ? (
        <div className="mb-2">
          <Notice tone="warning">
            Cadastre o CNPJ do Caso: é ele que define o que é compra/venda e tomado/prestado.
          </Notice>
        </div>
      ) : null}
      <label
        role="button"
        tabIndex={0}
        aria-label="Enviar pacote de documentos"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void processar(e.dataTransfer.files);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm font-semibold text-navy hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          drag ? "border-primary bg-secondary" : "border-input"
        }`}
      >
        {busy ? "Separando os arquivos…" : "Arraste o pacote aqui ou clique para escolher"}
        <span className="mt-1 text-xs font-normal text-muted-foreground">
          .zip, .xml, .json, .txt (SPED), .pdf, .xlsx, .csv — vários de uma vez, do jeito que vieram
          (ReceitaNetBX, contador ou ERP)
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.xml,.json,.pdf,.xlsx,.xls,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            void processar(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {error ? (
        <div className="mt-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      ) : null}

      {resumo ? (
        <div className="mt-3 space-y-2 text-sm">
          <div className="rounded-lg bg-mint-soft px-3 py-2 text-sm text-foreground">
            Pacote lido: o sistema reconheceu e separou {tiposReconhecidos} tipo
            {tiposReconhecidos === 1 ? "" : "s"} de documento. Confira a lista abaixo.
          </div>
          <Notice>
            {resumo.nfe.length} NF-e (compra/venda) · {resumo.nfseTomado.length} NFS-e tomada(s) ·{" "}
            {resumo.nfsePrestado.length} NFS-e prestada(s) · {resumo.pgdasd.length} PDF do PGDAS-D ·{" "}
            {resumo.planilhas.length} planilha(s) · {resumo.naoReconhecidos.length} não reconhecido(s).
          </Notice>
          {resumo.pgdasd.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              Vários PDFs encontrados: o primeiro foi aberto no bloco do PGDAS-D; envie os demais
              por lá, um de cada vez.
            </p>
          ) : null}
          {resumo.sped.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {resumo.sped.length} arquivo(s) do SPED identificado(s). (
              {resumo.sped.filter((x) => x.tipo === "icms_ipi").length} EFD ICMS-IPI ·{" "}
              {resumo.sped.filter((x) => x.tipo === "contribuicoes").length} EFD Contribuições) lido(s)
              — veja a "Conferência do SPED" abaixo.
            </p>
          ) : null}
          {resumo.naoReconhecidos.length > 0 ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Ver arquivos não reconhecidos</summary>
              <ul className="mt-1 space-y-1">
                {resumo.naoReconhecidos.slice(0, 200).map((n, i) => (
                  <li key={`${n.arquivo}-${i}`}>
                    {n.arquivo} — {n.motivo}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
