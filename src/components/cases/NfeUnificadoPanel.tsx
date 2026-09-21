import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { applyNotasCompra, getFornecedoresExistentes, saveNotasCompra } from "@/lib/nfe.functions";
import {
  applyNotasVenda,
  classifyClientesVenda,
  getClientesExistentes,
  saveNotasVenda,
} from "@/lib/nfe-venda.functions";
import {
  aggregateNotas,
  parseNfeXml,
  readNfeRawFiles,
  type NfeNota,
} from "@/lib/nfe/parse";
import { aggregateVendas, parseNfeVendaXml, type NfeVendaNota } from "@/lib/nfe/parse-venda";
import { formatCnpjMask, onlyDigits } from "@/lib/carteira/types";
import { brl } from "@/lib/tax/calc";

type Regime = "simples" | "regular" | "erro";
type Tipo = "fornecedor" | "cliente";

const FONTE_CRT = "XML de NF-e — CRT do emitente";

interface DraftRow {
  cnpj: string;
  nome: string;
  valor: number;
  notas: number;
  tipo: Tipo;
  regime: Regime;
  fonte: string;
  pendente: boolean;
}

interface NaoIdentificada {
  arquivo: string;
  motivo: string;
}

const REGIME_OPTIONS: { value: Regime; label: string }[] = [
  { value: "simples", label: "Simples Nacional" },
  { value: "regular", label: "Regime Regular" },
  { value: "erro", label: "Não classificado" },
];

const cacheKey = (caseId: string) => `nfe-unificado-draft:${caseId}`;

export function NfeUnificadoPanel({
  caseId,
  caseCnpj,
  onApplied,
}: {
  caseId: string;
  caseCnpj: string | null;
  onApplied: () => void | Promise<void>;
}) {
  const saveCompra = useServerFn(saveNotasCompra);
  const saveVenda = useServerFn(saveNotasVenda);
  const applyCompra = useServerFn(applyNotasCompra);
  const applyVenda = useServerFn(applyNotasVenda);
  const classify = useServerFn(classifyClientesVenda);
  const fornecedoresFn = useServerFn(getFornecedoresExistentes);
  const clientesFn = useServerFn(getClientesExistentes);

  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [naoIdentificadas, setNaoIdentificadas] = useState<NaoIdentificada[]>([]);
  const [existentes, setExistentes] = useState<{ fornecedor: string[]; cliente: string[] }>({
    fornecedor: [],
    cliente: [],
  });
  const [substituir, setSubstituir] = useState(true);
  const [busy, setBusy] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const cnpjCaso = onlyDigits(caseCnpj ?? "");

  useEffect(() => {
    const raw = localStorage.getItem(cacheKey(caseId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        drafts: DraftRow[];
        naoIdentificadas: NaoIdentificada[];
      };
      if (parsed.drafts?.length) {
        setDrafts(parsed.drafts);
        setNaoIdentificadas(parsed.naoIdentificadas ?? []);
        setOpen(true);
      }
    } catch {
      /* rascunho inválido */
    }
  }, [caseId]);

  useEffect(() => {
    if (drafts.length === 0) localStorage.removeItem(cacheKey(caseId));
    else localStorage.setItem(cacheKey(caseId), JSON.stringify({ drafts, naoIdentificadas }));
  }, [caseId, drafts, naoIdentificadas]);

  const fornecedores = useMemo(() => drafts.filter((d) => d.tipo === "fornecedor"), [drafts]);
  const clientes = useMemo(() => drafts.filter((d) => d.tipo === "cliente"), [drafts]);
  const pendentes = drafts.filter((d) => d.pendente);
  const semRegime = drafts.filter((d) => d.regime === "erro" && !d.pendente);
  const conferido = drafts.length > 0 && pendentes.length === 0 && semRegime.length === 0;
  const conflitos = drafts.filter((d) =>
    (d.tipo === "fornecedor" ? existentes.fornecedor : existentes.cliente).includes(d.cnpj),
  );

  const patch = (cnpj: string, tipo: Tipo, values: Partial<DraftRow>) =>
    setDrafts((prev) =>
      prev.map((row) => (row.cnpj === cnpj && row.tipo === tipo ? { ...row, ...values } : row)),
    );

  /** Consulta o regime dos clientes em fila, em lotes. */
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
              if (row.tipo !== "cliente") return row;
              const found = res.results.find((r) => r.cnpj === row.cnpj);
              if (!found) return row;
              return { ...row, regime: found.regime, fonte: found.fonte, pendente: false };
            }),
          );
        } catch {
          setDrafts((prev) =>
            prev.map((row) =>
              row.tipo === "cliente" && lote.includes(row.cnpj)
                ? { ...row, regime: "erro", pendente: false }
                : row,
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
    if (cnpjCaso.length !== 14) {
      setError(
        "Cadastre o CNPJ do Caso antes de anexar as notas — é ele que define o que é compra e o que é venda.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let brutos: { arquivo: string; xml: string }[];
      try {
        brutos = await readNfeRawFiles(Array.from(files));
      } catch {
        setError("Não foi possível ler os arquivos. Envie .xml de NF-e ou um .zip com as notas.");
        return;
      }
      if (brutos.length === 0) {
        setError("Nenhum XML de NF-e encontrado nos arquivos enviados.");
        return;
      }

      const notasCompra: NfeNota[] = [];
      const notasVenda: NfeVendaNota[] = [];
      const foraDoCaso: NaoIdentificada[] = [];

      for (const { arquivo, xml } of brutos) {
        const compra = parseNfeXml(xml, arquivo);
        const venda = parseNfeVendaXml(xml, arquivo);
        if (compra.status === "xml_invalido" || compra.status === "nao_e_nfe") {
          foraDoCaso.push({
            arquivo,
            motivo: compra.status === "nao_e_nfe" ? "arquivo não é uma NF-e" : "XML inválido",
          });
          continue;
        }
        const emit = compra.cnpjEmitente ?? "";
        const dest = venda.cnpjDestinatario ?? "";
        if (emit === cnpjCaso) {
          notasVenda.push(venda);
        } else if (dest === cnpjCaso || !dest) {
          if (dest === cnpjCaso || emit) notasCompra.push(compra);
          else foraDoCaso.push({ arquivo, motivo: "sem CNPJ de emitente" });
        } else {
          foraDoCaso.push({
            arquivo,
            motivo: "não identificada — nem emitente nem destinatário é o CNPJ do Caso",
          });
        }
      }

      const agFornecedores = aggregateNotas(notasCompra);
      const agClientes = aggregateVendas(notasVenda);

      const novos: DraftRow[] = [
        ...agFornecedores.map((a) => ({
          cnpj: a.cnpj,
          nome: a.nome,
          valor: a.valor,
          notas: a.notas,
          tipo: "fornecedor" as Tipo,
          regime: a.regime,
          fonte: a.regime === "erro" ? "" : FONTE_CRT,
          pendente: false,
        })),
        ...agClientes.map((a) => ({
          cnpj: a.cnpj,
          nome: a.nome,
          valor: a.valor,
          notas: a.notas,
          tipo: "cliente" as Tipo,
          regime: "erro" as Regime,
          fonte: "",
          pendente: true,
        })),
      ];

      setDrafts(novos);
      setNaoIdentificadas(foraDoCaso);
      setOpen(true);
      setStatus(
        `${brutos.length} nota(s) lida(s) · ${agFornecedores.length} fornecedor(es) · ${agClientes.length} cliente(s) · ${foraDoCaso.length} não identificada(s).`,
      );

      try {
        if (notasCompra.length > 0) {
          await withAuthRetry(() => saveCompra({ data: { caseId, notas: notasCompra } }));
        }
        if (notasVenda.length > 0) {
          await withAuthRetry(() => saveVenda({ data: { caseId, notas: notasVenda } }));
        }
      } catch {
        setError(
          "Os arquivos foram lidos, mas não foi possível registrar as notas agora. Você ainda pode conferir e salvar a composição.",
        );
      }
      try {
        const [f, c] = await Promise.all([
          withAuthRetry(() => fornecedoresFn({ data: { caseId } })),
          withAuthRetry(() => clientesFn({ data: { caseId } })),
        ]);
        setExistentes({ fornecedor: f.cnpjs, cliente: c.cnpjs });
      } catch {
        /* aviso de conflito é opcional */
      }
      await classificar(agClientes.map((a) => a.cnpj));
    } finally {
      setBusy(false);
    }
  };

  const mudarTipo = (row: DraftRow, tipo: Tipo) => {
    if (tipo === row.tipo) return;
    if (tipo === "cliente") {
      patch(row.cnpj, row.tipo, { tipo, pendente: true, fonte: "", regime: "erro" });
      void classificar([row.cnpj]);
    } else {
      patch(row.cnpj, row.tipo, {
        tipo,
        pendente: false,
        fonte: row.regime === "erro" ? "" : FONTE_CRT,
      });
    }
  };

  const confirmar = async () => {
    setBusy(true);
    setError("");
    try {
      let inseridos = 0;
      if (fornecedores.length > 0) {
        const res = await withAuthRetry(() =>
          applyCompra({
            data: {
              caseId,
              substituir,
              rows: fornecedores.map((d) => ({
                cnpj: d.cnpj,
                nome: d.nome,
                valor: d.valor,
                regime: d.regime,
              })),
            },
          }),
        );
        inseridos += res.inserted;
      }
      if (clientes.length > 0) {
        const res = await withAuthRetry(() =>
          applyVenda({
            data: {
              caseId,
              substituir,
              rows: clientes.map((d) => ({
                cnpj: d.cnpj,
                nome: d.nome,
                valor: d.valor,
                regime: d.regime,
                fonte: d.fonte,
              })),
            },
          }),
        );
        inseridos += res.inserted;
      }
      setDrafts([]);
      setNaoIdentificadas([]);
      setOpen(false);
      setStatus(`${inseridos} contraparte(s) gravada(s) na composição de carteira.`);
      await onApplied();
    } catch {
      setError("Não foi possível gravar as contrapartes na composição de carteira.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-input p-3">
      <p className="text-sm font-semibold text-foreground">Notas fiscais (XML de NF-e)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Via alternativa ao relatório: envie vários .xml de NF-e (compra e venda juntas) ou um .zip
        com as notas. Cada nota é comparada com o CNPJ do Caso — emitente igual ao Caso vira venda
        (cliente), destinatário igual ao Caso vira compra (fornecedor). Fornecedores usam o CRT da
        própria nota; clientes têm o regime consultado pelo CNPJ.
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
        {drafts.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {fornecedores.length} fornecedor{fornecedores.length === 1 ? "" : "es"} ·{" "}
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"} ·{" "}
            {naoIdentificadas.length} não identificada
            {naoIdentificadas.length === 1 ? "" : "s"}
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
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">CNPJ</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-right">Notas</th>
                  <th className="px-3 py-2">Regime</th>
                  <th className="px-3 py-2">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((row) => (
                  <tr key={`${row.tipo}-${row.cnpj}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        value={row.nome}
                        onChange={(e) => patch(row.cnpj, row.tipo, { nome: e.target.value })}
                        className="w-full rounded border border-input bg-card px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatCnpjMask(row.cnpj)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.tipo}
                        onChange={(e) => mudarTipo(row, e.target.value as Tipo)}
                        className="rounded border border-input bg-card px-2 py-1 text-sm"
                      >
                        <option value="fornecedor">Fornecedor</option>
                        <option value="cliente">Cliente</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={String(row.valor)}
                        onChange={(e) =>
                          patch(row.cnpj, row.tipo, {
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
                            patch(row.cnpj, row.tipo, {
                              regime: e.target.value as Regime,
                              ...(row.tipo === "fornecedor"
                                ? { fonte: e.target.value === "erro" ? "" : FONTE_CRT }
                                : {}),
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
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {row.tipo === "cliente" ? (
                          <input
                            value={row.fonte}
                            onChange={(e) => patch(row.cnpj, row.tipo, { fonte: e.target.value })}
                            placeholder="—"
                            className="w-52 rounded border border-input bg-card px-2 py-1 text-xs"
                          />
                        ) : (
                          <span>{row.fonte || "—"}</span>
                        )}
                        {row.tipo === "cliente" && !row.pendente && row.regime === "erro" ? (
                          <button
                            type="button"
                            className="whitespace-nowrap rounded border border-input px-2 py-1 text-xs font-semibold text-navy hover:bg-secondary"
                            onClick={() => {
                              patch(row.cnpj, row.tipo, { pendente: true });
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
            {fornecedores.length} fornecedor{fornecedores.length === 1 ? "" : "es"} ·{" "}
            {brl(fornecedores.reduce((acc, d) => acc + d.valor, 0))} em compras ·{" "}
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"} ·{" "}
            {brl(clientes.reduce((acc, d) => acc + d.valor, 0))} em vendas
          </p>

          {naoIdentificadas.length > 0 ? (
            <details className="rounded-xl border border-border bg-secondary p-3 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">
                {naoIdentificadas.length} nota{naoIdentificadas.length === 1 ? "" : "s"} não
                identificada{naoIdentificadas.length === 1 ? "" : "s"} (apenas informativo)
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {naoIdentificadas.slice(0, 50).map((n, i) => (
                  <li key={`${n.arquivo}-${i}`}>
                    {n.arquivo} — {n.motivo}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {classificando || pendentes.length > 0 ? (
            <Notice>
              Consultando o regime de {pendentes.length} cliente
              {pendentes.length === 1 ? "" : "s"} na fila. Pode sair da tela e voltar depois.
            </Notice>
          ) : null}

          {!conferido && pendentes.length === 0 ? (
            <Notice tone="warning">
              {semRegime.length} contraparte{semRegime.length === 1 ? "" : "s"} sem regime. Informe
              manualmente (ou use "Tentar novamente") antes de gravar.
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
                setNaoIdentificadas([]);
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
