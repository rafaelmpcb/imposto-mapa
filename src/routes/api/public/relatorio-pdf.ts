import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { defaultInput, type SimulationInput } from "@/lib/tax/calc";
import type { YearId } from "@/lib/tax/constants";

const schema = z.object({
  clientName: z.string().max(140).optional().nullable(),
  year: z.union([z.literal(2026), z.literal(2027), z.literal(2033)]),
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
    benefitConfirmed: z.boolean().optional(),
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
        });

        const slug = (parsed.data.clientName ?? "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60);
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
