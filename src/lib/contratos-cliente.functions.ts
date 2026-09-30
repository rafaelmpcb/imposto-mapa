import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ContratoKind,
  DadosContratante,
  ParamsAssessoria,
  ParamsDiagnostico,
} from "@/lib/contrato/tipos";

export interface ContratoCaso {
  id: string;
  kind: ContratoKind;
  titulo: string;
  status: string;
  sign_url: string | null;
  signed_file_url: string | null;
  ambiente: string | null;
  signed_at: string | null;
  created_at: string;
}

interface Entrada {
  caseId: string;
  kinds: ContratoKind[];
  contratante: DadosContratante;
  diagnostico: ParamsDiagnostico;
  assessoria: ParamsAssessoria;
}

async function montar(data: Entrada) {
  const { ESCRITORIO_PADRAO } = await import("@/lib/contrato/tipos");
  const { montarPropostaDiagnostico } = await import("@/lib/contrato/modelo-diagnostico");
  const { montarPropostaAssessoria } = await import("@/lib/contrato/modelo-assessoria");
  const { gerarPdfContrato } = await import("@/lib/contrato/pdf.server");
  const out: { kind: ContratoKind; titulo: string; arquivo: string; base64: string }[] = [];
  for (const k of data.kinds) {
    const doc =
      k === "diagnostico"
        ? montarPropostaDiagnostico(ESCRITORIO_PADRAO, data.contratante, data.diagnostico)
        : montarPropostaAssessoria(ESCRITORIO_PADRAO, data.contratante, data.assessoria);
    const bytes = await gerarPdfContrato(ESCRITORIO_PADRAO, doc);
    out.push({ kind: k, titulo: doc.titulo, arquivo: doc.arquivo, base64: Buffer.from(bytes).toString("base64") });
  }
  return out;
}

/** Gera os PDFs timbrados para conferência/download (não envia). */
export const gerarContratosPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Entrada) => i)
  .handler(async ({ data }) => {
    if (!data.kinds.length) throw new Error("Selecione ao menos um contrato.");
    return { ok: true as const, arquivos: await montar(data) };
  });

/** Gera, envia para a Clicksign e registra no caso. */
export const enviarContratosClicksign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Entrada) => i)
  .handler(async ({ data, context }) => {
    if (!data.kinds.length) throw new Error("Selecione ao menos um contrato.");
    if (!data.contratante.email.trim() || !data.contratante.representante.trim())
      throw new Error("Informe nome e e-mail do representante do cliente para a assinatura.");
    const { lerConfigClicksign } = await import("@/lib/integracao.functions");
    const cfgRaw = await lerConfigClicksign();
    const token = cfgRaw["clicksign_token"] ?? "";
    if (!token) throw new Error("SEM_TOKEN");
    const cs = await import("@/lib/clicksign/api.server");
    const cfg = { token, ambiente: cfgRaw["clicksign_ambiente"] === "producao" ? "producao" : "sandbox" } as const;

    const arquivos = await montar(data);
    const cliente = await cs.criarSignatario(cfg, {
      nome: data.contratante.representante,
      email: data.contratante.email,
      celular: data.contratante.telefone,
      cpf: data.contratante.cpf,
    });
    const advEmail = cfgRaw["clicksign_signatario_email"] || "leonardo@azevedoeadvogados.adv.br";
    const advogado = await cs.criarSignatario(cfg, {
      nome: cfgRaw["clicksign_signatario_nome"] || "Leonardo Azevedo Pinheiro Borges",
      email: advEmail,
      celular: cfgRaw["clicksign_signatario_celular"] ?? "",
      cpf: cfgRaw["clicksign_signatario_cpf"] ?? "",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const docKeys: string[] = [];
    const registros: ContratoCaso[] = [];
    for (const a of arquivos) {
      const docKey = await cs.criarDocumento(cfg, a.arquivo, a.base64);
      docKeys.push(docKey);
      const reqCliente = await cs.vincularSignatario(cfg, docKey, cliente, "contractor");
      const reqAdv = await cs.vincularSignatario(cfg, docKey, advogado, "contractee");
      const msg = `Olá, ${data.contratante.representante.split(" ")[0]}. Segue a proposta "${a.titulo}" para assinatura eletrônica.`;
      await cs.notificar(cfg, reqCliente, msg);
      await cs.notificar(cfg, reqAdv, "Proposta enviada ao cliente para assinatura.");
      const url = cs.linkAssinatura(cfg.ambiente, reqCliente);
      const { data: row, error } = await supabaseAdmin
        .from("case_contracts")
        .insert({
          case_id: data.caseId,
          kind: a.kind,
          titulo: a.titulo,
          status: "enviado",
          document_key: docKey,
          request_signature_key: reqCliente,
          sign_url: url,
          ambiente: cfg.ambiente,
          params: { contratante: data.contratante, [a.kind]: a.kind === "diagnostico" ? data.diagnostico : data.assessoria } as never,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      registros.push(row as unknown as ContratoCaso);
    }
    if (docKeys.length > 1) {
      try {
        await cs.criarLote(cfg, cliente, docKeys);
      } catch {
        /* o lote é opcional: cada documento já tem seu link */
      }
    }
    await supabaseAdmin.from("cases").update({ stage: "proposta_enviada" }).eq("id", data.caseId);
    await supabaseAdmin.from("case_interactions").insert({
      case_id: data.caseId,
      kind: "email",
      title: `Contrato enviado para assinatura (${registros.length})`,
      body: registros.map((r) => `${r.titulo}\n${r.sign_url}`).join("\n\n"),
      happened_at: new Date().toISOString(),
      author_id: context.userId,
    });
    return { ok: true as const, contratos: registros };
  });

export const listarContratosCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { caseId: string }) => i)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("case_contracts")
      .select("id,kind,titulo,status,sign_url,signed_file_url,ambiente,signed_at,created_at")
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { ok: true as const, items: (rows ?? []) as unknown as ContratoCaso[] };
  });
