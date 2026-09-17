/**
 * Mapeamento best-effort de CNAE principal para a Atividade do simulador.
 * A sugestão é sempre editável pelo usuário — o CNAE não comprova enquadramento.
 */
const PREFIX_MAP: { prefix: string; activity: string }[] = [
  { prefix: "6911", activity: "advocacia" }, // atividades jurídicas
  { prefix: "6912", activity: "advocacia" },
  { prefix: "6920", activity: "contabilidade" }, // contabilidade e auditoria
  { prefix: "7111", activity: "engenharia" }, // serviços de arquitetura
  { prefix: "7112", activity: "engenharia" }, // serviços de engenharia
  { prefix: "7119", activity: "engenharia" },
  { prefix: "7120", activity: "engenharia" },
  { prefix: "8610", activity: "saude" }, // hospitais
  { prefix: "8630", activity: "saude" }, // consultórios e clínicas
  { prefix: "8640", activity: "saude" },
  { prefix: "8650", activity: "saude" },
  { prefix: "8660", activity: "saude" },
  { prefix: "8690", activity: "saude" },
  { prefix: "8711", activity: "saude" },
  { prefix: "851", activity: "educacao" },
  { prefix: "852", activity: "educacao" },
  { prefix: "853", activity: "educacao" },
  { prefix: "854", activity: "educacao" },
  { prefix: "855", activity: "educacao" },
  { prefix: "59", activity: "cultura" }, // cinema, vídeo, música
  { prefix: "90", activity: "cultura" }, // artes e espetáculos
  { prefix: "91", activity: "cultura" },
  { prefix: "01", activity: "agro" },
  { prefix: "02", activity: "agro" },
  { prefix: "03", activity: "agro" },
  { prefix: "45", activity: "varejo" },
  { prefix: "47", activity: "varejo" }, // comércio varejista
  { prefix: "6201", activity: "tecnologia" },
  { prefix: "6202", activity: "tecnologia" },
  { prefix: "6203", activity: "tecnologia" },
  { prefix: "6204", activity: "tecnologia" },
  { prefix: "6209", activity: "tecnologia" },
  { prefix: "6311", activity: "tecnologia" },
  { prefix: "6319", activity: "tecnologia" },
];

const KEYWORDS: { test: RegExp; activity: string }[] = [
  { test: /jurídic|advocac/i, activity: "advocacia" },
  { test: /contabil|contábil|auditoria/i, activity: "contabilidade" },
  { test: /engenhar|arquitet/i, activity: "engenharia" },
  { test: /médic|medicina|clínic|hospital|odontol|saúde/i, activity: "saude" },
  { test: /ensino|escola|educa|curso/i, activity: "educacao" },
  { test: /cultur|artíst|teatro|música|cinema/i, activity: "cultura" },
  { test: /agric|pecuár|agropec|cultivo/i, activity: "agro" },
  { test: /varejist|comércio varejo|comércio a varejo/i, activity: "varejo" },
  { test: /fabrica|indústr|industrial|transforma/i, activity: "industria" },
  { test: /sistemas|software|tecnologia da informa|desenvolvimento de programas/i, activity: "tecnologia" },
];

export function activityFromCnae(codigo: string, descricao: string): string {
  const digits = (codigo || "").replace(/\D/g, "");
  const match = PREFIX_MAP.filter((m) => digits.startsWith(m.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  if (match) return match.activity;
  // indústria de transformação: divisões 10 a 33
  const div = Number(digits.slice(0, 2));
  if (div >= 10 && div <= 33) return "industria";
  if (/^49(1|2|3)/.test(digits)) return "servicos_gerais"; // transporte
  for (const k of KEYWORDS) if (k.test(descricao || "")) return k.activity;
  return "servicos_gerais";
}
