import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import {
  getCreditoServicoItens,
  getDebitoServicoItens,
  resolverServicoAmbiguo,
  type DirecaoServico,
} from "@/lib/nfse.functions";
import { FONTE_TABELA_NBS, type OpcaoServico } from "@/lib/nfse/credito";
import { brl } from "@/lib/tax/calc";

interface Pendente {
  id: string;
  direcao: DirecaoServico;
  nbs: string | null;
  descricao: string | null;
  valor: number;
  contraparte: string | null;
  notaNumero: string | null;
  opcoes: OpcaoServico[];
}

const DIRECAO_LABEL: Record<DirecaoServico, string> = {
  tomado: "Tomado (crédito)",
  prestado: "Prestado (débito)",
};

/** Fila única de revisão do analista para serviços com NBS ambíguo, compras e vendas. */
export function RevisaoNbsPanel({
  caseId,
  onResolved,
}: {
  caseId: string;
  onResolved?: () => void;
}) {
  const fetchCredito = useServerFn(getCreditoServicoItens);
  const fetchDebito = useServerFn(getDebitoServicoItens);
  const resolver = useServerFn(resolverServicoAmbiguo);

  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [credito, debito] = await Promise.all([
        withAuthRetry(() => fetchCredito({ data: { caseId } })),
        withAuthRetry(() => fetchDebito({ data: { caseId } })),
      ]);
      const tomados: Pendente[] = credito.itens
        .filter((i) => i.status_classificacao === "ambiguo_revisao_pendente")
        .map((i) => ({
          id: i.id,
          direcao: "tomado",
          nbs: i.nbs,
          descricao: i.descricao,
          valor: Number(i.valor_servico),
          contraparte: i.prestador,
          notaNumero: i.nota_numero,
          opcoes: i.opcoes_candidatas,
        }));
      const prestados: Pendente[] = debito.itens
        .filter((i) => i.status_classificacao === "ambiguo_revisao_pendente")
        .map((i) => ({
          id: i.id,
          direcao: "prestado",
          nbs: i.nbs,
          descricao: i.descricao,
          valor: Number(i.valor_servico),
          contraparte: i.tomador,
          notaNumero: i.nota_numero,
          opcoes: i.opcoes_candidatas,
        }));
      setPendentes([...tomados, ...prestados]);
    } catch {
      setError("Não foi possível carregar a fila de revisão dos serviços.");
    }
  }, [caseId, fetchCredito, fetchDebito]);

  useEffect(() => {
    void load();
  }, [load]);

  const escolher = async (item: Pendente, opcao: OpcaoServico) => {
    setBusy(true);
    setError("");
    try {
      await withAuthRetry(() =>
        resolver({
          data: {
            itemId: item.id,
            direcao: item.direcao,
            cclasstrib: opcao.cclasstrib,
            nome: opcao.nome_cclasstrib,
            ibsPct: opcao.aliquota_ibs_2026,
            cbsPct: opcao.aliquota_cbs_2026,
          },
        }),
      );
      await load();
      onResolved?.();
    } catch {
      setError("Não foi possível registrar a decisão para este serviço.");
    } finally {
      setBusy(false);
    }
  };

  if (pendentes.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Fila de revisão do analista — serviços (NBS)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Serviços tomados e prestados com mais de uma classificação possível. A decisão vale só
          para o serviço escolhido.
        </p>
      </div>

      {error ? <Notice tone="warning">{error}</Notice> : null}

      {pendentes.map((item) => (
        <div key={`${item.direcao}-${item.id}`} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
              {DIRECAO_LABEL[item.direcao]}
            </span>
            <p className="font-medium text-foreground">
              NBS {item.nbs ?? "—"} · {item.descricao ?? "sem descrição"}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Nota {item.notaNumero ?? "—"} · {item.contraparte ?? "—"} · {brl(item.valor)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.opcoes.map((o, idx) => (
              <button
                key={`${item.id}-${idx}`}
                type="button"
                disabled={busy}
                onClick={() => void escolher(item, o)}
                className="max-w-sm rounded border border-input px-2 py-1 text-left text-xs font-semibold text-foreground hover:bg-secondary"
              >
                {o.cclasstrib ?? "—"} · IBS {o.aliquota_ibs_2026}% + CBS {o.aliquota_cbs_2026}%
                <span className="block font-normal text-muted-foreground">{o.nome_cclasstrib}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">{FONTE_TABELA_NBS}</p>
    </div>
  );
}
