import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Recebe os avisos da Clicksign. Quando um documento é concluído, marca o
 * contrato como assinado, move o caso para "Contrato assinado" e registra na linha do tempo.
 */
export const Route = createFileRoute("/api/public/clicksign-webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const body = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("integration_config")
          .select("value")
          .eq("key", "clicksign_hmac")
          .maybeSingle();
        const secret = String(cfg?.value ?? "");
        if (!secret) return new Response("Webhook ainda não configurado", { status: 401 });
        const header = (request.headers.get("content-hmac") ?? "").replace(/^sha256=/, "");
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(header);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Assinatura inválida", { status: 401 });
        }

        let payload: { event?: { name?: string }; document?: { key?: string; downloads?: { signed_file_url?: string } } };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        const evento = payload.event?.name ?? "";
        const key = payload.document?.key;
        if (!key) return new Response("ok");

        const { data: contrato } = await supabaseAdmin
          .from("case_contracts")
          .select("id,case_id,titulo,status")
          .eq("document_key", key)
          .maybeSingle();
        if (!contrato) return new Response("ok");

        if (evento === "auto_close" || evento === "close") {
          if (contrato.status === "assinado") return new Response("ok");
          await supabaseAdmin
            .from("case_contracts")
            .update({
              status: "assinado",
              signed_at: new Date().toISOString(),
              signed_file_url: payload.document?.downloads?.signed_file_url ?? null,
            })
            .eq("id", contrato.id);
          await supabaseAdmin.from("cases").update({ stage: "contrato_assinado", commercial_status: "ganho" }).eq("id", contrato.case_id);
          await supabaseAdmin.from("case_interactions").insert({
            case_id: contrato.case_id,
            kind: "nota",
            title: "Contrato assinado (Clicksign)",
            body: contrato.titulo,
            happened_at: new Date().toISOString(),
            author_name: "Clicksign",
          });
        } else if (evento === "sign" && contrato.status === "enviado") {
          await supabaseAdmin.from("case_contracts").update({ status: "assinatura_parcial" }).eq("id", contrato.id);
        } else if (evento === "cancel" || evento === "deadline") {
          await supabaseAdmin.from("case_contracts").update({ status: evento === "cancel" ? "cancelado" : "expirado" }).eq("id", contrato.id);
        }
        return new Response("ok");
      },
    },
  },
});
