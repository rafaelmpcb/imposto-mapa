import { createServerFn } from "@tanstack/react-start";

import { activityFromCnae } from "@/lib/cnpj/cnae-map";
import { formatCnpj, isValidCnpj, onlyDigits, type CnpjData } from "@/lib/cnpj/types";

export type { CnpjData };

type LookupResult = { ok: true; data: CnpjData } | { ok: false; error: string };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const joinAddress = (parts: {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}) => {
  const cep = onlyDigits(parts.cep);
  const cepFmt = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : parts.cep;
  const street = [parts.logradouro, parts.numero].filter(Boolean).join(", ");
  return [street, parts.complemento, parts.bairro, [parts.cidade, parts.uf].filter(Boolean).join("/"), cepFmt]
    .filter((p) => p && String(p).trim())
    .join(" - ");
};

/** Escolhe o sócio-administrador, senão o primeiro sócio da lista. */
const pickPartner = (qsa: { nome: string; qualificacao: string }[]) => {
  const admin = qsa.find((s) => /administrador/i.test(s.qualificacao));
  return (admin ?? qsa[0])?.nome ?? "";
};

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function fromBrasilApi(raw: Record<string, unknown>, digits: string): CnpjData {
  const qsa = Array.isArray(raw["qsa"])
    ? (raw["qsa"] as Record<string, unknown>[]).map((s) => ({
        nome: clean(s["nome_socio"]),
        qualificacao: clean(s["qualificacao_socio"]),
      }))
    : [];
  const codigo = String(raw["cnae_fiscal"] ?? "");
  const descricao = clean(raw["cnae_fiscal_descricao"]);
  return {
    cnpj: formatCnpj(digits),
    razao_social: clean(raw["razao_social"]),
    nome_fantasia: clean(raw["nome_fantasia"]),
    endereco: joinAddress({
      logradouro: `${clean(raw["descricao_tipo_de_logradouro"])} ${clean(raw["logradouro"])}`.trim(),
      numero: clean(raw["numero"]),
      complemento: clean(raw["complemento"]),
      bairro: clean(raw["bairro"]),
      cidade: clean(raw["municipio"]),
      uf: clean(raw["uf"]),
      cep: String(raw["cep"] ?? ""),
    }),
    uf: clean(raw["uf"]).toUpperCase(),
    situacao_cadastral: clean(raw["descricao_situacao_cadastral"]).toUpperCase(),
    cnae_codigo: codigo,
    cnae_descricao: descricao,
    representante_sugerido: pickPartner(qsa),
    atividade_sugerida: activityFromCnae(codigo, descricao),
    regime_sugerido:
      raw["opcao_pelo_mei"] === true
        ? "mei"
        : raw["opcao_pelo_simples"] === true
          ? "simples"
          : raw["opcao_pelo_simples"] === false
            ? "regular"
            : null,
  };
}

function fromReceitaWs(raw: Record<string, unknown>, digits: string): CnpjData {
  const qsa = Array.isArray(raw["qsa"])
    ? (raw["qsa"] as Record<string, unknown>[]).map((s) => ({
        nome: clean(s["nome"]),
        qualificacao: clean(s["qual"]),
      }))
    : [];
  const first = Array.isArray(raw["atividade_principal"])
    ? ((raw["atividade_principal"] as Record<string, unknown>[])[0] ?? {})
    : {};
  const codigo = clean(first["code"]);
  const descricao = clean(first["text"]);
  return {
    cnpj: formatCnpj(digits),
    razao_social: clean(raw["nome"]),
    nome_fantasia: clean(raw["fantasia"]),
    endereco: joinAddress({
      logradouro: clean(raw["logradouro"]),
      numero: clean(raw["numero"]),
      complemento: clean(raw["complemento"]),
      bairro: clean(raw["bairro"]),
      cidade: clean(raw["municipio"]),
      uf: clean(raw["uf"]),
      cep: clean(raw["cep"]),
    }),
    uf: clean(raw["uf"]).toUpperCase(),
    situacao_cadastral: clean(raw["situacao"]).toUpperCase(),
    cnae_codigo: codigo,
    cnae_descricao: descricao,
    representante_sugerido: pickPartner(qsa),
    atividade_sugerida: activityFromCnae(codigo, descricao),
    regime_sugerido: (() => {
      const simples = raw["simples"] as Record<string, unknown> | undefined;
      const simei = raw["simei"] as Record<string, unknown> | undefined;
      if (simei?.["optante"] === true) return "mei";
      if (simples?.["optante"] === true) return "simples";
      if (simples?.["optante"] === false) return "regular";
      return null;
    })(),
  };
}

/** Consulta dados públicos de CNPJ: BrasilAPI como fonte primária, ReceitaWS como fallback. */
export const lookupCnpj = createServerFn({ method: "POST" })
  .inputValidator((input: { cnpj: string }) => input)
  .handler(async ({ data }): Promise<LookupResult> => {
    const digits = onlyDigits(data.cnpj ?? "");
    if (!isValidCnpj(digits)) {
      return { ok: false, error: "CNPJ inválido. Confira os 14 dígitos." };
    }

    try {
      const raw = (await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)) as Record<
        string,
        unknown
      >;
      if (raw && clean(raw["razao_social"])) return { ok: true, data: fromBrasilApi(raw, digits) };
    } catch {
      /* segue para o fallback */
    }

    try {
      const raw = (await fetchJson(`https://receitaws.com.br/v1/cnpj/${digits}`)) as Record<
        string,
        unknown
      >;
      if (raw && clean(raw["status"]).toUpperCase() === "ERROR") {
        return { ok: false, error: "CNPJ não encontrado na base pública." };
      }
      if (raw && clean(raw["nome"])) return { ok: true, data: fromReceitaWs(raw, digits) };
    } catch {
      /* ambas falharam */
    }

    return {
      ok: false,
      error: "Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.",
    };
  });
