import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Entrar — área restrita do escritório";
const DESCRIPTION =
  "Acesso da equipe do escritório ao histórico de simulações e às configurações do simulador da Reforma Tributária.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/meus-calculos", replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (signUpError) {
        const message = signUpError.message.toLowerCase();
        if (message.includes("already")) setError("Esse e-mail já tem conta. Use a aba Entrar.");
        else if (message.includes("password"))
          setError("Senha muito curta ou insegura. Use ao menos 8 caracteres.");
        else if (message.includes("email")) setError("E-mail inválido.");
        else setError("Não foi possível criar a conta agora. Tente de novo.");
        return;
      }
      if (!data.session) {
        setInfo("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.");
        setMode("signin");
        return;
      }
      void navigate({ to: "/meus-calculos", replace: true });
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    void navigate({ to: "/meus-calculos", replace: true });
  };

  const signInGoogle = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      setError("Não foi possível entrar com o Google agora.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/meus-calculos", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Área restrita do escritório
        </p>
        <h1 className="mt-2 text-2xl">Entrar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesso exclusivo da equipe. As contas são criadas pelo escritório.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(e) => void signInEmail(e)}>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@escritorio.com.br"
            />
          </Field>
          <Field label="Senha">
            <TextInput
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
            />
          </Field>
          {error ? <Notice tone="warning">{error}</Notice> : null}
          <Button type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="ghost" onClick={() => void signInGoogle()} disabled={busy}>
          Entrar com Google
        </Button>
      </div>
    </main>
  );
}
