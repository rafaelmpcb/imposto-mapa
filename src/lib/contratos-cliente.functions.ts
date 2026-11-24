import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ContratoKind,
  DadosContratante,
  DadosEscritorio,
  ParamsDiagnostico,
} from "@/lib/contrato/tipos";

/** Dados do escritório para o timbre do contrato, lidos de `office_config`
 * (tela Configurações) — nunca hardcoded no código. */
async function obterDadosEscritorio(): Promise<DadosEscritorio> {
  const { ESCRITORIO_PADRAO } = await import("@/lib/contrato/tipos");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("office_config")
    .select("key, value")
    .in("key", ["nome", "cnpj", "endereco", "advogado_nome", "oab", "cpf_advogado", "foro", "email_contato"]);
  const porChave = new Map((data ?? []).map((r) => [r.key as string, String(r.value ?? "")]));
  const campo = (chave: string, alternativa: string) => porChave.get(chave) || alternativa;
  return {
    nome: campo("nome", ESCRITORIO_PADRAO.nome),
    cnpj: campo("cnpj", ESCRITORIO_PADRAO.cnpj),
    endereco: campo("endereco", ESCRITORIO_PADRAO.endereco),
    advogadoNome: campo("advogado_nome", ESCRITORIO_PADRAO.advogadoNome),
    oab: campo("oab", ESCRITORIO_PADRAO.oab),
    cpfAdvogado: campo("cpf_advogado", ESCRITORIO_PADRAO.cpfAdvogado),
    foro: campo("foro", ESCRITORIO_PADRAO.foro),
    email: campo("email_contato", ESCRITORIO_PADRAO.email),
  };
}

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
}

async function montar(data: Entrada) {
  const esc = await obterDadosEscritorio();
  const { montarPropostaDiagnostico } = await import("@/lib/contrato/modelo-diagnostico");
  const { gerarPdfContrato } = await import("@/lib/contrato/pdf.server");
  const out: { kind: ContratoKind; titulo: string; arquivo: string; base64: string }[] = [];
  for (const k of data.kinds) {
    const doc = montarPropostaDiagnostico(esc, data.contratante, data.diagnostico);
    const bytes = await gerarPdfContrato(esc, doc);
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

/** Gera, envia para a Assinafy e registra no caso. */
export const enviarContratosAssinafy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Entrada) => i)
  .handler(async ({ data, context }) => {
    if (!data.kinds.length) throw new Error("Selecione ao menos um contrato.");
    if (!data.contratante.email.trim() || !data.contratante.representante.trim())
      throw new Error("Informe nome e e-mail do representante do cliente para a assinatura.");
    const { lerConfigAssinafy } = await import("@/lib/integracao.functions");
    const cfgRaw = await lerConfigAssinafy();
    const apiKey = cfgRaw["assinafy_api_key"] ?? "";
    const accountId = cfgRaw["assinafy_account_id"] ?? "";
    if (!apiKey || !accountId) throw new Error("SEM_TOKEN");
    const as = await import("@/lib/assinafy/api.server");
    const cfg = {
      apiKey,
      accountId,
      ambiente: cfgRaw["assinafy_ambiente"] === "producao" ? "producao" : "sandbox",
    } as const;

    const arquivos = await montar(data);
    const documentosEnviados: { a: (typeof arquivos)[number]; documentId: string }[] = [];
    for (const a of arquivos) {
      const documentId = await as.uploadDocumento(cfg, a.arquivo, a.base64);
      await as.aguardarDocumentoPronto(cfg, documentId);
      documentosEnviados.push({ a, documentId });
    }

    const cliente = await as.criarSignatario(cfg, {
      nome: data.contratante.representante,
      email: data.contratante.email,
      celular: data.contratante.telefone,
      cpf: data.contratante.cpf,
    });
    const esc = await obterDadosEscritorio();
    const advEmail = cfgRaw["assinafy_signatario_email"] || esc.email;
    const advogado = await as.criarSignatario(cfg, {
      nome: cfgRaw["assinafy_signatario_nome"] || esc.advogadoNome,
      email: advEmail,
      celular: cfgRaw["assinafy_signatario_celular"] ?? "",
      cpf: cfgRaw["assinafy_signatario_cpf"] || esc.cpfAdvogado,
    });

    const envelopeId = await as.criarEnvelope(
      cfg,
      `${arquivos.map((a) => a.titulo).join(" + ")} — ${data.contratante.razaoSocial ?? ""}`,
      `Olá, ${data.contratante.representante.split(" ")[0]}. Segue a proposta para assinatura eletrônica.`,
      [cliente, advogado],
      documentosEnviados.map((d) => ({ documentId: d.documentId, signerIds: [cliente, advogado] })),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const registros: ContratoCaso[] = [];
    for (const { a, documentId } of documentosEnviados) {
      const doc = await as.getDocumento(cfg, documentId);
      const { data: row, error } = await supabaseAdmin
        .from("case_contracts")
        .insert({
          case_id: data.caseId,
          kind: a.kind,
          titulo: a.titulo,
          status: "enviado",
          document_key: documentId,
          request_signature_key: envelopeId,
          sign_url: as.linkDocumento(doc),
          ambiente: cfg.ambiente,
          params: { contratante: data.contratante, [a.kind]: data.diagnostico } as never,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      registros.push(row as unknown as ContratoCaso);
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
