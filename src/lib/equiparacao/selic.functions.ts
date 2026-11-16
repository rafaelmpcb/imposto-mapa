import { createServerFn } from "@tanstack/react-start";

import { SELIC_MENSAL } from "./selic";

type Tabela = [string, number][];

/**
 * Busca a Selic mensal oficial (BCB, série SGS 4390) e mescla com a tabela embutida.
 * Se o Banco Central não responder, devolve a tabela embutida (fallback).
 */
export const obterSelicAtualizada = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tabela: Tabela; atualizadaAte: string; fonte: "bcb" | "embutida" }> => {
    const base: Tabela = SELIC_MENSAL.map(([m, v]) => [m, v]);
    const embutida = { tabela: base, atualizadaAte: base[base.length - 1]![0], fonte: "embutida" as const };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados?formato=json&dataInicial=01/01/2019",
        { signal: ctrl.signal, headers: { Accept: "application/json" } },
      ).finally(() => clearTimeout(t));
      if (!res.ok) return embutida;
      const raw = (await res.json()) as { data: string; valor: string }[];
      if (!Array.isArray(raw) || raw.length === 0) return embutida;
      const mapa = new Map<string, number>(base);
      for (const r of raw) {
        const [, mm, aaaa] = String(r.data).split("/");
        const v = Number(String(r.valor).replace(",", "."));
        if (aaaa && mm && Number.isFinite(v)) mapa.set(`${aaaa}-${mm}`, v);
      }
      const tabela = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return { tabela, atualizadaAte: tabela[tabela.length - 1]![0], fonte: "bcb" };
    } catch {
      return embutida;
    }
  },
);
