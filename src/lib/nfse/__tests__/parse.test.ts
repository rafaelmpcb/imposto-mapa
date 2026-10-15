import { describe, expect, it } from "vitest";

import { isDpsDocumento } from "@/lib/nfse/parse";

const DPS_NACIONAL = `<?xml version="1.0"?><DPS><infDPS Id="DPS43051082211533540001460000020">
<tpAmb>1</tpAmb><dhEmi>2026-08-13T10:00:00</dhEmi><serie>60</serie><nDPS>20</nDPS>
<prest><CNPJ>21153354000146</CNPJ></prest></infDPS></DPS>`;

const NFSE_NACIONAL_COM_DPS_EMBUTIDA = `<?xml version="1.0"?><NFSe><infNFSe Id="NFS430510812211533540001460000000002989">
<nNFSe>2989</nNFSe><chNFSe>43051081221153354000146000000000298926089902232892</chNFSe>
<DPS><infDPS><serie>60</serie><nDPS>20</nDPS></infDPS></DPS></infNFSe></NFSe>`;

const NFSE_MUNICIPAL_CAXIAS = `<?xml version="1.0"?><NFS-e><infNFSe versao="1.1">
<Id><cNFS-e>2216</cNFS-e><mod>98</mod><serie>S</serie><nNFS-e>2216</nNFS-e><dEmi>2025-08-01</dEmi>
<refNF>43211533540001469800S000002216000002216</refNF></Id>
<prest><CNPJ>21153354000146</CNPJ></prest></infNFSe></NFS-e>`;

describe("isDpsDocumento", () => {
  it("reconhece DPS avulsa (sem nNFSe/chNFSe) como declaração, não como nota", () => {
    expect(isDpsDocumento(DPS_NACIONAL)).toBe(true);
  });

  it("não confunde NFS-e Nacional que embute o bloco da DPS de origem", () => {
    expect(isDpsDocumento(NFSE_NACIONAL_COM_DPS_EMBUTIDA)).toBe(false);
  });

  it("não confunde NFS-e municipal (layout Caxias do Sul) com DPS", () => {
    expect(isDpsDocumento(NFSE_MUNICIPAL_CAXIAS)).toBe(false);
  });
});
