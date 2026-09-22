/**
 * Referência estática e reduzida de CFOP → descrição, restrita aos códigos mais
 * comuns de compra e venda de mercadoria. CFOP fora desta lista aparece só com
 * o código, sem travar nenhuma tela.
 */
export const CFOP_DESCRICAO: Record<string, string> = {
  // Entradas (compras)
  "1101": "Compra para industrialização (dentro do estado)",
  "1102": "Compra para comercialização (dentro do estado)",
  "1111": "Compra para industrialização de mercadoria recebida anteriormente",
  "1116": "Compra para industrialização originada de encomenda",
  "1126": "Compra para utilização na prestação de serviço",
  "1201": "Devolução de venda de produção do estabelecimento",
  "1202": "Devolução de venda de mercadoria adquirida de terceiros",
  "1252": "Compra de energia elétrica por estabelecimento industrial",
  "1401": "Compra para industrialização em operação com substituição tributária",
  "1403": "Compra para comercialização em operação com substituição tributária",
  "1556": "Compra de material para uso ou consumo",
  "1551": "Compra de bem para o ativo imobilizado",
  "1910": "Entrada de bonificação, doação ou brinde",
  "1949": "Outra entrada de mercadoria não especificada",
  "2101": "Compra para industrialização (de outro estado)",
  "2102": "Compra para comercialização (de outro estado)",
  "2126": "Compra para utilização na prestação de serviço (de outro estado)",
  "2201": "Devolução de venda de produção do estabelecimento (outro estado)",
  "2202": "Devolução de venda de mercadoria de terceiros (outro estado)",
  "2401": "Compra para industrialização com substituição tributária (outro estado)",
  "2403": "Compra para comercialização com substituição tributária (outro estado)",
  "2551": "Compra de bem para o ativo imobilizado (de outro estado)",
  "2556": "Compra de material para uso ou consumo (de outro estado)",
  "2949": "Outra entrada de mercadoria não especificada (de outro estado)",
  "3101": "Compra para industrialização (importação)",
  "3102": "Compra para comercialização (importação)",

  // Saídas (vendas)
  "5101": "Venda de produção do estabelecimento (dentro do estado)",
  "5102": "Venda de mercadoria adquirida de terceiros (dentro do estado)",
  "5103": "Venda de produção do estabelecimento fora do estabelecimento",
  "5109": "Venda a contribuinte de zona franca / área de livre comércio",
  "5116": "Venda de produção originada de encomenda para entrega futura",
  "5117": "Venda de mercadoria de terceiros originada de encomenda futura",
  "5201": "Devolução de compra para industrialização",
  "5202": "Devolução de compra para comercialização",
  "5401": "Venda de produção com substituição tributária",
  "5403": "Venda de mercadoria de terceiros com substituição tributária",
  "5405": "Venda de mercadoria com substituição tributária já recolhida",
  "5551": "Venda de bem do ativo imobilizado",
  "5556": "Devolução de material de uso ou consumo",
  "5910": "Remessa em bonificação, doação ou brinde",
  "5929": "Venda registrada em cupom fiscal ou NFC-e",
  "5949": "Outra saída de mercadoria não especificada",
  "6101": "Venda de produção do estabelecimento (para outro estado)",
  "6102": "Venda de mercadoria adquirida de terceiros (para outro estado)",
  "6108": "Venda a não contribuinte de outro estado",
  "6201": "Devolução de compra para industrialização (outro estado)",
  "6202": "Devolução de compra para comercialização (outro estado)",
  "6401": "Venda de produção com substituição tributária (outro estado)",
  "6403": "Venda de mercadoria de terceiros com ST (outro estado)",
  "6551": "Venda de bem do ativo imobilizado (para outro estado)",
  "6949": "Outra saída de mercadoria não especificada (outro estado)",
  "7101": "Venda de produção do estabelecimento (exportação)",
  "7102": "Venda de mercadoria adquirida de terceiros (exportação)",
};

/** Descrição do CFOP quando conhecida; caso contrário, só o código. */
export function descreverCfop(cfop: string | null | undefined): string {
  const codigo = (cfop ?? "").replace(/\D/g, "");
  if (!codigo) return "Sem CFOP";
  const desc = CFOP_DESCRICAO[codigo];
  return desc ? `${codigo} — ${desc}` : codigo;
}
