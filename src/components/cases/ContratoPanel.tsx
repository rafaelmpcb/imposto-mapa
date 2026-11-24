import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, MoneyInput, Notice, NumberInput, TextInput } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import type { CaseRecord } from "@/lib/cases.functions";
import {
  CONTRATO_LABELS,
  SEGMENTO_LABELS,
  paramsDiagnosticoPadrao,
  type ContratoKind,
  type DadosContratante,
  type Segmento,
} from "@/lib/contrato/tipos";
import {
  enviarContratosAssinafy,
  gerarContratosPdf,
  listarContratosCaso,
  type ContratoCaso,
} from "@/lib/contratos-cliente.functions";
import { getAssinafyConfig } from "@/lib/integracao.functions";
import { lookupCnpj, type CnpjData } from "@/lib/cnpj.functions";

const STATUS: Record<string, string> = {
  gerado: "Gerado",
  enviado: "Aguardando assinatura",
  assinatura_parcial: "Assinado parcialmente",
  assinado: "Assinado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

function baixar(nome: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** cnpj_data salvo na simulação vinculado ao caso (JsonValue). */
function cnpjDataDoCaso(caseItem: CaseRecord): Partial<CnpjData> | null {
  for (const sim of caseItem.simulations ?? []) {
    const raw = sim?.cnpj_data;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Partial<CnpjData>;
    }
  }
  return null;
}

export function ContratoPanel({
  caseItem,
  contatoEmail,
}: {
  caseItem: CaseRecord;
  contatoEmail: string;
}) {
  const gerar = useServerFn(gerarContratosPdf);
  const enviar = useServerFn(enviarContratosAssinafy);
  const listar = useServerFn(listarContratosCaso);
  const lerCfg = useServerFn(getAssinafyConfig);
  const consultarCnpj = useServerFn(lookupCnpj);

  const cnpjSalvo = cnpjDataDoCaso(caseItem);

  const kinds: ContratoKind[] = ["diagnostico"];
  const [cli, setCli] = useState<DadosContratante>({
    razaoSocial: cnpjSalvo?.razao_social || caseItem.client_name || "",
    cnpj: caseItem.cnpj ?? "",
    representante: cnpjSalvo?.representante_sugerido || caseItem.primary_contact_name || "",
    cpf: "",
    endereco: cnpjSalvo?.endereco ?? "",
    email: contatoEmail,
    telefone: caseItem.primary_contact_phone ?? "",
    atividade: cnpjSalvo?.atividade_sugerida ?? "",
    operacoes: "",
  });
  const [diag, setDiag] = useState(() => ({ ...paramsDiagnosticoPadrao(), valorTotal: caseItem.deal_value || 0 }));
  const [temToken, setTemToken] = useState<boolean | null>(null);
  const [lista, setLista] = useState<ContratoCaso[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    void withAuthRetry(() => lerCfg())
      .then((c) => setTemToken(c.temApiKey && c.temAccountId))
      .catch(() => setTemToken(false));
    void withAuthRetry(() => listar({ data: { caseId: caseItem.id } })).then((r) => setLista(r.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem.id]);

  useEffect(() => {
    if (contatoEmail && !cli.email) setCli((c) => ({ ...c, email: contatoEmail }));
  }, [contatoEmail, cli.email]);

  // Consulta pública só como contingência, quando o caso não tem dados salvos
  // de CNPJ em nenhuma simulação (criado direto no CRM, sem cálculo prévio).
  useEffect(() => {
    const cnpj = caseItem.cnpj;
    if (!cnpj || cnpjSalvo) return;
    let ativo = true;
    void consultarCnpj({ data: { cnpj } })
      .then((r) => {
        if (!ativo || !r.ok || !r.data) return;
        const d = r.data;
        setCli((c) => ({
          ...c,
          endereco: c.endereco || d.endereco || "",
          razaoSocial: c.razaoSocial || d.razao_social || "",
        }));
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem.cnpj]);

  const toggleSeg = (s: Segmento) =>
    setDiag((d) => ({ ...d, segmentos: d.segmentos.includes(s) ? d.segmentos.filter((x) => x !== s) : [...d.segmentos, s] }));
  const set = (k: keyof DadosContratante) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCli((c) => ({ ...c, [k]: e.target.value }));

  const payload = () => ({ caseId: caseItem.id, kinds, contratante: cli, diagnostico: diag });

  const handleBaixar = async () => {
    setBusy(true);
    setErro("");
    setOk("");
    try {
      const r = await withAuthRetry(() => gerar({ data: payload() }));
      r.arquivos.forEach((a) => baixar(a.arquivo, a.base64));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleEnviar = async () => {
    setBusy(true);
    setErro("");
    setOk("");
    try {
      const r = await withAuthRetry(() => enviar({ data: payload() }));
      setLista((prev) => [...r.contratos, ...prev]);
      setOk("Enviado! O cliente recebeu o pedido de assinatura por e-mail. Copie o link abaixo para mandar pelo WhatsApp.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErro(m === "SEM_TOKEN" ? "A chave da Assinafy ainda não foi cadastrada nas configurações." : m || "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  };

  const copiarWhats = async (c: ContratoCaso) => {
    const txt = `Olá! Segue o link para assinatura eletrônica da proposta "${c.titulo}": ${c.sign_url}`;
    await navigator.clipboard.writeText(txt);
    setOk("Mensagem com o link copiada.");
  };

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">Gerar e enviar contrato</h3>
        <p className="text-xs text-muted-foreground">
          {CONTRATO_LABELS.diagnostico} — projeto pontual, honorários fechados, Anexo I por
          segmento. Os dados do caso já vêm preenchidos.
        </p>
      </div>

      {temToken === false ? (
        <Notice tone="warning">
          A Assinafy ainda não está conectada. Você já pode gerar e baixar o PDF; para enviar, cadastre a chave em{" "}
          <Link to="/config-aliquotas" className="font-semibold underline">Configurações</Link>.
        </Notice>
      ) : null}

      <div>
        <h4 className="mb-2 text-sm font-semibold">Dados do cliente</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Razão social"><TextInput value={cli.razaoSocial} onChange={set("razaoSocial")} /></Field>
          <Field label="CNPJ"><TextInput value={cli.cnpj} onChange={set("cnpj")} /></Field>
          <Field label="Endereço"><TextInput value={cli.endereco} onChange={set("endereco")} /></Field>
          <Field label="Representante legal"><TextInput value={cli.representante} onChange={set("representante")} /></Field>
          <Field label="CPF do representante"><TextInput value={cli.cpf} onChange={set("cpf")} /></Field>
          <Field label="E-mail para assinatura"><TextInput type="email" value={cli.email} onChange={set("email")} /></Field>
          <Field label="Celular (WhatsApp)"><TextInput value={cli.telefone} onChange={set("telefone")} /></Field>
          <Field label="Atividade (cláusula 1)"><TextInput value={cli.atividade} onChange={set("atividade")} placeholder="comercialização e distribuição de produtos" /></Field>
          <Field label="Operações principais"><TextInput value={cli.operacoes} onChange={set("operacoes")} placeholder="vendas no atacado para todo o Nordeste" /></Field>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <h4 className="text-sm font-semibold">Diagnóstico — condições</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Valor total"><MoneyInput value={diag.valorTotal} onChange={(v) => setDiag({ ...diag, valorTotal: v })} /></Field>
          <Field label="Entrada (%)"><NumberInput value={diag.entradaPct} max={100} onChange={(v) => setDiag({ ...diag, entradaPct: v })} suffix="%" /></Field>
          <Field label="Pagar entrada até"><TextInput type="date" value={diag.entradaData} onChange={(e) => setDiag({ ...diag, entradaData: e.target.value })} /></Field>
          <Field label="Prazo (dias)"><NumberInput value={diag.prazoDias} onChange={(v) => setDiag({ ...diag, prazoDias: v })} /></Field>
        </div>
        <Field label="Forma de pagamento"><TextInput value={diag.formaPagamento} onChange={(e) => setDiag({ ...diag, formaPagamento: e.target.value })} /></Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Anexo I — Parte B (segmento)</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SEGMENTO_LABELS) as Segmento[]).map((s) => (
              <label key={s} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <input type="checkbox" checked={diag.segmentos.includes(s)} onChange={() => toggleSeg(s)} />
                {SEGMENTO_LABELS[s]}
              </label>
            ))}
          </div>
          {diag.segmentos.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Marque ao menos um segmento (sem marcação, entra Comércio).</p> : null}
        </div>
      </div>

      {erro ? <Notice tone="warning">{erro}</Notice> : null}
      {ok ? <Notice>{ok}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={busy || !kinds.length} onClick={() => void handleBaixar()}>
          {busy ? "Gerando..." : "Baixar PDF para conferir"}
        </Button>
        <Button disabled={busy || !temToken} onClick={() => void handleEnviar()}>
          {busy ? "Enviando..." : "Enviar para assinatura"}
        </Button>
      </div>

      {lista.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Contratos deste caso</h4>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {lista.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="flex-1">
                  <span className="block font-medium">{CONTRATO_LABELS[c.kind] ?? c.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")} · {STATUS[c.status] ?? c.status}
                    {c.ambiente === "sandbox" ? " · teste" : ""}
                  </span>
                </span>
                {c.sign_url && c.status !== "assinado" ? (
                  <Button variant="ghost" onClick={() => void copiarWhats(c)}>Copiar link p/ WhatsApp</Button>
                ) : null}
                {c.signed_file_url ? (
                  <a href={c.signed_file_url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">PDF assinado</a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
