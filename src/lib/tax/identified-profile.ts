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
  const razaoSocial = typeof cnpjData?.razao_social === "string" ? cnpjData.razao_social.trim() : "";
  const cnpj = typeof cnpjData?.cnpj === "string" ? cnpjData.cnpj.trim() : "";
  const cnaeCodigo = typeof cnpjData?.cnae_codigo === "string" ? cnpjData.cnae_codigo.trim() : "";
  const cnaeDescricao =
    typeof cnpjData?.cnae_descricao === "string" ? cnpjData.cnae_descricao.trim() : "";
  if (
    !razaoSocial ||
    !cnpj ||
    !cnaeCodigo ||
    !cnaeDescricao
  ) {
    return null;
  }

  const activity = getActivity(input.activityId);
  const result = simulate(input, year);
  const companyName =
    (typeof cnpjData?.nome_fantasia === "string" ? cnpjData.nome_fantasia.trim() : "") ||
    razaoSocial;
  const reduction = Math.round(activity.reduction * 100);
  let treatment: string;

  if (result.benefitApplied && reduction > 0) {
    treatment = `têm tratamento diferenciado, com redução de ${reduction}% da alíquota de referência de IBS/CBS`;
  } else if (result.benefitLost && reduction > 0) {
    treatment = `podem ter tratamento diferenciado, mas a redução de ${reduction}% da alíquota de referência de IBS/CBS não foi aplicada porque os requisitos informados não foram atendidos`;
  } else if (input.taxpayerType === "simples") {
    treatment = "estão enquadradas no Simples Nacional nesta simulação, sem redução específica de IBS/CBS";
  } else if (input.taxpayerType === "mei") {
    treatment = "estão enquadradas no regime próprio do MEI nesta simulação, sem redução específica de IBS/CBS";
  } else {
    treatment = "não têm redução específica de IBS/CBS nesta simulação";
  }

  return `Identificamos, a partir do CNPJ informado, que ${companyName} (CNPJ ${cnpj}) atua no ramo de ${cnaeDescricao} (CNAE ${cnaeCodigo}). Empresas desse setor, considerando o enquadramento informado como ${REGIME_LABELS[input.taxpayerType]} e a atividade selecionada nesta simulação (${activity.label}), ${treatment}.`;
}