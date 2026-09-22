import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIPO_DOCUMENTO_LABEL, type TipoDocumentoCarga } from "@/lib/carga/duplicados";

/** Limiar padrão (%) a partir do qual a carga documental é sinalizada para investigação. */
export const LIMIAR_CARGA_PADRAO = 10;

export type LinhaCarga = {
  tipo: TipoDocumentoCarga;
  label: string;
  validos: number;
  duplicados: number;
  naoSaoNotas: number;
  ignorados: number;
  manuais: number;
  totalRecebido: number;
  valorValidos: number;
  valorForaDoCalculo: number;
};

export type DocumentoForaDoCalculo = {
  tipo: TipoDocumentoCarga;
  label: string;
  arquivo: string;
  chave: string | null;
  numero: string | null;
  categoria: "duplicado" | "nao_e_nota" | "ignorado";
  motivo: string;
  valor: number;
};

export type PainelCargaPayload = {
  linhas: LinhaCarga[];
  foraDoCalculo: DocumentoForaDoCalculo[];
};

const NAO_SAO_NOTAS = new Set([
  "xml_invalido",
  "nao_e_nfe",
  "nao_e_nfse",
  "documento_invalido",
]);

const MOTIVO_LABEL: Record<string, string> = {
  xml_invalido: "Arquivo não é um XML válido",
  nao_e_nfe: "Arquivo não é uma NF-e",
  nao_e_nfse: "Arquivo não é uma NFS-e",
  documento_invalido: "Documento não reconhecido",
  nao_e_nfse_nacional: "NFS-e fora do leiaute nacional (não processada)",
  sem_cnpj: "Documento sem CNPJ identificável",
  sem_cnpj_emitente: "Nota sem CNPJ do emitente",
  sem_cnpj_destinatario: "Nota sem CNPJ do destinatário",
  chave_acesso_ja_processada: "Mesma chave de acesso já processada neste Caso",
};

const motivoTexto = (s: string) => MOTIVO_LABEL[s] ?? `Não processado (${s})`;

const linhaVazia = (tipo: TipoDocumentoCarga): LinhaCarga => ({
  tipo,
  label: TIPO_DOCUMENTO_LABEL[tipo],
  validos: 0,
  duplicados: 0,
  naoSaoNotas: 0,
  ignorados: 0,
  manuais: 0,
  totalRecebido: 0,
  valorValidos: 0,
  valorForaDoCalculo: 0,
});

type DocRow = {
  arquivo_original: string;
  chave_acesso: string | null;
  numero_nota: string | null;
  valor_total: number | null;
  status_processamento: string;
  direcao?: string | null;
};

/**
 * Painel da carga documental: agrega o status de processamento já gravado em
 * cada documento do Caso, mais os reenvios registrados como duplicados.
 * Não reprocessa nem recalcula nada.
 */
export const getPainelCarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; dados: PainelCargaPayload }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caseId = data.caseId;

    const cols = "arquivo_original,chave_acesso,numero_nota,valor_total,status_processamento";
    const [compras, vendas, servicos, duplicados] = await Promise.all([
      supabaseAdmin.from("nota_fiscal_compra_xml").select(cols).eq("case_id", caseId),
      supabaseAdmin.from("nota_fiscal_venda_xml").select(cols).eq("case_id", caseId),
      supabaseAdmin.from("nota_servico_nfse").select(`${cols},direcao`).eq("case_id", caseId),
      supabaseAdmin
        .from("case_documento_duplicado")
        .select("tipo_documento,chave_acesso,arquivo_original,motivo")
        .eq("case_id", caseId),
    ]);

    const linhas = new Map<TipoDocumentoCarga, LinhaCarga>(
      (["nfe_compra", "nfe_venda", "nfse_tomado", "nfse_prestado"] as TipoDocumentoCarga[]).map(
        (t) => [t, linhaVazia(t)],
      ),
    );
    const fora: DocumentoForaDoCalculo[] = [];

    const consumir = (rows: DocRow[], tipoFixo?: TipoDocumentoCarga) => {
      for (const r of rows) {
        const tipo: TipoDocumentoCarga =
          tipoFixo ?? (r.direcao === "prestado" ? "nfse_prestado" : "nfse_tomado");
        const linha = linhas.get(tipo)!;
        const valor = Number(r.valor_total ?? 0);
        const status = String(r.status_processamento ?? "ok");
        linha.totalRecebido += 1;
        if (status === "ok") {
          linha.validos += 1;
          linha.valorValidos += valor;
          continue;
        }
        const categoria = NAO_SAO_NOTAS.has(status) ? "nao_e_nota" : "ignorado";
        if (categoria === "nao_e_nota") linha.naoSaoNotas += 1;
        else linha.ignorados += 1;
        linha.valorForaDoCalculo += valor;
        fora.push({
          tipo,
          label: TIPO_DOCUMENTO_LABEL[tipo],
          arquivo: r.arquivo_original,
          chave: r.chave_acesso,
          numero: r.numero_nota,
          categoria,
          motivo: motivoTexto(status),
          valor,
        });
      }
    };

    consumir(((compras.data ?? []) as DocRow[]), "nfe_compra");
    consumir(((vendas.data ?? []) as DocRow[]), "nfe_venda");
    consumir((servicos.data ?? []) as DocRow[]);

    for (const d of (duplicados.data ?? []) as {
      tipo_documento: string;
      chave_acesso: string | null;
      arquivo_original: string;
      motivo: string;
    }[]) {
      const tipo = d.tipo_documento as TipoDocumentoCarga;
      const linha = linhas.get(tipo);
      if (!linha) continue;
      linha.duplicados += 1;
      linha.totalRecebido += 1;
      fora.push({
        tipo,
        label: TIPO_DOCUMENTO_LABEL[tipo],
        arquivo: d.arquivo_original,
        chave: d.chave_acesso,
        numero: null,
        categoria: "duplicado",
        motivo: motivoTexto(d.motivo),
        valor: 0,
      });
    }

    return { ok: true, dados: { linhas: [...linhas.values()], foraDoCalculo: fora } };
  });
