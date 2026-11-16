import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Recebe os avisos da Assinafy (Standard Webhooks: webhook-id, webhook-timestamp,
 * webhook-signature). Quando o documento é concluído, marca o contrato como
 * assinado, move o caso para "Contrato assinado" e registra na linha do tempo.
 */
export const Route = createFileRoute("/api/public/assinafy-webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const body = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("integration_config")
          .select("value")
          .eq("key", "assinafy_webhook_secret")
          .maybeSingle();
        const secret = String(cfg?.value ?? "");
        if (!secret) return new Response("Webhook ainda não configurado", { status: 401 });

        const webhookId = request.headers.get("webhook-id") ?? "";
        const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";
        const signatureHeader = request.headers.get("webhook-signature") ?? "";
        if (!webhookId || !webhookTimestamp || !signatureHeader) {
          return new Response("Cabeçalhos de assinatura ausentes", { status: 401 });
        }

        const chaveSecreta = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
        const conteudoAssinado = `${webhookId}.${webhookTimestamp}.${body}`;
        const esperado = createHmac("sha256", chaveSecreta).update(conteudoAssinado).digest("base64");
        const valida = signatureHeader.split(" ").some((parte) => {
          const [, assinatura] = parte.split(",");
          if (!assinatura) return false;
          const a = Buffer.from(assinatura);
          const b = Buffer.from(esperado);
          return a.length === b.length && timingSafeEqual(a, b);
        });
        if (!valida) return new Response("Assinatura inválida", { status: 401 });

        let payload: {
          event?: string;
          object?: { id?: string; status?: string; artifacts?: Record<string, string> };
        };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        const evento = payload.event ?? "";
        const docKey = payload.object?.id;
        if (!docKey) return new Response("ok");

        const { data: lista } = await supabaseAdmin
          .from("case_contracts")
          .select("id,case_id,titulo,status")
          .eq("document_key", docKey);
        const contrato = lista?.[0];
        if (!contrato) return new Response("ok");

        if (evento === "document_ready") {
          if (contrato.status === "assinado") return new Response("ok");
          await supabaseAdmin
            .from("case_contracts")
            .update({
              status: "assinado",
              signed_at: new Date().toISOString(),
              signed_file_url: payload.object?.artifacts?.["certificated"] ?? null,
            })
            .eq("id", contrato.id);
          await supabaseAdmin.from("cases").update({ stage: "contrato_assinado", commercial_status: "ganho" }).eq("id", contrato.case_id);
          await supabaseAdmin.from("case_interactions").insert({
            case_id: contrato.case_id,
            kind: "nota",
            title: "Contrato assinado (Assinafy)",
            body: contrato.titulo,
            happened_at: new Date().toISOString(),
            author_name: "Assinafy",
          });
        } else if (evento === "signer_signed_document" && contrato.status === "enviado") {
          await supabaseAdmin.from("case_contracts").update({ status: "assinatura_parcial" }).eq("id", contrato.id);
        } else if (evento === "signer_rejected_document") {
          await supabaseAdmin.from("case_contracts").update({ status: "cancelado" }).eq("id", contrato.id);
        }
        return new Response("ok");
      },
    },
  },
});
