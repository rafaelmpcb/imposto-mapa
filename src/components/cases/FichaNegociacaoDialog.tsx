/**
 * Ficha executiva de negociação comercial.
 * Camada de apresentação: recebe o retrato já compilado da contraparte
 * (fornecedor ou cliente) e pede à IA um argumentário de negociação.
 */
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gerarFichaNegociacao, type EntradaFichaNegociacao } from "@/lib/negociacao.functions";
import type { FornecedorDetalheSnap } from "@/lib/parecer/tipos";

const OBJETIVOS = [
  "Renegociar preço de compra usando o crédito de IBS/CBS",
  "Resistir a reajuste pedido pela contraparte",
  "Defender o preço atual e a margem (retenção do cliente)",
  "Repactuar contrato de longo prazo para a transição 2026-2033",
  "Trocar de fornecedor por um do Regime Normal",
];

/** Converte um texto em markdown simples em blocos legíveis. */
function FichaTexto({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {linhas.map((linha, i) => {
        const l = linha.trim();
        if (!l) return <div key={i} className="h-1" />;
        if (l.startsWith("### "))
          return (
            <h5 key={i} className="pt-2 font-semibold text-foreground">
              {l.slice(4)}
            </h5>
          );
        if (l.startsWith("## "))
          return (
            <h4
              key={i}
              className="border-b border-border pb-1 pt-4 font-presentation-display text-lg text-foreground"
            >
              {l.slice(3)}
            </h4>
          );
        if (l.startsWith("# "))
          return (
            <h3 key={i} className="font-presentation-display text-xl text-foreground">
              {l.slice(2)}
            </h3>
          );
        if (l.startsWith("|"))
          return (
            <p key={i} className="font-mono text-xs text-muted-foreground">
              {l}
            </p>
          );
        if (/^[-*] /.test(l))
          return (
            <p key={i} className="pl-4 text-muted-foreground">
              • {l.slice(2)}
            </p>
          );
        return (
          <p key={i} className="text-muted-foreground">
            {l}
          </p>
        );
      })}
    </div>
  );
}

export function FichaNegociacaoDialog({
  aberto,
  onOpenChange,
  relacao,
  detalhe,
  totalBase,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  relacao: "fornecedor" | "cliente";
  detalhe: FornecedorDetalheSnap;
  totalBase: number;
}) {
  const gerar = useServerFn(gerarFichaNegociacao);
  const [objetivo, setObjetivo] = useState<string>(OBJETIVOS[0]!);
  const [observacoes, setObservacoes] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ficha, setFicha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const entrada: EntradaFichaNegociacao = {
    relacao,
    nome: detalhe.nome,
    cnpj: detalhe.cnpj,
    regime: detalhe.regime,
    valorBase: detalhe.valorBase,
    credito: detalhe.credito,
    participacaoPct: totalBase > 0 ? (detalhe.valorBase / totalBase) * 100 : 0,
    notas: detalhe.notas.length,
    itens: detalhe.itens,
    pendentes: detalhe.pendentes,
    meses: detalhe.meses.length,
    topCodigos: detalhe.topNcms.slice(0, 10).map((n) => ({
      codigo: n.ncm,
      descricao: n.descricao,
      valorBase: n.valorBase,
    })),
    objetivo,
    observacoes: observacoes.trim() ? observacoes.trim() : null,
  };

  async function executar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await gerar({ data: entrada });
      setFicha(r.ficha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar a ficha.");
    } finally {
      setCarregando(false);
    }
  }

  const titulo = detalhe.nome ?? detalhe.cnpj ?? "Contraparte";

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-presentation-display text-xl">
            Ficha de negociação · {titulo}
          </DialogTitle>
          <DialogDescription>
            Argumentário construído a partir dos números já apurados no diagnóstico deste caso.
            Revise antes de entregar ao cliente.
          </DialogDescription>
        </DialogHeader>

        {ficha === null ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <p>
                Volume analisado: <strong>{detalhe.valorBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>{" "}
                · crédito de IBS/CBS:{" "}
                <strong>{detalhe.credito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>{" "}
                · {detalhe.notas.length} nota(s)
                {detalhe.pendentes > 0 ? ` · ${detalhe.pendentes} item(ns) em revisão` : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Objetivo da conversa</Label>
              <div className="flex flex-wrap gap-2">
                {OBJETIVOS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setObjetivo(o)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      objetivo === o
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs-negociacao">Contexto adicional (opcional)</Label>
              <Textarea
                id="obs-negociacao"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: o fornecedor avisou que vai reajustar 10% alegando a reforma; contrato vence em março."
                rows={3}
              />
            </div>

            {erro ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </p>
            ) : null}

            <Button onClick={executar} disabled={carregando} className="w-full">
              {carregando ? "Montando o argumentário..." : "Gerar ficha de negociação"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(ficha);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
              >
                {copiado ? "Copiado" : "Copiar texto"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                Imprimir
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFicha(null)}>
                Gerar novamente
              </Button>
            </div>
            <FichaTexto texto={ficha} />
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Conteúdo gerado por IA a partir dos dados do diagnóstico. Estimativa de apoio à
              negociação; não substitui parecer jurídico assinado.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
