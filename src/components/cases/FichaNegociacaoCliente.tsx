/**
 * Ficha de negociação com o cliente — 100% determinística, sem IA.
 * Reaproveita o mesmo motor de cenários usado em CenariosCliente
 * (src/lib/contratos/calculo.ts) e as minutas de cláusula/notificação que já
 * existiam nesse módulo mas nunca tinham sido conectadas a uma tela.
 *
 * Objetivo: dar ao advogado (e, impressa, ao cliente) os números e o texto
 * prontos pra sustentar uma decisão de aumentar, reduzir ou manter o preço —
 * sem depender de um modelo de IA gerar isso de novo a cada clique.
 */
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ANOS_DISPONIVEIS,
  CENARIO_LABEL,
  calcularContrato,
  minutaClausula,
  minutaNotificacao,
  type CenarioId,
  type ContratoInput,
  type RegimePrestador,
} from "@/lib/contratos/calculo";
import { brl } from "@/lib/tax/calc";
import type { ClienteDetalheSnap } from "@/lib/parecer/tipos";

const pct = (v: number) =>
  `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Alguns prestadores gravam "\s"/"\n" como texto literal (não espaço/quebra
 * de linha de verdade) na descrição do serviço, direto no XML da nota — não
 * é um bug nosso de concatenar campos, é o documento de origem mesmo. */
const limparDescricao = (s: string | null) =>
  (s ?? "").replace(/\\[sn]/g, " ").replace(/\s+/g, " ").trim();

/** Mesmo mapeamento usado em CenariosCliente, pra abrir já no regime certo. */
function regimePrestadorDoCaso(regimeAtual: string | null | undefined): RegimePrestador {
  if (!regimeAtual) return "presumido";
  const r = regimeAtual.toLowerCase();
  if (r.includes("real")) return "real";
  if (r.includes("simples")) return "simples";
  return "presumido";
}

type Foco = CenarioId | "absorcao";

const FOCO_OPCOES: { id: Foco; label: string; descricao: string }[] = [
  { id: "absorcao", label: "Manter o preço", descricao: "Absorve o impacto inteiro na margem" },
  { id: "margem_prestador", label: "Repassar integralmente", descricao: "Preserva sua margem de hoje" },
  { id: "custo_contratante", label: "Preservar o custo do cliente", descricao: "Ele não sente nada no bolso" },
  { id: "equilibrio", label: "Meio-termo", descricao: "Divide o impacto entre as partes" },
];

export function FichaNegociacaoCliente({
  aberto,
  onOpenChange,
  d,
  totalBase,
  regimeAtualCaso,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  d: ClienteDetalheSnap;
  totalBase: number;
  regimeAtualCaso?: string | null | undefined;
}) {
  const [regime, setRegime] = useState<RegimePrestador>(() => regimePrestadorDoCaso(regimeAtualCaso));
  const [custoPct, setCustoPct] = useState(40);
  const [ano, setAno] = useState(2027);
  const [foco, setFoco] = useState<Foco>("equilibrio");
  const [copiado, setCopiado] = useState(false);

  const precoMensal = d.valorBase / Math.max(1, d.meses.length);
  const perfil = d.regime === "simples" ? "simples" : "regular";

  const base: Omit<ContratoInput, "ano" | "cenario"> = {
    precoMensalAtual: precoMensal,
    regimePrestador: regime,
    perfilContratante: perfil,
    custoDiretoPct: custoPct,
    creditoInsumosPct: 50,
  };

  // Para os 3 cenários de ajuste, o próprio motor já devolve a trajetória
  // 2026-2033 em `evolucao`. Para "manter o preço" não existe um CenarioId —
  // o preço nunca muda, então a série vem de `semReequilibrio` ano a ano
  // (o mesmo caminho que CenariosCliente usa pra desenhar a barra "Absorvendo").
  const { r, trajetoria } = useMemo(() => {
    if (foco === "absorcao") {
      const rAno = calcularContrato({ ...base, ano, cenario: "margem_prestador" });
      const traj = ANOS_DISPONIVEIS.map((a) => {
        const ra = a === ano ? rAno : calcularContrato({ ...base, ano: a, cenario: "margem_prestador" });
        return {
          ano: a,
          preco: ra.semReequilibrio.precoContrato,
          margem: ra.semReequilibrio.margemPrestador,
          variacaoPct: 0,
        };
      });
      return { r: rAno, trajetoria: traj };
    }
    const rAno = calcularContrato({ ...base, ano, cenario: foco });
    return {
      r: rAno,
      trajetoria: rAno.evolucao.map((e) => ({
        ano: e.ano,
        preco: e.precoSugerido,
        margem: e.margemPrestador,
        variacaoPct: e.variacaoPct,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precoMensal, regime, perfil, custoPct, ano, foco]);

  const focoAtual = FOCO_OPCOES.find((f) => f.id === foco)!;
  const cenario = foco === "absorcao" ? null : r.cenarios.find((c) => c.id === foco)!;
  const precoFoco = foco === "absorcao" ? r.semReequilibrio.precoContrato : cenario!.precoSugerido;
  const variacaoFoco = foco === "absorcao" ? 0 : cenario!.variacaoPrecoPct;
  const margemFoco = foco === "absorcao" ? r.semReequilibrio.margemPrestador : cenario!.detalhe.margemPrestador;
  const variacaoMargemFoco =
    foco === "absorcao"
      ? r.atual.margemPrestador > 0
        ? ((r.semReequilibrio.margemPrestador - r.atual.margemPrestador) / r.atual.margemPrestador) * 100
        : 0
      : cenario!.variacaoMargemPct;
  const creditoFoco = foco === "absorcao" ? 0 : cenario!.detalhe.creditoContratante;
  const creditoPctDoAumento =
    foco !== "absorcao" && cenario && cenario.precoSugerido > r.atual.precoContrato
      ? Math.min(100, (creditoFoco / (cenario.precoSugerido - r.atual.precoContrato)) * 100)
      : 0;

  const leitura = useMemo(() => {
    if (foco === "absorcao") {
      return "Manter o preço hoje significa absorver toda a diferença na sua margem. Pode fazer sentido como gesto comercial pontual com um cliente estratégico, mas não é sustentável se repetido ano a ano — a carga do IBS/CBS sobe até 2033.";
    }
    if (perfil === "simples") {
      return `Esse cliente está no Simples Nacional e não recupera o IBS/CBS destacado na nota — o reajuste de ${pct(variacaoFoco)} tende a ser sentido por ele de forma praticamente integral. Vale negociar um prazo de adaptação ou um percentual intermediário em vez do valor cheio de uma vez.`;
    }
    if (creditoPctDoAumento > 50) {
      return `O reajuste nominal é de ${pct(variacaoFoco)}, mas ${brl(creditoFoco)} (${creditoPctDoAumento.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do aumento) retornam ao cliente como crédito de IBS/CBS — o custo líquido real dele sobe bem menos do que o valor nominal da nota. Esse é o argumento central da conversa.`;
    }
    return `Reajuste de ${pct(variacaoFoco)} necessário neste cenário, sobre o preço mensal médio de ${brl(r.atual.precoContrato)}.`;
  }, [foco, perfil, variacaoFoco, creditoFoco, creditoPctDoAumento, r.atual.precoContrato]);

  const objecoes = useMemo(() => {
    const lista = [
      {
        q: "Por que mudar o preço se o contrato já está fechado?",
        a: "O preço atual foi formado com a carga tributária vigente na contratação. A reforma (EC 132/2023 e LC 214/2025) substitui PIS, COFINS, ICMS e ISS pelo IBS/CBS, destacado por fora do preço — é fato superveniente que autoriza a revisão do equilíbrio econômico original.",
      },
    ];
    if (perfil === "simples") {
      lista.push({
        q: "Por que eu pagaria mais se não recupero nada disso como crédito?",
        a: "De fato, no Simples Nacional o IBS/CBS destacado não é recuperável — por isso o aumento tende a ser sentido de forma integral. Uma alternativa é escalonar o reajuste ao longo da própria transição (2027-2033) em vez de aplicar o valor cheio de uma vez.",
      });
    } else if (foco !== "absorcao" && creditoPctDoAumento > 0) {
      lista.push({
        q: "O aumento parece alto.",
        a: `Do reajuste proposto, ${brl(creditoFoco)} (${creditoPctDoAumento.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%) retornam ao cliente como crédito de IBS/CBS na apuração dele — o custo líquido efetivo sobe bem menos do que o valor nominal da nota sugere.`,
      });
    }
    lista.push({
      q: "Esses números são definitivos?",
      a: "São estimativas de apoio à negociação: usam a alíquota plena de referência e a rampa oficial da transição (ADCT/EC 132/2023). A alíquota efetiva final e eventuais reduções setoriais ainda dependem de regulamentação complementar em curso.",
    });
    return lista;
  }, [perfil, foco, creditoFoco, creditoPctDoAumento]);

  const tituloContrato = `Prestação de serviços — ${d.nome ?? d.cnpj ?? "cliente"}`;
  const clausula = foco !== "absorcao" ? minutaClausula(r, tituloContrato) : null;
  const notificacao =
    foco !== "absorcao" ? minutaNotificacao(r, tituloContrato, d.nome ?? d.cnpj ?? "") : null;

  const resumoTexto = useMemo(() => {
    const linhas = [
      `FICHA DE NEGOCIAÇÃO — ${d.nome ?? d.cnpj ?? "Cliente"}`,
      `Cenário: ${focoAtual.label} (${focoAtual.descricao})`,
      `Ano de referência: ${ano} · Alíquota efetiva estimada: ${r.aliquotaEfetivaPct.toLocaleString("pt-BR")}%`,
      "",
      `Preço mensal hoje: ${brl(r.atual.precoContrato)}`,
      `Preço sugerido neste cenário: ${brl(precoFoco)} (${pct(variacaoFoco)})`,
      `Margem mensal: ${brl(margemFoco)} (${pct(variacaoMargemFoco)} vs. hoje)`,
      foco !== "absorcao" ? `Crédito de IBS/CBS que volta ao cliente: ${brl(creditoFoco)}` : "",
      "",
      leitura,
    ];
    if (clausula) linhas.push("", clausula);
    return linhas.filter((l) => l !== "").join("\n");
  }, [d.nome, d.cnpj, focoAtual, ano, r, precoFoco, variacaoFoco, margemFoco, variacaoMargemFoco, foco, creditoFoco, leitura, clausula]);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-presentation-display text-xl">
            Ficha de negociação · {d.nome ?? d.cnpj ?? "Cliente"}
          </DialogTitle>
          <DialogDescription>
            Números e minutas calculados a partir do diagnóstico deste Caso — nada aqui é gerado por
            IA. Revise antes de levar ao cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Regime do prestador</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1"
                value={regime}
                onChange={(e) => setRegime(e.target.value as RegimePrestador)}
              >
                <option value="presumido">Presumido</option>
                <option value="real">Real</option>
                <option value="simples">Simples</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span
                className="text-muted-foreground underline decoration-dotted"
                title="% do preço que já é seu custo direto nesse contrato (mão de obra, insumos). Não aparece no texto pro cliente — só ajusta sua margem calculada aqui."
              >
                Custo direto (%) ⓘ
              </span>
              <input
                type="number"
                min={0}
                max={95}
                value={custoPct}
                onChange={(e) => setCustoPct(Number(e.target.value))}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Ano de referência</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1"
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
              >
                {ANOS_DISPONIVEIS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cenário de negociação
            </p>
            <div className="flex flex-wrap gap-2">
              {FOCO_OPCOES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFoco(o.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    foco === o.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                  title={o.descricao}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border-2 border-primary/40 bg-card p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{focoAtual.label}</p>
            <p className="text-xs text-muted-foreground">{focoAtual.descricao}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="font-presentation-display text-xl text-foreground">{brl(precoFoco)}</p>
                <p className="text-[11px] text-muted-foreground">
                  preço mensal · {pct(variacaoFoco)} vs. hoje ({brl(r.atual.precoContrato)})
                </p>
              </div>
              <div>
                <p className="font-presentation-display text-xl text-foreground">{brl(margemFoco)}</p>
                <p className="text-[11px] text-muted-foreground">
                  sua margem mensal · {pct(variacaoMargemFoco)} vs. hoje
                </p>
              </div>
              <div>
                <p className="font-presentation-display text-xl text-foreground">
                  {foco === "absorcao" ? "—" : brl(creditoFoco)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {foco === "absorcao" ? "preço não muda" : "crédito de IBS/CBS que volta ao cliente"}
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-border pt-2 text-sm text-foreground">{leitura}</p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Trajetória 2026-2033 neste cenário
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 font-semibold">Ano</th>
                  <th className="pb-1 text-right font-semibold">Preço</th>
                  <th className="pb-1 text-right font-semibold">Variação</th>
                  <th className="pb-1 text-right font-semibold">Sua margem</th>
                </tr>
              </thead>
              <tbody>
                {trajetoria.map((t) => (
                  <tr key={t.ano} className={`border-t border-border/60 ${t.ano === ano ? "bg-muted/40 font-medium" : ""}`}>
                    <td className="py-1 text-foreground">{t.ano}</td>
                    <td className="py-1 text-right tabular-nums text-foreground">{brl(t.preco)}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">{pct(t.variacaoPct)}</td>
                    <td className="py-1 text-right tabular-nums text-foreground">{brl(t.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {d.topNcms.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Principais itens atendidos
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {d.topNcms.slice(0, 5).map((n) => (
                  <li key={n.ncm} className="flex justify-between gap-2">
                    <span className="truncate">
                      {n.ncm}
                      {n.descricao ? ` · ${limparDescricao(n.descricao)}` : ""}
                    </span>
                    <span className="tabular-nums">{brl(n.valorBase)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Objeções e respostas
            </p>
            <div className="space-y-2">
              {objecoes.map((o) => (
                <div key={o.q} className="rounded-lg border border-border p-2.5 text-xs">
                  <p className="font-semibold text-foreground">{o.q}</p>
                  <p className="mt-0.5 text-muted-foreground">{o.a}</p>
                </div>
              ))}
            </div>
          </div>

          {clausula ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Minuta de cláusula de reequilíbrio
              </p>
              <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground">
                {clausula}
              </pre>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Nesse cenário o preço não muda, então não há cláusula de reajuste a redigir — é a opção
              de manter o status quo.
            </p>
          )}

          {notificacao ? (
            <details className="rounded-lg border border-border p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-foreground">
                Minuta de notificação / e-mail ao cliente
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{notificacao}</pre>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(resumoTexto);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
            >
              {copiado ? "Copiado" : "Copiar resumo"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estimativa de apoio à negociação, calculada a partir dos documentos deste Caso — não
            substitui aconselhamento jurídico ou tributário individualizado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
