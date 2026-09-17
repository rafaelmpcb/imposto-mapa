import type { CnpjData } from "@/lib/cnpj/types";
import { getActivity } from "@/lib/tax/constants";
import { simulate, type SimulationInput, type TaxpayerType } from "@/lib/tax/calc";
import type { YearId } from "@/lib/tax/constants";

const REGIME_LABELS: Record<TaxpayerType, string> = {
  pf: "Pessoa Física (CLT)",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

export function buildIdentifiedProfile(
  cnpjData: CnpjData | null | undefined,
  input: SimulationInput,
  year: YearId,
): string | null {
  if (
    !cnpjData?.razao_social.trim() ||
    !cnpjData.cnpj.trim() ||
    !cnpjData.cnae_codigo.trim() ||
    !cnpjData.cnae_descricao.trim()
  ) {
    return null;
  }

  const activity = getActivity(input.activityId);
  const result = simulate(input, year);
  const companyName = cnpjData.nome_fantasia.trim() || cnpjData.razao_social.trim();
  const reduction = Math.round(activity.reduction * 100);
  let treatment: string;

  if (result.benefitApplied && reduction > 0) {
    treatment = `têm tratamento diferenciado, com redução de ${reduction}% da alíquota de referência de IBS/CBS`;
  } else if (result.benefitLost && reduction > 0) {
    treatment = `podem ter tratamento diferenciado, mas a redução de ${reduction}% da alíquota de referência de IBS/CBS não foi aplicada porque os requisitos informados não foram atendidos`;
  } else if (input.taxpayerType === "simples") {
    treatment = "estão enquadradas no Simples Nacional nesta simulação, sem redução específica de IBS/CBS pela atividade selecionada";
  } else if (input.taxpayerType === "mei") {
    treatment = "estão enquadradas no regime próprio do MEI nesta simulação, sem redução específica de IBS/CBS pela atividade selecionada";
  } else {
    treatment = "não têm redução específica de IBS/CBS pela atividade selecionada nesta simulação";
  }

  return `Identificamos, a partir do CNPJ informado, que ${companyName} (CNPJ ${cnpjData.cnpj}) atua no ramo de ${cnpjData.cnae_descricao} (CNAE ${cnpjData.cnae_codigo}). Empresas desse setor, considerando o enquadramento informado como ${REGIME_LABELS[input.taxpayerType]}, ${treatment}, para a atividade selecionada nesta simulação (${activity.label}).`;
}