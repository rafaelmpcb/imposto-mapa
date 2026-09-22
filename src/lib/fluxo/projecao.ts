/**
 * Projeção mensal simplificada de fluxo de caixa (Pilar 4). Módulo puro.
 * Separa resultado econômico (DRE) de disponibilidade financeira: aplica as
 * defasagens de recebimento, pagamento e compensação de crédito sobre séries
 * anuais já calculadas, distribuídas uniformemente pelos 12 meses.
 */

export const round2 = (v: number) => Math.round(v * 100) / 100;

export interface AnoFluxo {
  ano: number;
  /** Receita líquida de tributo que efetivamente entra no caixa no ano. */
  entradasAno: number;
  /** Custo das compras pago a fornecedores no ano. */
  saidasFornecedoresAno: number;
  /** Despesas operacionais do ano. */
  despesasAno: number;
  /** Débito de IBS/CBS das vendas do ano (retido na origem, split payment). */
  debitoAno: number;
  /** Crédito de IBS/CBS das compras do ano. */
  creditoAno: number;
}

export interface ParametrosFluxo {
  prazoRecebimentoDias: number;
  prazoPagamentoDias: number;
  periodicidadeCreditoDias: number;
}

export interface MesFluxo {
  ano: number;
  mes: number;
  entradasClientes: number;
  saidasFornecedores: number;
  saidasDespesas: number;
  debitoIbsCbsRetido: number;
  creditoIbsCbsDisponivel: number;
  debitoLiquidoRecolhido: number;
  saldoCredorAcumulado: number;
  variacaoCaixa: number;
}

const deslocamentoMeses = (dias: number) => Math.max(0, Math.round((Number(dias) || 0) / 30));

/** Projeta mês a mês, deslocando cada componente pelo prazo configurado. */
export function projetarFluxo(anos: AnoFluxo[], params: ParametrosFluxo): MesFluxo[] {
  const ordenados = [...anos].sort((a, b) => a.ano - b.ano);
  if (ordenados.length === 0) return [];

  const total = ordenados.length * 12;
  const zeros = () => new Array<number>(total).fill(0);
  const entradas = zeros();
  const saidas = zeros();
  const despesas = zeros();
  const debito = zeros();
  const credito = zeros();

  const dRec = deslocamentoMeses(params.prazoRecebimentoDias);
  const dPag = deslocamentoMeses(params.prazoPagamentoDias);
  const dCre = deslocamentoMeses(params.periodicidadeCreditoDias);

  const somar = (serie: number[], indice: number, valor: number) => {
    if (indice >= 0 && indice < serie.length) serie[indice] = (serie[indice] ?? 0) + valor;
  };

  ordenados.forEach((a, i) => {
    for (let m = 0; m < 12; m += 1) {
      const idx = i * 12 + m;
      somar(entradas, idx + dRec, a.entradasAno / 12);
      somar(saidas, idx + dPag, a.saidasFornecedoresAno / 12);
      somar(despesas, idx, a.despesasAno / 12);
      // O débito é retido na venda (split payment), no próprio mês do fato.
      somar(debito, idx, a.debitoAno / 12);
      somar(credito, idx + dCre, a.creditoAno / 12);
    }
  });

  const linhas: MesFluxo[] = [];
  let saldoCredor = 0;

  for (let idx = 0; idx < total; idx += 1) {
    const ano = ordenados[Math.floor(idx / 12)]!.ano;
    const mes = (idx % 12) + 1;

    const creditoDisponivel = (credito[idx] ?? 0) + saldoCredor;
    const debitoMes = debito[idx] ?? 0;
    const debitoLiquido = Math.max(0, debitoMes - creditoDisponivel);
    saldoCredor = Math.max(0, creditoDisponivel - debitoMes);

    const entradasMes = entradas[idx] ?? 0;
    const saidasMes = saidas[idx] ?? 0;
    const despesasMes = despesas[idx] ?? 0;
    const variacao = entradasMes - saidasMes - despesasMes - debitoLiquido;

    linhas.push({
      ano,
      mes,
      entradasClientes: round2(entradasMes),
      saidasFornecedores: round2(saidasMes),
      saidasDespesas: round2(despesasMes),
      debitoIbsCbsRetido: round2(debitoMes),
      creditoIbsCbsDisponivel: round2(credito[idx] ?? 0),
      debitoLiquidoRecolhido: round2(debitoLiquido),
      saldoCredorAcumulado: round2(saldoCredor),
      variacaoCaixa: round2(variacao),
    });
  }

  return linhas;
}

/** Sequências de dois ou mais meses seguidos com variação de caixa negativa. */
export function janelasDePressao(linhas: MesFluxo[]): { inicio: MesFluxo; fim: MesFluxo }[] {
  const janelas: { inicio: MesFluxo; fim: MesFluxo }[] = [];
  let inicio: MesFluxo | null = null;
  let anterior: MesFluxo | null = null;
  let contagem = 0;

  for (const l of linhas) {
    if (l.variacaoCaixa < 0) {
      if (!inicio) inicio = l;
      contagem += 1;
      anterior = l;
    } else {
      if (inicio && contagem >= 2 && anterior) janelas.push({ inicio, fim: anterior });
      inicio = null;
      anterior = null;
      contagem = 0;
    }
  }
  if (inicio && contagem >= 2 && anterior) janelas.push({ inicio, fim: anterior });
  return janelas;
}
