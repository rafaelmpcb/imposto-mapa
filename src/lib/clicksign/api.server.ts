/** Cliente mínimo da API v1 da Clicksign (documentos, signatários, listas e notificações). */

export type AmbienteClicksign = "sandbox" | "producao";

export const baseClicksign = (amb: AmbienteClicksign) =>
  amb === "producao" ? "https://app.clicksign.com" : "https://sandbox.clicksign.com";

export interface ConfigClicksign {
  token: string;
  ambiente: AmbienteClicksign;
}

async function chamar<T>(cfg: ConfigClicksign, path: string, body: unknown): Promise<T> {
  const url = `${baseClicksign(cfg.ambiente)}/api/v1/${path}?access_token=${encodeURIComponent(cfg.token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error("A Clicksign recusou a chave de acesso. Confira o token e o ambiente nas configurações.");
    throw new Error(`Clicksign respondeu ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function criarDocumento(cfg: ConfigClicksign, nome: string, pdfBase64: string, prazoDias = 30) {
  const deadline = new Date(Date.now() + prazoDias * 86_400_000).toISOString();
  const r = await chamar<{ document: { key: string } }>(cfg, "documents", {
    document: {
      path: `/Contratos/${Date.now()}-${nome}`,
      content_base64: `data:application/pdf;base64,${pdfBase64}`,
      deadline_at: deadline,
      auto_close: true,
      locale: "pt-BR",
      sequence_enabled: false,
    },
  });
  return r.document.key;
}

export interface Signatario {
  nome: string;
  email: string;
  celular?: string;
  cpf?: string;
}

export async function criarSignatario(cfg: ConfigClicksign, s: Signatario) {
  const phone = (s.celular ?? "").replace(/\D/g, "");
  const cpf = (s.cpf ?? "").replace(/\D/g, "");
  const r = await chamar<{ signer: { key: string } }>(cfg, "signers", {
    signer: {
      email: s.email,
      name: s.nome,
      auths: ["email"],
      delivery: "email",
      ...(phone ? { phone_number: phone } : {}),
      ...(cpf.length === 11 ? { documentation: cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"), has_documentation: true } : { has_documentation: false }),
    },
  });
  return r.signer.key;
}

export async function vincularSignatario(cfg: ConfigClicksign, documentKey: string, signerKey: string, signAs: "contractor" | "contractee" | "party") {
  const r = await chamar<{ list: { request_signature_key: string } }>(cfg, "lists", {
    list: { document_key: documentKey, signer_key: signerKey, sign_as: signAs },
  });
  return r.list.request_signature_key;
}

export async function notificar(cfg: ConfigClicksign, requestSignatureKey: string, mensagem: string) {
  await chamar(cfg, "notifications", { request_signature_key: requestSignatureKey, message: mensagem });
}

/** Agrupa vários documentos para o mesmo signatário assinar de uma vez. */
export async function criarLote(cfg: ConfigClicksign, signerKey: string, documentKeys: string[]) {
  const r = await chamar<{ batch: { key: string } }>(cfg, "batches", {
    batch: { signer_key: signerKey, document_keys: documentKeys, summary: true },
  });
  return r.batch.key;
}

export const linkAssinatura = (amb: AmbienteClicksign, requestSignatureKey: string) =>
  `${baseClicksign(amb)}/sign/${requestSignatureKey}`;
