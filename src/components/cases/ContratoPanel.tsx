import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, MoneyInput, Notice, NumberInput, Select, TextInput } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import type { CaseRecord } from "@/lib/cases.functions";
import {
  CONTRATO_LABELS,
  SEGMENTO_LABELS,
  paramsAssessoriaPadrao,
  paramsDiagnosticoPadrao,
  type ContratoKind,
  type DadosContratante,
  type Segmento,
} from "@/lib/contrato/tipos";
import {
  enviarContratosClicksign,
  gerarContratosPdf,
  listarContratosCaso,
  type ContratoCaso,
} from "@/lib/contratos-cliente.functions";
import { getClicksignConfig } from "@/lib/integracao.functions";

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

export function ContratoPanel({
  caseItem,
  contatoEmail,
}: {
  caseItem: CaseRecord;
  contatoEmail: string;
}) {
  const gerar = useServerFn(gerarContratosPdf);
  const enviar = useServerFn(enviarContratosClicksign);
  const listar = useServerFn(listarContratosCaso);
  const lerCfg = useServerFn(getClicksignConfig);

  const [kinds, setKinds] = useState<ContratoKind[]>(["diagnostico"]);
  const [cli, setCli] = useState<DadosContratante>({
    razaoSocial: caseItem.client_name ?? "",
    cnpj: caseItem.cnpj ?? "",
    representante: caseItem.primary_contact_name ?? "",
    cpf: "",
    endereco: "",
    email: contatoEmail,
    telefone: caseItem.primary_contact_phone ?? "",
    atividade: "",
    operacoes: "",
  });
  const [diag, setDiag] = useState(() => ({ ...paramsDiagnosticoPadrao(), valorTotal: caseItem.deal_value || 0 }));
  const [ass, setAss] = useState(paramsAssessoriaPadrao);
  const [temToken, setTemToken] = useState<boolean | null>(null);
  const [lista, setLista] = useState<ContratoCaso[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    void withAuthRetry(() => lerCfg()).then((c) => setTemToken(c.temToken)).catch(() => setTemToken(false));
    void withAuthRetry(() => listar({ data: { caseId: caseItem.id } })).then((r) => setLista(r.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem.id]);

  useEffect(() => {
    if (contatoEmail && !cli.email) setCli((c) => ({ ...c, email: contatoEmail }));
  }, [contatoEmail, cli.email]);

  const toggleKind = (k: ContratoKind) =>
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggleSeg = (s: Segmento) =>
    setDiag((d) => ({ ...d, segmentos: d.segmentos.includes(s) ? d.segmentos.filter((x) => x !== s) : [...d.segmentos, s] }));
  const set = (k: keyof DadosContratante) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCli((c) => ({ ...c, [k]: e.target.value }));

  const payload = () => ({ caseId: caseItem.id, kinds, contratante: cli, diagnostico: diag, assessoria: ass });

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
      setErro(m === "SEM_TOKEN" ? "A chave da Clicksign ainda não foi cadastrada nas configurações." : m || "Falha ao enviar.");
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
        <p className="text-xs text-muted-foreground">Escolha um ou os dois modelos. Os dados do caso já vêm preenchidos.</p>
      </div>

      {temToken === false ? (
        <Notice tone="warning">
          A Clicksign ainda não está conectada. Você já pode gerar e baixar o PDF; para enviar, cadastre a chave em{" "}
          <Link to="/config-aliquotas" className="font-semibold underline">Configurações</Link>.
        </Notice>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(CONTRATO_LABELS) as ContratoKind[]).map((k) => (
          <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${kinds.includes(k) ? "border-navy bg-secondary" : "border-border"}`}>
            <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggleKind(k)} className="mt-1" />
            <span>
              <span className="block text-sm font-semibold">{CONTRATO_LABELS[k]}</span>
              <span className="text-xs text-muted-foreground">
                {k === "diagnostico" ? "Projeto pontual, honorários fechados, Anexo I por segmento." : "Mensalidade, limites de atendimento e hora técnica."}
              </span>
            </span>
          </label>
        ))}
      </div>

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

      {kinds.includes("diagnostico") ? (
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
      ) : null}

      {kinds.includes("assessoria") ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold">Assessoria contínua — condições</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Mensalidade"><MoneyInput value={ass.mensalidade} onChange={(v) => setAss({ ...ass, mensalidade: v })} /></Field>
            <Field label="Dia do vencimento"><NumberInput value={ass.diaVencimento} max={31} onChange={(v) => setAss({ ...ass, diaVencimento: v })} /></Field>
            <Field label="1ª mensalidade até"><TextInput type="date" value={ass.primeiraMensalidadeData} onChange={(e) => setAss({ ...ass, primeiraMensalidadeData: e.target.value })} /></Field>
            <Field label="Hora técnica"><MoneyInput value={ass.horaTecnica} onChange={(v) => setAss({ ...ass, horaTecnica: v })} /></Field>
            <Field label="Reuniões por mês"><NumberInput value={ass.reunioesMes} onChange={(v) => setAss({ ...ass, reunioesMes: v })} /></Field>
            <Field label="Duração da reunião (h)"><NumberInput value={ass.duracaoReuniaoHoras} onChange={(v) => setAss({ ...ass, duracaoReuniaoHoras: v })} /></Field>
            <Field label="Consultas por mês"><NumberInput value={ass.consultasMes} onChange={(v) => setAss({ ...ass, consultasMes: v })} /></Field>
            <Field label="Resposta em (dias úteis)"><NumberInput value={ass.prazoRespostaDiasUteis} onChange={(v) => setAss({ ...ass, prazoRespostaDiasUteis: v })} /></Field>
            <Field label="Vigência (meses)"><NumberInput value={ass.vigenciaMeses} onChange={(v) => setAss({ ...ass, vigenciaMeses: v })} /></Field>
            <Field label="Aviso prévio (dias)"><NumberInput value={ass.avisoPrevioDias} onChange={(v) => setAss({ ...ass, avisoPrevioDias: v })} /></Field>
            <Field label="Canal de suporte"><TextInput value={ass.canal} onChange={(e) => setAss({ ...ass, canal: e.target.value })} /></Field>
            <Field label="Informativo"><TextInput value={ass.periodicidadeInformativo} onChange={(e) => setAss({ ...ass, periodicidadeInformativo: e.target.value })} /></Field>
            <Field label="Ponto de partida">
              <Select value={ass.pontoPartida} onChange={(e) => setAss({ ...ass, pontoPartida: e.target.value as "diagnostico" | "levantamento" })}>
                <option value="levantamento">Levantamento no 1º mês</option>
                <option value="diagnostico">Diagnóstico já entregue</option>
              </Select>
            </Field>
            <Field label="Revisão de contratos">
              <Select value={ass.revisaoContratos} onChange={(e) => setAss({ ...ass, revisaoContratos: e.target.value as "nao" | "incluida" })}>
                <option value="nao">Não incluída</option>
                <option value="incluida">Incluída (limite)</option>
              </Select>
            </Field>
            {ass.revisaoContratos === "incluida" ? (
              <Field label="Contratos por mês"><NumberInput value={ass.revisaoContratosQtd} onChange={(v) => setAss({ ...ass, revisaoContratosQtd: v })} /></Field>
            ) : null}
            <Field label="Pareceres formais">
              <Select value={ass.pareceres} onChange={(e) => setAss({ ...ass, pareceres: e.target.value as "nao" | "incluidos" })}>
                <option value="nao">Não incluídos</option>
                <option value="incluidos">Incluídos (limite)</option>
              </Select>
            </Field>
            {ass.pareceres === "incluidos" ? (
              <Field label="Pareceres por mês"><NumberInput value={ass.pareceresQtd} onChange={(v) => setAss({ ...ass, pareceresQtd: v })} /></Field>
            ) : null}
          </div>
        </div>
      ) : null}

      {erro ? <Notice tone="warning">{erro}</Notice> : null}
      {ok ? <Notice>{ok}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={busy || !kinds.length} onClick={() => void handleBaixar()}>
          {busy ? "Gerando..." : "Baixar PDF para conferir"}
        </Button>
        <Button disabled={busy || !kinds.length || !temToken} onClick={() => void handleEnviar()}>
          {busy ? "Enviando..." : kinds.length > 1 ? "Enviar os 2 para assinatura" : "Enviar para assinatura"}
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
