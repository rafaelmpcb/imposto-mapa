/** Cliente mínimo da API v3 da Clicksign (modelo Envelope, JSON:API). */

export type AmbienteClicksign = "sandbox" | "producao";

export const baseClicksign = (amb: AmbienteClicksign) =>
  amb === "producao" ? "https://app.clicksign.com" : "https://sandbox.clicksign.com";

export interface ConfigClicksign {
  token: string;
  ambiente: AmbienteClicksign;
}

type Recurso = { data: { id: string; type: string; attributes?: Record<string, unknown> } };

async function chamar(cfg: ConfigClicksign, method: "POST" | "PATCH", path: string, body: unknown): Promise<Recurso> {
  const res = await fetch(`${baseClicksign(cfg.ambiente)}/api/v3/${path}`, {
    method,
    headers: {
      Authorization: cfg.token.trim(),
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Clicksign v3", method, path, res.status, text.slice(0, 500));
    if (res.status === 401 || res.status === 403)
      throw new Error("A Clicksign recusou a chave de acesso. Confira o token e o ambiente nas configurações.");
    throw new Error(`Clicksign respondeu ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : { data: { id: "", type: "" } }) as Recurso;
}

export async function criarEnvelope(cfg: ConfigClicksign, nome: string, prazoDias = 30) {
  const deadline = new Date(Date.now() + prazoDias * 86_400_000).toISOString();
  const r = await chamar(cfg, "POST", "envelopes", {
    data: {
      type: "envelopes",
      attributes: { name: nome.slice(0, 250), locale: "pt-BR", auto_close: true, remind_interval: 3, block_after_refusal: true, deadline_at: deadline },
    },
  });
  return r.data.id;
}

export async function adicionarDocumento(cfg: ConfigClicksign, envelopeId: string, arquivo: string, pdfBase64: string) {
  const filename = arquivo.toLowerCase().endsWith(".pdf") ? arquivo : `${arquivo}.pdf`;
  const r = await chamar(cfg, "POST", `envelopes/${envelopeId}/documents`, {
    data: { type: "documents", attributes: { filename, content_base64: `data:application/pdf;base64,${pdfBase64}` } },
  });
  return r.data.id;
}

export interface Signatario {
  nome: string;
  email: string;
  celular?: string;
  cpf?: string;
}

export async function adicionarSignatario(cfg: ConfigClicksign, envelopeId: string, s: Signatario) {
  const phone = (s.celular ?? "").replace(/\D/g, "");
  const cpf = (s.cpf ?? "").replace(/\D/g, "");
  const r = await chamar(cfg, "POST", `envelopes/${envelopeId}/signers`, {
    data: {
      type: "signers",
      attributes: {
        name: s.nome,
        email: s.email,
        ...(phone.length >= 10 ? { phone_number: phone } : {}),
        ...(cpf.length === 11
          ? { has_documentation: true, documentation: cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") }
          : { has_documentation: false }),
        refusable: true,
        communicate_events: { signature_request: "email", signature_reminder: "email", document_signed: "email" },
      },
    },
  });
  return r.data.id;
}

/** Vincula o signatário ao documento (papel + autenticação por e-mail). */
export async function vincularSignatario(
  cfg: ConfigClicksign,
  envelopeId: string,
  documentId: string,
  signerId: string,
  role: "contractor" | "contractee" | "party" | "sign",
) {
  const rel = {
    document: { data: { type: "documents", id: documentId } },
    signer: { data: { type: "signers", id: signerId } },
  };
  await chamar(cfg, "POST", `envelopes/${envelopeId}/requirements`, {
    data: { type: "requirements", attributes: { action: "agree", role }, relationships: rel },
  });
  await chamar(cfg, "POST", `envelopes/${envelopeId}/requirements`, {
    data: { type: "requirements", attributes: { action: "provide_evidence", auth: "email" }, relationships: rel },
  });
}

/** Ativa o envelope (dispara os e-mails de solicitação de assinatura). */
export async function ativarEnvelope(cfg: ConfigClicksign, envelopeId: string) {
  await chamar(cfg, "PATCH", `envelopes/${envelopeId}`, {
    data: { id: envelopeId, type: "envelopes", attributes: { status: "running" } },
  });
}

export async function notificar(cfg: ConfigClicksign, envelopeId: string, mensagem: string) {
  await chamar(cfg, "POST", `envelopes/${envelopeId}/notifications`, {
    data: { type: "notifications", attributes: { message: mensagem } },
  });
}

/** Link do envelope no painel da Clicksign (para o escritório acompanhar). */
export const linkEnvelope = (amb: AmbienteClicksign, envelopeId: string) =>
  `${baseClicksign(amb)}/envelopes/${envelopeId}`;
