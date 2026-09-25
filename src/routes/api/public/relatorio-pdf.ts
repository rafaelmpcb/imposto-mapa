import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { defaultInput, type SimulationInput } from "@/lib/tax/calc";
import { slugifyWords } from "@/lib/text";
import type { YearId } from "@/lib/tax/constants";

const cnpjDataSchema = z.object({
  cnpj: z.string().max(30),
  razao_social: z.string().max(300),
  nome_fantasia: z.string().max(300),
  endereco: z.string().max(500),
  situacao_cadastral: z.string().max(100),
  cnae_codigo: z.string().max(30),
  cnae_descricao: z.string().max(500),
  representante_sugerido: z.string().max(300),
  atividade_sugerida: z.string().max(100),
  regime_sugerido: z.enum(["simples", "mei", "regular"]).nullable().optional(),
});

const schema = z.object({
  clientName: z.string().max(200).optional().nullable(),
  cnpj: z.string().max(30).optional().nullable(),
  cnpjData: cnpjDataSchema.optional().nullable(),
  year: z.number().int().min(2026).max(2033),
  input: z.object({
    taxpayerType: z.enum(["pf", "simples", "presumido", "real", "mei"]),
    activityId: z.string().max(60),
    uf: z.string().max(2),
    revenue: z.number().finite().min(0).max(1e12),
    payroll: z.number().finite().min(0).max(1e12).optional(),
    purchases: z.number().finite().min(0).max(1e12).optional(),
    profitMargin: z.number().finite().min(0).max(100).optional(),
    monophasicShare: z.number().finite().min(0).max(100).optional(),
    simplesSupplierShare: z.number().finite().min(0).max(100).optional(),
    pjClientShare: z.number().finite().min(0).max(100).optional(),
    simplesAnexo: z.string().max(10).optional(),
    benefitConfirmed: z.boolean().nullable().optional(),
  }).passthrough(),
});

export const Route = createFileRoute("/api/public/relatorio-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Corpo inválido", { status: 400 });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return new Response("Dados da simulação inválidos", { status: 400 });
        }

        const { buildReportPdf } = await import("@/lib/pdf/report.server");
        const input = {
          ...defaultInput(),
          ...(parsed.data.input as unknown as Partial<SimulationInput>),
        } as SimulationInput;

        const bytes = await buildReportPdf({
          input,
          year: parsed.data.year as YearId,
          clientName: parsed.data.clientName ?? null,
          cnpj: parsed.data.cnpj ?? null,
          cnpjData: parsed.data.cnpjData
            ? { ...parsed.data.cnpjData, regime_sugerido: parsed.data.cnpjData.regime_sugerido ?? null }
            : null,
        });

        const slug = slugifyWords(parsed.data.clientName ?? "", 60);
        const filename = `relatorio-reforma-tributaria-${
          slug || new Date().toISOString().slice(0, 10)
        }.pdf`;

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
