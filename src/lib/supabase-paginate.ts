/**
 * Busca todas as linhas de uma consulta, paginando de 1000 em 1000.
 *
 * O PostgREST do Supabase limita toda resposta a 1000 linhas por padrão
 * (configuração do projeto) — e esse teto vale mesmo quando o código pede um
 * `.limit()` maior, então passar `.limit(20000)` não resolve nada sozinho.
 * Qualquer consulta sem filtro de linhas que possa crescer além de 1000 para
 * um Caso real (itens por nota, projeção por ano, etc.) precisa paginar.
 */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
