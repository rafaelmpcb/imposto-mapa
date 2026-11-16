import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Notice } from "@/components/simulator/ui";
import { SpedImpactoRegimes } from "@/components/cases/SpedImpactoRegimes";
import type { PacoteTriado } from "@/components/cases/UploadUnicoPanel";
import { listSped, removeSped, saveSped, type SpedConferenciaMes, type SpedRegistro } from "@/lib/sped.functions";
import type { SpedContribResumo, SpedIcmsResumo } from "@/lib/sped/parse";
import { brl } from "@/lib/tax/calc";

const mesDe = (d: string) => d.slice(0, 7);
const rotuloMes = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

function Diferenca({ sped, xml }: { sped: number; xml: number }) {
  const d = pct(xml, sped);
  if (d == null) return <span className="text-muted-foreground">—</span>;
  const ok = Math.abs(d) <= 2;
  return (
    <span className={ok ? "text-muted-foreground" : "font-semibold text-destructive"}>
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}%
    </span>
  );
}

/**
 * Escrituração (EFD ICMS-IPI e EFD Contribuições): apuração declarada, saldos
 * credores e conferência mês a mês contra os XMLs do Caso.
 */
export function SpedPanel({
  caseId,
  pacote,
  onStatus,
}: {
  caseId: string;
  pacote: PacoteTriado | null;
  onStatus?: (s: { icmsMeses: number; contribMeses: number }) => void;
}) {
  const list = useServerFn(listSped);
  const save = useServerFn(saveSped);
  const remove = useServerFn(removeSped);
  const [itens, setItens] = useState<SpedRegistro[]>([]);
  const [conf, setConf] = useState<SpedConferenciaMes[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const ultimo = useRef<number | null>(null);

  const carregar = useCallback(async () => {
    const r = await list({ data: { caseId } });
    setItens(r.itens);
    setConf(r.conferencia);
    onStatus?.({
      icmsMeses: r.itens.filter((i) => i.tipo === "icms_ipi").length,
      contribMeses: r.itens.filter((i) => i.tipo === "contribuicoes").length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, list]);

  useEffect(() => {
    void carregar().catch(() => setMsg("Não foi possível carregar os SPEDs."));
  }, [carregar]);

  useEffect(() => {
    if (!pacote || pacote.id === ultimo.current || pacote.resultado.sped.length === 0) return;
    ultimo.current = pacote.id;
    setBusy(true);
    void save({ data: { caseId, itens: pacote.resultado.sped } })
      .then((r) => {
        setMsg(`${r.gravados} arquivo(s) do SPED lido(s) e gravado(s). Períodos repetidos foram substituídos.`);
        return carregar();
      })
      .catch(() => setMsg("Não foi possível gravar os SPEDs lidos."))
      .finally(() => setBusy(false));
  }, [pacote, caseId, save, carregar]);

  const icms = itens.filter((i) => i.tipo === "icms_ipi");
  const contrib = itens.filter((i) => i.tipo === "contribuicoes");
  const confMap = useMemo(() => new Map(conf.map((c) => [c.mes, c])), [conf]);

  const ultimoIcms = icms.at(-1)?.resumo as SpedIcmsResumo | undefined;
  const ultimoContrib = contrib.at(-1)?.resumo as SpedContribResumo | undefined;

  if (itens.length === 0 && !busy && !msg) return null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Escrituração fiscal (SPED)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Apuração declarada ao Fisco. Os valores das notas continuam vindo dos XMLs (sem somar duas
        vezes); o SPED confere esses valores e traz saldos credores, ajustes e o que foi apurado.
      </p>
      {busy ? <p className="mt-2 text-xs text-muted-foreground">Gravando SPEDs…</p> : null}
      {msg ? (
        <div className="mt-2">
          <Notice>{msg}</Notice>
        </div>
      ) : null}

      {ultimoIcms || ultimoContrib ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ultimoIcms ? (
            <Card titulo="Saldo credor de ICMS (último mês)" valor={ultimoIcms.icms.saldoCredorTransportar} />
          ) : null}
          {ultimoIcms?.ipi ? <Card titulo="Saldo credor de IPI (último mês)" valor={ultimoIcms.ipi.saldoCredor} /> : null}
          {ultimoContrib ? <Card titulo="Saldo de crédito de PIS (último mês)" valor={ultimoContrib.pis.saldoCredorFinal} /> : null}
          {ultimoContrib ? (
            <Card titulo="Saldo de crédito de Cofins (último mês)" valor={ultimoContrib.cofins.saldoCredorFinal} />
          ) : null}
        </div>
      ) : null}

      <SpedImpactoRegimes itens={itens} />

      {icms.length > 0 ? (
        <Tabela
          titulo={`EFD ICMS-IPI — ${icms.length} mês(es)`}
          cabecalho={["Mês", "Saídas (SPED)", "NF-e venda (XML)", "Dif.", "Entradas (SPED)", "NF-e compra (XML)", "Dif.", "ICMS débitos", "ICMS créditos", "ICMS a recolher", ""]}
          linhas={icms.map((i) => {
            const s = i.resumo as SpedIcmsResumo;
            const c = confMap.get(mesDe(i.periodo_ini));
            return [
              rotuloMes(mesDe(i.periodo_ini)) + (i.retificadora ? " (retif.)" : ""),
              brl(s.saidas.valor),
              brl(c?.xmlVendasNfe ?? 0),
              <Diferenca key="d1" sped={s.saidas.valor} xml={c?.xmlVendasNfe ?? 0} />,
              brl(s.entradas.valor),
              brl(c?.xmlCompras ?? 0),
              <Diferenca key="d2" sped={s.entradas.valor} xml={c?.xmlCompras ?? 0} />,
              brl(s.icms.debitos),
              brl(s.icms.creditos),
              brl(s.icms.aRecolher),
              <Remover key="r" onClick={() => void remove({ data: { caseId, id: i.id } }).then(carregar)} />,
            ];
          })}
        />
      ) : null}

      {contrib.length > 0 ? (
        <Tabela
          titulo={`EFD Contribuições (PIS/Cofins) — ${contrib.length} mês(es)`}
          cabecalho={["Mês", "Receita bruta (SPED)", "Notas emitidas (XML)", "Dif.", "PIS a recolher", "Cofins a recolher", "Créditos PIS+Cofins", "Regime", ""]}
          linhas={contrib.map((i) => {
            const s = i.resumo as SpedContribResumo;
            const c = confMap.get(mesDe(i.periodo_ini));
            const xml = (c?.xmlVendasNfe ?? 0) + (c?.xmlNfsePrestado ?? 0);
            return [
              rotuloMes(mesDe(i.periodo_ini)) + (i.retificadora ? " (retif.)" : ""),
              brl(s.receitaBruta),
              brl(xml),
              <Diferenca key="d" sped={s.receitaBruta} xml={xml} />,
              brl(s.pis.totalARecolher),
              brl(s.cofins.totalARecolher),
              brl(s.pis.creditosApurados + s.cofins.creditosApurados),
              s.regime === "nao_cumulativo" ? "Não cumulativo" : s.regime === "cumulativo" ? "Cumulativo" : s.regime === "misto" ? "Misto" : "—",
              <Remover key="r" onClick={() => void remove({ data: { caseId, id: i.id } }).then(carregar)} />,
            ];
          })}
        />
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Diferenças acima de 2% (em vermelho) indicam notas faltando no pacote de XMLs, notas
        canceladas ou lançamentos sem nota — vale conferir antes de apresentar ao cliente.
      </p>
    </section>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 break-words text-base font-semibold text-foreground">{brl(valor)}</p>
    </div>
  );
}

function Remover({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-muted-foreground underline hover:text-destructive">
      remover
    </button>
  );
}

function Tabela({ titulo, cabecalho, linhas }: { titulo: string; cabecalho: string[]; linhas: React.ReactNode[][] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-foreground">{titulo}</p>
      <div className="mt-1 max-h-[50vh] overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              {cabecalho.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-border">
                {l.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-2 py-1.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
