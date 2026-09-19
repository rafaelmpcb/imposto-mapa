# Corrigir o cenário do Simples em 2033

## Objetivo
Separar claramente a hipótese de saída do Simples da permanência no regime, sem apresentar como validado um valor de DAS para 2033.

## Alterações
- Manter o cálculo já existente de IBS/CBS + IRPJ + CSLL + CPP somente como hipótese de **saída do Simples para o regime regular** em 2033.
- Renomear essa hipótese nos cards “Sistema atual x Cenário 2033”, no resumo executivo, na visão gráfica, no modo apresentação e no PDF.
- Na “Comparação entre regimes”, representar “Permanecer no Simples em 2033” como indisponível para cálculo: sem valor, percentual, selo de melhor regime ou detalhamento tributário.
- Exibir junto dessa lacuna a nota solicitada sobre a nova tabela de partilha do DAS ainda não confirmada na base.
- Excluir o cenário indisponível da escolha automática de “mais vantajoso” e das comparações numéricas, preservando Lucro Presumido e Lucro Real.
- Ajustar avisos relacionados a clientes PJ para não depender de um valor inexistente do Simples em 2033.
- Atualizar os testes para garantir que o cálculo de saída continue auditável e que a permanência no Simples não receba número nem selo.

## Anos de transição
O simulador atualmente oferece somente 2026, 2027 e 2033. Portanto, não há cards de 2029–2032 para alterar; a regra ficará vinculada explicitamente a 2033, sem afetar 2026 e 2027.

## Validação
- Rodar os testes de cálculo e a verificação do projeto.
- Conferir no navegador o resultado de uma empresa do Simples em 2033, incluindo modo normal, modo apresentação, gráfico e comparação entre regimes.
- Confirmar no PDF a nomenclatura correta e a ausência de estimativa para permanência no Simples em 2033.
