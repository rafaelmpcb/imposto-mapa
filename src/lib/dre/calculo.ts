/**
 * Composição da DRE ano a ano (Pilar 3). Módulo puro: não lê banco, não
 * recalcula crédito, débito nem preço necessário — apenas combina séries que
 * as etapas anteriores já produziram.
 */

export type CenarioDre = "atual" | "projetado";

export const round2 = (v: number) => Math.round(v * 100) / 100;

export interface DreInsumos {
  /** Receita bruta atual: valor dos itens de venda (mercadoria + serviço prestado). */
  receitaBrutaAtual: number;
  /** Receita projetada: soma do valor desonerado dos mesmos itens (base sem tributo por dentro). */
  receitaBrutaDesonerada: number;
  /** Tributos atuais sobre a receita já extraídos item a item. */
  tributosAtuaisVendas: number;
  /** Débito de IBS/CBS apurado item a item, em alíquota plena. */
  debitoIbsCbsPleno: number;
  /** Custo das compras do período, sem desconto de crédito. */
  custoCompras: number;
  /** Crédito de IBS/CBS apurado item a item nas compras, em alíquota plena. */
  creditoIbsCbsPleno: number;
}

export interface AnoRampa {
  ano: number;
  /** Fração da alíquota plena vigente no ano (0 a 1). */
  fracao: number;
}

export interface IrcsDoAno {
  valor: number | null;
  /** Como o valor foi obtido: marco do motor de regime, repetição do marco anterior ou indisponível. */
  origem: "motor_regime" | "marco_anterior" | "indisponivel";
}

export interface DreLinhaAno {
  ano: number;
  cenario: CenarioDre;
  fracao: number;
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custo: number;
  lucroBruto: number;
  despesasOperacionais: number;
  resultadoAntesIrcs: number;
  ircs: number | null;
  resultadoLiquido: number | null;
  ircsOrigem: IrcsDoAno["origem"];
}

/** Monta as duas colunas (atual e projetado) para cada ano da rampa. */
export function montarDre(input: {
  insumos: DreInsumos;
  anos: AnoRampa[];
  /** Despesas operacionais informadas por ano (mesmo valor nos dois cenários). */
  despesasPorAno: Record<number, number>;
  /** IRPJ + CSLL vindos do motor de regime, por ano e cenário. */
  ircs: (ano: number, cenario: CenarioDre) => IrcsDoAno;
}): DreLinhaAno[] {
  const { insumos, anos, despesasPorAno } = input;
  const linhas: DreLinhaAno[] = [];

  for (const { ano, fracao } of anos) {
    const f = Math.min(1, Math.max(0, Number(fracao) || 0));
    const despesas = round2(Number(despesasPorAno[ano] ?? 0));

    for (const cenario of ["atual", "projetado"] as CenarioDre[]) {
      const projetado = cenario === "projetado";

      // No cenário projetado a receita migra para a base desonerada só na medida
      // em que a rampa avança — em 2026 (fração 0) as duas colunas coincidem.
      const receitaBruta = projetado
        ? round2(
            insumos.receitaBrutaAtual +
              (insumos.receitaBrutaDesonerada - insumos.receitaBrutaAtual) * f,
          )
        : round2(insumos.receitaBrutaAtual);

      const deducoes = projetado
        ? round2(
            insumos.tributosAtuaisVendas * (1 - f) + insumos.debitoIbsCbsPleno * f,
          )
        : round2(insumos.tributosAtuaisVendas);

      const custo = projetado
        ? round2(insumos.custoCompras - insumos.creditoIbsCbsPleno * f)
        : round2(insumos.custoCompras);

      const receitaLiquida = round2(receitaBruta - deducoes);
      const lucroBruto = round2(receitaLiquida - custo);
      const resultadoAntesIrcs = round2(lucroBruto - despesas);
      const ircs = input.ircs(ano, cenario);

      linhas.push({
        ano,
        cenario,
        fracao: f,
        receitaBruta,
        deducoes,
        receitaLiquida,
        custo,
        lucroBruto,
        despesasOperacionais: despesas,
        resultadoAntesIrcs,
        ircs: ircs.valor,
        resultadoLiquido: ircs.valor === null ? null : round2(resultadoAntesIrcs - ircs.valor),
        ircsOrigem: ircs.origem,
      });
    }
  }

  return linhas;
}

/**
 * IRPJ/CSLL por ano a partir dos anos-marco do motor de regime: o ano usa o
 * marco exato quando existir, senão repete o marco anterior mais próximo.
 */
export function ircsPorAno(
  marcos: { ano: number; atual: number; projetado: number }[],
): (ano: number, cenario: CenarioDre) => IrcsDoAno {
  const ordenados = [...marcos].sort((a, b) => a.ano - b.ano);
  return (ano, cenario) => {
    const exato = ordenados.find((m) => m.ano === ano);
    if (exato) return { valor: round2(exato[cenario]), origem: "motor_regime" };
    const anterior = [...ordenados].reverse().find((m) => m.ano < ano);
    if (anterior) return { valor: round2(anterior[cenario]), origem: "marco_anterior" };
    return { valor: null, origem: "indisponivel" };
  };
}
