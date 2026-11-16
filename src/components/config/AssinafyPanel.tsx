import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, Notice, Select, TextInput } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getAssinafyConfig, saveAssinafyConfig, type AssinafyPublico } from "@/lib/integracao.functions";

const WEBHOOK_URL = "https://rcbinteligenciatributaria.com.br/api/public/assinafy-webhook";

export function AssinafyPanel() {
  const ler = useServerFn(getAssinafyConfig);
  const salvar = useServerFn(saveAssinafyConfig);
  const [cfg, setCfg] = useState<AssinafyPublico | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const carregar = () => withAuthRetry(() => ler()).then(setCfg).catch(() => setErro("Não foi possível ler a configuração."));
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cfg) return <p className="text-sm text-muted-foreground">Carregando integração...</p>;

  const handleSalvar = async (removerApiKey = false) => {
    setBusy(true);
    setErro("");
    setMsg("");
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            apiKey,
            accountId,
            webhookSecret,
            removerApiKey,
            ambiente: cfg.ambiente,
            signatarioNome: cfg.signatarioNome,
            signatarioEmail: cfg.signatarioEmail,
            signatarioCelular: cfg.signatarioCelular,
            signatarioCpf: cfg.signatarioCpf,
          },
        }),
      );
      setApiKey("");
      setAccountId("");
      setWebhookSecret("");
      await carregar();
      setMsg("Integração salva.");
    } catch {
      setErro("Não foi possível salvar agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg">Assinatura digital — Assinafy</h2>
        <p className="text-sm text-muted-foreground">
          Cole aqui a chave de acesso quando tiver acesso à conta. Até lá, os contratos podem ser gerados e baixados normalmente.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ambiente">
          <Select value={cfg.ambiente} onChange={(e) => setCfg({ ...cfg, ambiente: e.target.value as "sandbox" | "producao" })}>
            <option value="sandbox">Testes (sandbox)</option>
            <option value="producao">Produção (clientes reais)</option>
          </Select>
        </Field>
        <Field
          label="Chave de API (X-Api-Key)"
          hint={cfg.temApiKey ? `Cadastrada (termina em ${cfg.apiKeyFinal}). Deixe vazio para manter.` : "Ainda não cadastrada."}
        >
          <TextInput type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Cole a chave da Assinafy" autoComplete="off" />
        </Field>
        <Field
          label="ID da conta (Workspace)"
          hint={cfg.temAccountId ? "Cadastrado. Deixe vazio para manter." : "Em My Account → Workspaces, na Assinafy."}
        >
          <TextInput value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Cole o ID da conta/workspace" autoComplete="off" />
        </Field>
        <Field label="Signatário do escritório — nome"><TextInput value={cfg.signatarioNome} onChange={(e) => setCfg({ ...cfg, signatarioNome: e.target.value })} /></Field>
        <Field label="E-mail do signatário"><TextInput type="email" value={cfg.signatarioEmail} onChange={(e) => setCfg({ ...cfg, signatarioEmail: e.target.value })} /></Field>
        <Field label="Celular (opcional)"><TextInput value={cfg.signatarioCelular} onChange={(e) => setCfg({ ...cfg, signatarioCelular: e.target.value })} /></Field>
        <Field label="CPF (opcional)"><TextInput value={cfg.signatarioCpf} onChange={(e) => setCfg({ ...cfg, signatarioCpf: e.target.value })} /></Field>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-secondary p-4 text-sm">
        <p className="font-semibold">Atualização automática do CRM (webhook)</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Na Assinafy, abra Configurações → Webhooks → Adicionar endpoint.</li>
          <li>Cole o endereço abaixo, informe um e-mail de contato e marque os eventos: document_ready, signer_signed_document e signer_rejected_document.</li>
          <li>Ative "Standard Webhooks signature" e copie o segredo (começa com "whsec_") no campo abaixo.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-card px-2 py-1 text-xs">{WEBHOOK_URL}</code>
          <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(WEBHOOK_URL).then(() => setMsg("Endereço copiado."))}>
            Copiar endereço
          </Button>
        </div>
        <Field label="Segredo do webhook (whsec_...)" hint={cfg.temWebhookSecret ? "Cadastrado. Deixe vazio para manter." : "Ainda não cadastrado — sem ele o CRM não é atualizado sozinho."}>
          <TextInput type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} autoComplete="off" />
        </Field>
      </div>

      {erro ? <Notice tone="warning">{erro}</Notice> : null}
      {msg ? <Notice>{msg}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void handleSalvar()}>{busy ? "Salvando..." : "Salvar integração"}</Button>
        {cfg.temApiKey ? <Button variant="ghost" disabled={busy} onClick={() => void handleSalvar(true)}>Remover chave</Button> : null}
      </div>
    </section>
  );
}
