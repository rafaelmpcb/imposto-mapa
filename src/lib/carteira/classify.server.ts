/**
 * Classificação de regime tributário por CNPJ.
 * Fonte principal: BrasilAPI. Reserva: API pública da CNPJá (5 consultas/min).
 * Distingue erro definitivo (404: CNPJ não encontrado) de erro transitório
 * (limite de requisições, rede, timeout), que deve ser reenfileirado.
 */

export type Regime = "simples" | "regular" | "erro";
export type ConsultaStatus = "ok" | "nao_encontrado" | "erro";

export const FONTE_BRASILAPI = "BrasilAPI";
export const FONTE_CNPJA = "CNPJá — API Pública (reserva)";

export interface ClassifyResult {
  cnpj: string;
  regime: Regime;
  status: ConsultaStatus;
  fonte: string;
  updated: string | null;
  motivo?: string;
}

/** Resultado de uma tentativa: definitivo ou transitório (reenfileirar). */
export type Attempt =
  | { kind: "final"; result: ClassifyResult }
  | { kind: "transient"; motivo: string };

const TIMEOUT_MS = 9000;

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { status: res.status, body: null };
    return { status: 200, body: await res.json() };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { status: aborted ? -2 : -1, body: null };
  } finally {
    clearTimeout(timer);
  }
}

function transientReason(status: number): string {
  if (status === 429) return "Limite de requisições excedido";
  if (status === -2) return "Tempo de resposta esgotado";
  if (status === -1) return "Falha de rede";
  if (status >= 500) return `Serviço indisponível (HTTP ${status})`;
  if (status === 200) return "Regime não informado pela fonte";
  return `Resposta inesperada (HTTP ${status})`;
}

const notFound = (cnpj: string, fonte: string): Attempt => ({
  kind: "final",
  result: {
    cnpj,
    regime: "erro",
    status: "nao_encontrado",
    fonte,
    updated: null,
    motivo: "CNPJ não encontrado na base",
  },
});

export async function viaBrasilApi(cnpj: string): Promise<Attempt> {
  const { status, body } = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (status === 404) return notFound(cnpj, FONTE_BRASILAPI);
  if (status !== 200 || !body) return { kind: "transient", motivo: transientReason(status) };
  const optante = (body as Record<string, unknown>)["opcao_pelo_simples"];
  if (optante === true || optante === false) {
    return {
      kind: "final",
      result: {
        cnpj,
        regime: optante ? "simples" : "regular",
        status: "ok",
        fonte: FONTE_BRASILAPI,
        updated: new Date().toISOString(),
      },
    };
  }
  return { kind: "transient", motivo: transientReason(200) };
}

export async function viaCnpja(cnpj: string): Promise<Attempt> {
  const { status, body } = await fetchJson(`https://open.cnpja.com/office/${cnpj}`);
  if (status === 404) return notFound(cnpj, FONTE_CNPJA);
  if (status !== 200 || !body) return { kind: "transient", motivo: transientReason(status) };
  const raw = body as Record<string, any>;
  const optant = raw?.["company"]?.["simples"]?.["optant"] ?? raw?.["simples"]?.["optant"] ?? null;
  const updated = (raw?.["updated"] as string | undefined) ?? new Date().toISOString();
  return {
    kind: "final",
    result: {
      cnpj,
      regime: optant ? "simples" : "regular",
      status: "ok",
      fonte: FONTE_CNPJA,
      updated,
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index] as T);
    }
  });
  await Promise.all(runners);
  return out;
}

/** Compatível com os fluxos de XML: BrasilAPI em paralelo e CNPJá espaçada (13 s). */
export async function classifyMany(
  cnpjs: string[],
  options: { concurrency?: number; maxFallback?: number } = {},
): Promise<ClassifyResult[]> {
  const concurrency = options.concurrency ?? 3;
  const maxFallback = options.maxFallback ?? 2;
  const primary = await pool(cnpjs, concurrency, async (cnpj) => ({ cnpj, a: await viaBrasilApi(cnpj) }));
  const results: ClassifyResult[] = [];
  const pending: { cnpj: string; motivo: string }[] = [];
  for (const p of primary) {
    if (p.a.kind === "final") results.push(p.a.result);
    else pending.push({ cnpj: p.cnpj, motivo: p.a.motivo });
  }
  for (let i = 0; i < pending.length; i += 1) {
    const { cnpj, motivo } = pending[i]!;
    if (i >= maxFallback) {
      results.push({ cnpj, regime: "erro", status: "erro", fonte: FONTE_BRASILAPI, updated: null, motivo });
      continue;
    }
    if (i > 0) await sleep(13_000);
    const fb = await viaCnpja(cnpj);
    results.push(
      fb.kind === "final"
        ? fb.result
        : { cnpj, regime: "erro", status: "erro", fonte: FONTE_CNPJA, updated: null, motivo: fb.motivo },
    );
  }
  return results;
}
