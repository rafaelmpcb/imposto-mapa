import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { slugifyWords } from "@/lib/text";
import type { ParecerEdicoes, ParecerSnapshot } from "@/lib/parecer/tipos";

const schema = z.object({ parecerId: z.string().uuid() });

/**
 * Exporta o Parecer Padrão em PDF. Rota HTTP (download direto do navegador),
 * por isso valida o token do usuário aqui dentro antes de ler o parecer.
 */
export const Route = createFileRoute("/api/public/parecer-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Não autenticado", { status: 401 });

        const auth = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: userData, error: userError } = await auth.auth.getUser(token);
        if (userError || !userData.user) return new Response("Não autenticado", { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Corpo inválido", { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return new Response("Parecer inválido", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("parecer_padrao")
          .select("versao,status,dados_compilados_json,edicoes_analista_json,case_id")
          .eq("id", parsed.data.parecerId)
          .maybeSingle();
        if (error) return new Response("Falha ao ler o parecer", { status: 500 });
        if (!data) return new Response("Parecer não encontrado", { status: 404 });

        const snapshot = data.dados_compilados_json as unknown as ParecerSnapshot;
        const edicoes = (data.edicoes_analista_json ?? {}) as unknown as ParecerEdicoes;

        const { buildParecerPdf } = await import("@/lib/pdf/parecer.server");
        const bytes = await buildParecerPdf({
          snapshot,
          edicoes,
          versao: Number(data.versao),
          status: String(data.status),
        });

        const slug = slugifyWords(snapshot?.sec1?.cliente ?? "", 60);
        const filename = `parecer-padrao-${slug || new Date().toISOString().slice(0, 10)}-v${data.versao}.pdf`;

        return new Response(bytes as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
