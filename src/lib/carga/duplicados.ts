/** Tipos de documento contados no painel da carga documental. */
export type TipoDocumentoCarga = "nfe_compra" | "nfe_venda" | "nfse_tomado" | "nfse_prestado";

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoCarga, string> = {
  nfe_compra: "NF-e de compra",
  nfe_venda: "NF-e de venda",
  nfse_tomado: "NFS-e tomada",
  nfse_prestado: "NFS-e prestada",
};

type DuplicadoInsert = {
  case_id: string;
  tipo_documento: TipoDocumentoCarga;
  chave_acesso: string;
  arquivo_original: string;
  motivo: string;
};

type MinimalClient = {
  from: (t: string) => {
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * Registra os reenvios de documentos cuja chave de acesso já estava processada
 * no Caso. Não bloqueia o upload — só deixa o duplicado contado no painel
 * da carga documental, sem somar de novo no crédito/débito.
 */
export async function registrarDuplicados(
  db: unknown,
  caseId: string,
  tipo: TipoDocumentoCarga,
  duplicados: { chave: string; arquivo: string }[],
): Promise<number> {
  if (duplicados.length === 0) return 0;
  const porChave = new Map<string, { chave: string; arquivo: string }>();
  for (const d of duplicados) porChave.set(d.chave, d);
  const rows: DuplicadoInsert[] = [...porChave.values()].map((d) => ({
    case_id: caseId,
    tipo_documento: tipo,
    chave_acesso: d.chave,
    arquivo_original: d.arquivo.slice(0, 200),
    motivo: "chave_acesso_ja_processada",
  }));
  await (db as MinimalClient).from("case_documento_duplicado").insert(rows);
  return rows.length;
}
