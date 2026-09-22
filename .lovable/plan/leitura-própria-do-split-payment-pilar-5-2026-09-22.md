# Leitura própria do Split Payment (Pilar 5)

## Objetivo
Adicionar ao Diagnóstico Completo uma leitura financeira guiada do split payment, usando somente os valores já calculados no fluxo de caixa mensal e na DRE anual.

## Implementação
- Criar uma função protegida que leia, por Caso, os meses persistidos em `fluxo_caixa_projecao_mensal` e o resultado projetado anual em `dre_projecao_anual`.
- Expor os períodos disponíveis por mês/ano e, para o período selecionado, compor os quatro números existentes: vendas brutas, débito retido, crédito disponível e débito líquido recolhido, além do resultado líquido anual da DRE.
- Criar a seção **“Split payment — como funciona neste Caso”** com seletor de período e narrativa sequencial em quatro passos.
- Manter retenção e crédito sempre juntos na leitura; destacar o quarto passo, com “saída efetiva pelo split” e “resultado líquido do ano” claramente separados.
- Exibir permanentemente o aviso contra a meia-leitura da retenção isolada.
- Adicionar um atalho para a seção completa de fluxo de caixa e um alvo navegável no painel existente.
- Inserir a nova seção no Diagnóstico Completo após a DRE e antes do fluxo mensal completo.

## Regras preservadas
- Não alterar fórmulas, apuração líquida, crédito/débito, DRE ou projeção de fluxo.
- Não criar tabelas nem recalcular a mecânica jurídica do split payment.
- Tratar a leitura como estimativa financeira/gerencial, sujeita à regulamentação infralegal.

## Verificação
- Testar seleção de períodos, correspondência dos quatro valores e navegação até o fluxo completo.
- Validar estados sem dados e visualização em telas largas e estreitas.
- Rodar testes focados e conferir a compilação do projeto.
