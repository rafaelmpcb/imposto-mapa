# Consertar a página de login

Hoje ninguém consegue entrar: o cadastro de novas contas está bloqueado no sistema. Por isso o botão do Google recusa o acesso (sua conta ainda não existe) e o e-mail/senha responde "credenciais inválidas".

## O que será feito

1. **Abrir o cadastro** para que qualquer pessoa da equipe possa criar a própria conta, com Google ou com e-mail e senha.
2. **Ativar o login com Google** de verdade (hoje ele está desligado do lado do sistema, por isso a recusa).
3. **Ativar o login por e-mail e senha** e deixar a conta já confirmada na hora, sem precisar clicar em link de e-mail.
4. **Adicionar a opção "Criar conta"** na página de login: uma aba/alternância entre "Entrar" e "Criar conta", com e-mail, senha e mensagens de erro claras (senha curta, e-mail já cadastrado, etc.).
5. Sua conta `rafaelmpcb.adv@gmail.com` entra normalmente pelo Google no primeiro acesso.

Depois de testar com a equipe, é possível fechar o cadastro de novo a qualquer momento — basta pedir.

## Detalhes técnicos

- `supabase--configure_auth` com `disable_signup: false`, `auto_confirm_email: true`, `external_anonymous_users_enabled: false`, `password_hibp_enabled: true`.
- `supabase--enable_email_auth` para habilitar e-mail/senha.
- `supabase--configure_social_auth` com `providers: ["google"]` (credenciais gerenciadas).
- `src/routes/auth.tsx`: estado `mode` ("signin" | "signup"), chamada a `supabase.auth.signUp` com `emailRedirectTo: window.location.origin`, tratamento de erros traduzidos, e redirecionamento para `/meus-calculos` após sessão ativa.
- Verificação com Playwright: criar conta de teste, entrar, checar acesso a `/meus-calculos` e ausência de erros de console.
