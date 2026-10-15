/**
 * Deduplicação de documentos fiscais na carga.
 *
 * A chave de acesso de 44 dígitos nem sempre existe (NFS-e de layout
 * municipal, por exemplo), então toda nota também é reconhecida por uma
 * chave composta de negócio (CNPJ + série + número). Uma nota é descartada
 * quando qualquer uma das duas chaves já existe no Caso ou já apareceu no
 * próprio lote — evita o acúmulo de 2x no faturamento em reenvios.
 */

export interface NotaIdentidade {
  chave: string | null;
  composta: string | null;
  arquivo: string;
}

export interface ResultadoDedup<T> {
  novas: T[];
  repetidas: { chave: string; arquivo: string }[];
}

export function filtrarNotasDuplicadas<T extends NotaIdentidade>(
  notas: T[],
  jaGravadasChaves: Set<string>,
  jaGravadasCompostas: Set<string>,
): ResultadoDedup<T> {
  const vistas = new Set<string>();
  const vistasCompostas = new Set<string>();
  const repetidas: { chave: string; arquivo: string }[] = [];
  const novas = notas.filter((n) => {
    const chaveJaExiste = n.chave ? jaGravadasChaves.has(n.chave) : false;
    const compostaJaExiste = n.composta ? jaGravadasCompostas.has(n.composta) : false;
    const chaveVista = n.chave ? vistas.has(n.chave) : false;
    const compostaVista = n.composta ? vistasCompostas.has(n.composta) : false;
    if (chaveJaExiste || compostaJaExiste || chaveVista || compostaVista) {
      if (chaveJaExiste || compostaJaExiste) {
        repetidas.push({ chave: n.chave ?? n.composta ?? n.arquivo, arquivo: n.arquivo });
      }
      return false;
    }
    if (n.chave) vistas.add(n.chave);
    if (n.composta) vistasCompostas.add(n.composta);
    return true;
  });
  return { novas, repetidas };
}
