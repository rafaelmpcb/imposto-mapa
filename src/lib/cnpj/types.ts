/** Dados cadastrais normalizados de uma empresa consultada por CNPJ. */
export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  /** UF do endereço retornado pela consulta (ex.: "SP"). */
  uf?: string;
  situacao_cadastral: string;
  cnae_codigo: string;
  cnae_descricao: string;
  /** Sugestão editável de representante (sócio-administrador ou primeiro sócio). */
  representante_sugerido: string;
  /** Atividade sugerida a partir do CNAE principal. */
  atividade_sugerida: string;
  /**
   * Regime detectado na base pública da Receita:
   * "simples" (optante), "mei" (optante pelo MEI), "regular" (não optante — Lucro Presumido ou Real)
   * ou null quando a fonte não informa.
   */
  regime_sugerido: "simples" | "mei" | "regular" | null;
}

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const formatCnpj = (value: string) => {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/** Validação dos dígitos verificadores do CNPJ. */
export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
