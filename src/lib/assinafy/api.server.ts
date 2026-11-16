/** Cliente mínimo da API v1 da Assinafy (REST, envelope { status, message, data }). */

export type AmbienteAssinafy = "sandbox" | "producao";

export const baseAssinafy = (amb: AmbienteAssinafy) =>
  amb === "producao" ? "https://api.assinafy.com.br/v1" : "https://sandbox.assinafy.com.br/v1";

export interface ConfigAssinafy {
  apiKey: string;
  accountId: string;
  ambiente: AmbienteAssinafy;
}

async function chamar<T = unknown>(
  cfg: ConfigAssinafy,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${baseAssinafy(cfg.ambiente)}${path}`, {
    method,
    headers: {
      "X-Api-Key": cfg.apiKey.trim(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : { status: res.status, message: "", data: null };
  if (!res.ok) {
    console.error("Assinafy", method, path, res.status, text.slice(0, 500));
    if (res.status === 401 || res.status === 403)
      throw new Error("A Assinafy recusou a chave de acesso. Confira a chave de API e o ID da conta nas configurações.");
    throw new Error(`Assinafy respondeu ${res.status}: ${String(json.message ?? text).slice(0, 300)}`);
  }
  return json.data as T;
}

/** Envia o PDF (multipart/form-data) e devolve o id do documento. */
export async function uploadDocumento(cfg: ConfigAssinafy, arquivo: string, pdfBase64: string): Promise<string> {
  const filename = arquivo.toLowerCase().endsWith(".pdf") ? arquivo : `${arquivo}.pdf`;
  const bytes = Buffer.from(pdfBase64, "base64");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), filename);
  const res = await fetch(`${baseAssinafy(cfg.ambiente)}/accounts/${cfg.accountId}/documents`, {
    method: "POST",
    headers: { "X-Api-Key": cfg.apiKey.trim() },
    body: form,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : { data: null };
  if (!res.ok) {
    console.error("Assinafy upload", res.status, text.slice(0, 500));
    throw new Error(`Assinafy recusou o envio do documento (${res.status}): ${String(json.message ?? text).slice(0, 300)}`);
  }
  return (json.data as { id: string }).id;
}

interface DocumentoStatus {
  id: string;
  status: string;
  signing_url?: string | null;
  artifacts?: Record<string, string>;
}

/** Espera o documento sair de "processando" para "metadata_ready" (necessário antes do envelope). */
export async function aguardarDocumentoPronto(cfg: ConfigAssinafy, documentId: string): Promise<void> {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const doc = await chamar<DocumentoStatus>(cfg, "GET", `/documents/${documentId}`);
    if (doc.status === "metadata_ready") return;
    if (doc.status === "processing_failed") throw new Error("A Assinafy não conseguiu processar o PDF enviado.");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("O documento demorou demais para ficar pronto na Assinafy. Tente novamente em instantes.");
}

export interface Signatario {
  nome: string;
  email: string;
  celular?: string;
  cpf?: string;
}

const paraE164 = (celular: string): string | undefined => {
  const digits = celular.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  const comPais = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `+${comPais}`;
};

/** Cria o signatário no workspace e devolve o id. */
export async function criarSignatario(cfg: ConfigAssinafy, s: Signatario): Promise<string> {
  const governmentId = (s.cpf ?? "").replace(/\D/g, "");
  const whatsapp = s.celular ? paraE164(s.celular) : undefined;
  const r = await chamar<{ id: string }>(cfg, "POST", `/accounts/${cfg.accountId}/signers`, {
    full_name: s.nome,
    email: s.email,
    ...(whatsapp ? { whatsapp_phone_number: whatsapp } : {}),
    ...(governmentId.length === 11 || governmentId.length === 14 ? { government_id: governmentId } : {}),
  });
  return r.id;
}

export interface DocumentoEnvelope {
  /** Id do documento já enviado (uploadDocumento) e pronto (aguardarDocumentoPronto). */
  documentId: string;
  signerIds: string[];
}

/** Cria o envelope: agrupa documentos e signatários e já dispara os convites por e-mail. */
export async function criarEnvelope(
  cfg: ConfigAssinafy,
  nome: string,
  mensagem: string,
  signerIds: string[],
  documentos: DocumentoEnvelope[],
): Promise<string> {
  const r = await chamar<{ id: string }>(cfg, "POST", `/accounts/${cfg.accountId}/envelopes`, {
    name: nome.slice(0, 255),
    message: mensagem,
    signers: signerIds.map((id) => ({ id, verification_method: "Email" })),
    documents: documentos.map((d) => ({ id: d.documentId, signer_ids: d.signerIds, method: "virtual" })),
  });
  return r.id;
}

/** Status e artefatos atuais do documento (usado após o webhook/para exibir o link). */
export async function getDocumento(cfg: ConfigAssinafy, documentId: string): Promise<DocumentoStatus> {
  return chamar<DocumentoStatus>(cfg, "GET", `/documents/${documentId}`);
}

/** Link do documento para o cliente abrir e assinar (ou para o escritório acompanhar). */
export const linkDocumento = (doc: DocumentoStatus): string | null => doc.signing_url ?? null;
