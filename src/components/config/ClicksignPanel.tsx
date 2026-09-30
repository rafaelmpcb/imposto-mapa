import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, Notice, Select, TextInput } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import { getClicksignConfig, saveClicksignConfig, type ClicksignPublico } from "@/lib/integracao.functions";

const WEBHOOK_URL = "https://imposto-mapa.lovable.app/api/public/clicksign-webhook";

export function ClicksignPanel() {
  const ler = useServerFn(getClicksignConfig);
  const salvar = useServerFn(saveClicksignConfig);
  const [cfg, setCfg] = useState<ClicksignPublico | null>(null);
  const [token, setToken] = useState("");
  const [hmac, setHmac] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const carregar = () => withAuthRetry(() => ler()).then(setCfg).catch(() => setErro("Não foi possível ler a configuração."));
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cfg) return <p className="text-sm text-muted-foreground">Carregando integração...</p>;

  const handleSalvar = async (removerToken = false) => {
    setBusy(true);
    setErro("");
    setMsg("");
    try {
      await withAuthRetry(() =>
        salvar({
          data: {
            token,
            hmac,
            removerToken,
            ambiente: cfg.ambiente,
            signatarioNome: cfg.signatarioNome,
            signatarioEmail: cfg.signatarioEmail,
            signatarioCelular: cfg.signatarioCelular,
            signatarioCpf: cfg.signatarioCpf,
          },
        }),
      );
      setToken("");
      setHmac("");
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
        <h2 className="text-lg">Assinatura digital — Clicksign</h2>
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
          label="Chave de acesso (Access Token)"
          hint={cfg.temToken ? `Cadastrada (termina em ${cfg.tokenFinal}). Deixe vazio para manter.` : "Ainda não cadastrada."}
        >
          <TextInput type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token da Clicksign" autoComplete="off" />
        </Field>
        <Field label="Signatário do escritório — nome"><TextInput value={cfg.signatarioNome} onChange={(e) => setCfg({ ...cfg, signatarioNome: e.target.value })} /></Field>
        <Field label="E-mail do signatário"><TextInput type="email" value={cfg.signatarioEmail} onChange={(e) => setCfg({ ...cfg, signatarioEmail: e.target.value })} /></Field>
        <Field label="Celular (opcional)"><TextInput value={cfg.signatarioCelular} onChange={(e) => setCfg({ ...cfg, signatarioCelular: e.target.value })} /></Field>
        <Field label="CPF (opcional)"><TextInput value={cfg.signatarioCpf} onChange={(e) => setCfg({ ...cfg, signatarioCpf: e.target.value })} /></Field>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-secondary p-4 text-sm">
        <p className="font-semibold">Atualização automática do CRM (webhook)</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Na Clicksign, abra Configurações → Webhooks → Adicionar.</li>
          <li>Cole o endereço abaixo e marque os eventos de assinatura e de documento finalizado.</li>
          <li>Copie a "chave HMAC SHA256" que a Clicksign mostrar e cole no campo abaixo.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-card px-2 py-1 text-xs">{WEBHOOK_URL}</code>
          <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(WEBHOOK_URL).then(() => setMsg("Endereço copiado."))}>
            Copiar endereço
          </Button>
        </div>
        <Field label="Chave HMAC do webhook" hint={cfg.temHmac ? "Cadastrada. Deixe vazio para manter." : "Ainda não cadastrada — sem ela o CRM não é atualizado sozinho."}>
          <TextInput type="password" value={hmac} onChange={(e) => setHmac(e.target.value)} autoComplete="off" />
        </Field>
      </div>

      {erro ? <Notice tone="warning">{erro}</Notice> : null}
      {msg ? <Notice>{msg}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void handleSalvar()}>{busy ? "Salvando..." : "Salvar integração"}</Button>
        {cfg.temToken ? <Button variant="ghost" disabled={busy} onClick={() => void handleSalvar(true)}>Remover chave</Button> : null}
      </div>
    </section>
  );
}
