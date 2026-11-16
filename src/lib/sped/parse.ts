/**
 * Leitor dos arquivos .txt do SPED (EFD ICMS-IPI e EFD Contribuições).
 * Extrai só os totais de apuração usados na conferência do Diagnóstico;
 * as notas individuais continuam vindo dos XMLs (evita somar duas vezes).
 */

export type SpedTipo = "icms_ipi" | "contribuicoes";

export interface SpedIcmsResumo {
  icms: {
    debitos: number;
    ajustesDebitos: number;
    estornosCreditos: number;
    creditos: number;
    ajustesCreditos: number;
    estornosDebitos: number;
    saldoCredorAnterior: number;
    saldoApurado: number;
    deducoes: number;
    aRecolher: number;
    saldoCredorTransportar: number;
  };
  ipi: { debitos: number; creditos: number; saldoCredorAnterior: number; saldoDevedor: number; saldoCredor: number } | null;
  saidas: { valor: number; icms: number };
  entradas: { valor: number; icms: number };
  porCfop: { cfop: string; valor: number; icms: number }[];
  inventario: number | null;
}

export interface SpedTributoContrib {
  contribuicaoNaoCumulativa: number;
  creditoDescontado: number;
  contribuicaoCumulativa: number;
  totalARecolher: number;
  creditosApurados: number;
  saldoCredorFinal: number;
}

export interface SpedContribResumo {
  regime: "nao_cumulativo" | "cumulativo" | "misto" | null;
  receitaBruta: number;
  pis: SpedTributoContrib;
  cofins: SpedTributoContrib;
}

export interface SpedArquivo {
  arquivo: string;
  tipo: SpedTipo;
  cnpj: string | null;
  razaoSocial: string | null;
  periodoIni: string; // YYYY-MM-DD
  periodoFim: string;
  retificadora: boolean;
  resumo: SpedIcmsResumo | SpedContribResumo;
}

export type SpedLeitura = { ok: true; item: SpedArquivo } | { ok: false; motivo: string };

const n = (v: string | undefined) => {
  if (!v) return 0;
  const x = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const isData = (v: string | undefined) => !!v && /^\d{8}$/.test(v);
const iso = (d: string) => `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;

const tributoVazio = (): SpedTributoContrib => ({
  contribuicaoNaoCumulativa: 0,
  creditoDescontado: 0,
  contribuicaoCumulativa: 0,
  totalARecolher: 0,
  creditosApurados: 0,
  saldoCredorFinal: 0,
});

export function parseSped(arquivo: string, conteudo: string): SpedLeitura {
  const inicio = conteudo.indexOf("|0000|");
  if (inicio < 0) return { ok: false, motivo: "texto sem registro 0000 do SPED" };
  const fimLinha = conteudo.indexOf("\n", inicio);
  const p0 = conteudo.slice(inicio, fimLinha < 0 ? undefined : fimLinha).trim().split("|");
  if (p0[2] === "LECD") return { ok: false, motivo: "ECD (contábil) — ainda não lida" };
  if (p0[2] === "LECF") return { ok: false, motivo: "ECF — ainda não lida" };

  let tipo: SpedTipo;
  let ini: string, fim: string, nome: string, cnpj: string, retif: boolean;
  if (isData(p0[4]) && isData(p0[5])) {
    tipo = "icms_ipi";
    [ini, fim, nome, cnpj] = [p0[4]!, p0[5]!, p0[6] ?? "", p0[7] ?? ""];
    retif = p0[3] === "1";
  } else if (isData(p0[6]) && isData(p0[7])) {
    tipo = "contribuicoes";
    [ini, fim, nome, cnpj] = [p0[6]!, p0[7]!, p0[8] ?? "", p0[9] ?? ""];
    retif = p0[3] === "1";
  } else {
    return { ok: false, motivo: "SPED com layout não reconhecido" };
  }

  const icms: SpedIcmsResumo = {
    icms: {
      debitos: 0, ajustesDebitos: 0, estornosCreditos: 0, creditos: 0, ajustesCreditos: 0,
      estornosDebitos: 0, saldoCredorAnterior: 0, saldoApurado: 0, deducoes: 0, aRecolher: 0,
      saldoCredorTransportar: 0,
    },
    ipi: null,
    saidas: { valor: 0, icms: 0 },
    entradas: { valor: 0, icms: 0 },
    porCfop: [],
    inventario: null,
  };
  const cfops = new Map<string, { valor: number; icms: number }>();
  const contrib: SpedContribResumo = { regime: null, receitaBruta: 0, pis: tributoVazio(), cofins: tributoVazio() };
  let receita0111 = 0;
  let receitaM210 = 0;

  for (const linhaBruta of conteudo.split("\n")) {
    const linha = linhaBruta.trim();
    if (linha.length < 6 || linha[0] !== "|") continue;
    const reg = linha.slice(1, 5);
    const p = linha.split("|");
    if (tipo === "icms_ipi") {
      switch (reg) {
        case "C190":
        case "C590":
        case "D190":
        case "D590": {
          const cfop = p[3] ?? "";
          const valor = n(p[5]);
          const v = n(p[7]);
          const c = cfops.get(cfop) ?? { valor: 0, icms: 0 };
          c.valor += valor;
          c.icms += v;
          cfops.set(cfop, c);
          const alvo = /^[567]/.test(cfop) ? icms.saidas : /^[123]/.test(cfop) ? icms.entradas : null;
          if (alvo) {
            alvo.valor += valor;
            alvo.icms += v;
          }
          break;
        }
        case "E110": {
          const t = icms.icms;
          t.debitos += n(p[2]);
          t.ajustesDebitos += n(p[3]) + n(p[4]);
          t.estornosCreditos += n(p[5]);
          t.creditos += n(p[6]);
          t.ajustesCreditos += n(p[7]) + n(p[8]);
          t.estornosDebitos += n(p[9]);
          t.saldoCredorAnterior += n(p[10]);
          t.saldoApurado += n(p[11]);
          t.deducoes += n(p[12]);
          t.aRecolher += n(p[13]);
          t.saldoCredorTransportar += n(p[14]);
          break;
        }
        case "E520": {
          const i = icms.ipi ?? { debitos: 0, creditos: 0, saldoCredorAnterior: 0, saldoDevedor: 0, saldoCredor: 0 };
          i.saldoCredorAnterior += n(p[2]);
          i.debitos += n(p[3]);
          i.creditos += n(p[4]);
          i.saldoCredor += n(p[7]);
          i.saldoDevedor += n(p[8]);
          icms.ipi = i;
          break;
        }
        case "H005":
          icms.inventario = (icms.inventario ?? 0) + n(p[3]);
          break;
      }
    } else {
      switch (reg) {
        case "0110":
          contrib.regime = p[2] === "1" ? "nao_cumulativo" : p[2] === "2" ? "cumulativo" : p[2] === "3" ? "misto" : null;
          break;
        case "0111":
          receita0111 += n(p[6]);
          break;
        case "M210":
          receitaM210 += n(p[3]);
          break;
        case "M200":
        case "M600": {
          const t = reg === "M200" ? contrib.pis : contrib.cofins;
          t.contribuicaoNaoCumulativa += n(p[2]);
          t.creditoDescontado += n(p[3]) + n(p[4]);
          t.contribuicaoCumulativa += n(p[9]);
          t.totalARecolher += n(p[9]);
          break;
        }
        case "M100":
        case "M500":
          (reg === "M100" ? contrib.pis : contrib.cofins).creditosApurados += n(p[12]);
          break;
        case "1100":
        case "1500":
          (reg === "1100" ? contrib.pis : contrib.cofins).saldoCredorFinal += n(p[18]);
          break;
      }
    }
  }

  let resumo: SpedIcmsResumo | SpedContribResumo;
  if (tipo === "icms_ipi") {
    icms.porCfop = [...cfops.entries()]
      .map(([cfop, c]) => ({ cfop, valor: r2(c.valor), icms: r2(c.icms) }))
      .sort((a, b) => b.valor - a.valor);
    for (const k of Object.keys(icms.icms) as (keyof SpedIcmsResumo["icms"])[]) icms.icms[k] = r2(icms.icms[k]);
    icms.saidas = { valor: r2(icms.saidas.valor), icms: r2(icms.saidas.icms) };
    icms.entradas = { valor: r2(icms.entradas.valor), icms: r2(icms.entradas.icms) };
    resumo = icms;
  } else {
    contrib.receitaBruta = r2(receitaM210 > 0 ? receitaM210 : receita0111);
    for (const t of [contrib.pis, contrib.cofins])
      for (const k of Object.keys(t) as (keyof SpedTributoContrib)[]) t[k] = r2(t[k]);
    resumo = contrib;
  }

  return {
    ok: true,
    item: {
      arquivo,
      tipo,
      cnpj: cnpj.replace(/\D/g, "") || null,
      razaoSocial: nome.trim() || null,
      periodoIni: iso(ini),
      periodoFim: iso(fim),
      retificadora: retif,
      resumo,
    },
  };
}
