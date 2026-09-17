# Revisão do painel de alíquotas

O painel de alíquotas já existe no projeto em duas formas. Este plano é de verificação e polimento, sem mudança de escopo.

## O que já existe (sem alteração)

- Rota `/config-aliquotas`: painel protegido pelo código do advogado que edita as alíquotas padrão salvas na tabela `tax_config` do banco. Os valores valem globalmente para novas simulações.
- Seção "Como a reforma muda" na Etapa 5: tabela de alíquotas por regime e ano (2026/2027/2033), com edição inline que recalcula a simulação na hora, botão de restaurar padrões e opção de salvar como novo padrão global (protegida pelo código).

## O que este plano faz

1. Validar no preview o fluxo completo do painel `/config-aliquotas`: acesso com código, edição, salvamento e efeito em uma nova simulação.
2. Revisar os valores padrão de referência (IBS, CBS, ISS, PIS/COFINS e reduções por atividade) e listar qualquer valor que mereça sua confirmação.
3. Pequenos polimentos de uso, se a validação confirmar necessidade:
   - Exibir no painel a data da última alteração de cada alíquota.
   - Link discreto para `/config-aliquotas` a partir de "Meus Cálculos".

## Fora de escopo

- Alíquotas por atividade/município, histórico de alterações, autenticação mais forte.
