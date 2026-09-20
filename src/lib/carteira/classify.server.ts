/**
 * Classificação de regime tributário por CNPJ.
 * Fonte principal: BrasilAPI (sem limite fixo publicado, fila com concorrência
 * moderada). Reserva: API pública da CNPJá (5 consultas por minuto).
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
}

const TIMEOUT_MS = 9000;

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { status: 404, body: null };
    if (!res.ok) return { status: res.status, body: null };
    return { status: 200, body: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

/** BrasilAPI: campo `opcao_pelo_simples` (boolean ou null). */
async function viaBrasilApi(cnpj: string): Promise<ClassifyResult | null> {
  try {
    const { status, body } = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (status === 404) {
      return { cnpj, regime: "erro", status: "nao_encontrado", fonte: FONTE_BRASILAPI, updated: null };
    }
    if (status !== 200 || !body) return null;
    const raw = body as Record<string, unknown>;
    const optante = raw["opcao_pelo_simples"];
    if (optante === true || optante === false) {
      return {
        cnpj,
        regime: optante ? "simples" : "regular",
        status: "ok",
        fonte: FONTE_BRASILAPI,
        updated: new Date().toISOString(),
      };
    }
    // Campo ausente: a BrasilAPI só informa o Simples quando há opção registrada.
    if (raw["cnpj"] !== undefined || raw["razao_social"] !== undefined) {
      return {
        cnpj,
        regime: "regular",
        status: "ok",
        fonte: FONTE_BRASILAPI,
        updated: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** CNPJá (reserva): `company.simples.optant`. */
async function viaCnpja(cnpj: string): Promise<ClassifyResult | null> {
  try {
    const { status, body } = await fetchJson(`https://open.cnpja.com/office/${cnpj}`);
    if (status === 404) {
      return { cnpj, regime: "erro", status: "nao_encontrado", fonte: FONTE_CNPJA, updated: null };
    }
    if (status !== 200 || !body) return null;
    const raw = body as Record<string, any>;
    const optant = raw?.["company"]?.["simples"]?.["optant"] ?? raw?.["simples"]?.["optant"] ?? null;
    const updated = (raw?.["updated"] as string | undefined) ?? new Date().toISOString();
    if (optant === null || optant === undefined) {
      return { cnpj, regime: "regular", status: "ok", fonte: FONTE_CNPJA, updated };
    }
    return {
      cnpj,
      regime: optant ? "simples" : "regular",
      status: "ok",
      fonte: FONTE_CNPJA,
      updated,
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Executa `worker` sobre a lista com concorrência limitada. */
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

/**
 * Classifica uma lista de CNPJs. Tenta a BrasilAPI em paralelo e, para o que
 * falhar, usa a CNPJá em fila (12 s entre chamadas), limitada a `maxFallback`
 * consultas por execução para não estourar o tempo da requisição.
 */
export async function classifyMany(
  cnpjs: string[],
  options: { concurrency?: number; maxFallback?: number } = {},
): Promise<ClassifyResult[]> {
  const concurrency = options.concurrency ?? 4;
  const maxFallback = options.maxFallback ?? 4;

  const primary = await pool(cnpjs, concurrency, async (cnpj) => ({
    cnpj,
    result: await viaBrasilApi(cnpj),
  }));

  const results: ClassifyResult[] = [];
  const pending: string[] = [];
  for (const item of primary) {
    if (item.result) results.push(item.result);
    else pending.push(item.cnpj);
  }

  for (let i = 0; i < pending.length; i += 1) {
    const cnpj = pending[i] as string;
    if (i >= maxFallback) {
      results.push({ cnpj, regime: "erro", status: "erro", fonte: FONTE_BRASILAPI, updated: null });
      continue;
    }
    if (i > 0) await sleep(12_000);
    const fallback = await viaCnpja(cnpj);
    results.push(
      fallback ?? { cnpj, regime: "erro", status: "erro", fonte: FONTE_CNPJA, updated: null },
    );
  }

  return results;
}
