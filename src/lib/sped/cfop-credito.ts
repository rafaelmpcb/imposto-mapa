/**
 * Classifica CFOPs de entrada quanto ao direito a crédito de IBS/CBS.
 * Remessas/retornos (x.9xx) e transferências entre estabelecimentos não são
 * aquisições onerosas; devoluções de venda anulam débito (não são compra).
 */
export type GrupoEntrada = "credito" | "remessa" | "transferencia" | "devolucao";

const TRANSF = new Set(["151", "152", "153", "155", "156", "408", "409", "552", "557", "658", "659"]);
const DEVOL = new Set(["201", "202", "203", "204", "205", "206", "207", "208", "209", "410", "411", "503", "553", "660", "661", "662"]);

export function grupoEntrada(cfop: string): GrupoEntrada | null {
  const c = cfop.replace(/\D/g, "");
  if (c.length !== 4 || !/^[123]/.test(c)) return null;
  const s = c.slice(1);
  if (s[0] === "9") return "remessa";
  if (TRANSF.has(s)) return "transferencia";
  if (DEVOL.has(s)) return "devolucao";
  return "credito";
}
