# Contato real do escritório + login de verdade

Duas melhorias no sistema (fora do cálculo): um caminho real de contato para o cliente e um login próprio para a equipe interna, no lugar do código único de acesso.

## 1. Contato real do escritório

**Onde cadastrar:** na seção "Dados do escritório" (painel protegido) entram quatro campos novos e opcionais:
- WhatsApp (só números, com DDD)
- E-mail de contato
- Telefone fixo
- Site

**Onde aparece para o cliente:**
- **Tela de resultado (Etapa 5), seção "Próximo passo":** ao lado de "Baixar PDF" e "Gerar Memorando", botões "Falar no WhatsApp" e "Enviar e-mail". O WhatsApp já abre com mensagem pronta, algo como: *"Olá, fiz a simulação do impacto da Reforma Tributária e gostaria de conversar sobre o diagnóstico completo."* Quando o cálculo tem nome do cliente e link de compartilhamento ativo, a mensagem inclui o nome e o link.
- **Página inicial:** rodapé com os contatos cadastrados.
- **Link somente leitura (`/s/token`):** mesmos botões de contato, para quem recebe o resultado por fora.
- **Relatório em PDF:** linha de contato no rodapé/seção final.

Se nenhum contato estiver cadastrado, nada disso aparece — a tela fica exatamente como hoje.

**Envio em 1 clique (do lado do escritório):** em "Meus Cálculos", cada cálculo compartilhado ganha "Enviar por WhatsApp", que abre o WhatsApp com a mensagem e o link somente leitura prontos.

## 2. Login real para a equipe interna

Hoje o acesso ao histórico e às configurações usa um código único digitado na tela. Isso vira login com conta individual:

- **E-mail e senha + botão "Entrar com Google"**, numa página de login nova.
- **Cadastro fechado:** ninguém cria conta sozinho. As contas da equipe são criadas por você; o autocadastro fica desativado.
- **Áreas protegidas:** "Meus Cálculos", configuração de alíquotas e dados do escritório passam a exigir login. O simulador, a página inicial e o link somente leitura continuam públicos, sem login.
- **Cabeçalho mostra quem está logado**, com opção de sair.
- **Cada registro passa a guardar quem criou**, para no futuro saber qual membro da equipe atendeu cada cliente (a lista continua visível para toda a equipe).
- O código antigo deixa de ser usado; a tela de "digite o código" é substituída pela de login.

Na primeira vez, você entra com Google (ou eu crio sua conta de e-mail/senha) e a partir daí adiciona os demais membros da equipe.

## Detalhes técnicos

- Novas chaves em `office_config`: `whatsapp`, `email_contato`, `telefone`, `site`; leitura pública via server fn sem código, escrita protegida.
- Auth: Lovable Cloud (email/senha + Google), `disable_signup: true`. Rotas protegidas movidas para `src/routes/_authenticated/` (`meus-calculos`, `config-aliquotas`), com gate gerenciado e `attachSupabaseAuth` em `src/start.ts`.
- Server fns em `simulations.functions.ts`, `tax-config.functions.ts` e `office-config.functions.ts`: `checkCode` substituído por `.middleware([requireSupabaseAuth])`; parâmetro `code` removido das chamadas.
- Migração: coluna `created_by uuid` em `simulations`; RLS revisada — leitura/escrita para `authenticated`, leitura pública somente das linhas com `share_enabled`.
- Contato no PDF: novo bloco em `src/lib/pdf/report.server.ts` lendo `office_config`.
- Links WhatsApp via `https://wa.me/<numero>?text=<mensagem>` com texto codificado.
