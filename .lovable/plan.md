# DRE e fluxo de caixa ano a ano (Pilares 3 e 4)

Duas telas novas dentro do Diagnóstico Completo do Caso: uma de resultado econômico (DRE, 2026–2033, atual x projetado) e outra de disponibilidade financeira (fluxo de caixa mensal). Ambas só compõem dados que já existem — nenhum cálculo de crédito, débito, preço necessário ou apuração líquida é alterado.

## Pontos onde o sistema não tem o dado pedido (precisa da sua decisão/entrada)

1. **IRPJ + CSLL ano a ano.** O motor de regime de hoje calcula IRPJ e CSLL para os anos-marco da simulação (2026, 2027 e 2033), a partir dos dados informados na simulação salva do Caso — não existe uma série separada para cada ano de 2026 a 2033. Proposta: usar o valor do ano-marco mais próximo já calculado e marcar na tela, em cada ano interpolado, que o valor foi repetido do marco anterior. Se o Caso não tiver simulação salva, as linhas de IRPJ/CSLL e resultado líquido aparecem vazias, com aviso de que falta a simulação.
2. **Despesas operacionais.** Não há nenhuma fonte documental no sistema. Será criado um campo editável por Caso, um valor por ano, na própria tela da DRE (padrão: em branco). Quando o Caso tiver folha de pagamento informada na simulação, a tela sugere esse valor anualizado como ponto de partida, sempre editável.
3. **Custo pós-crédito ano a ano.** O custo com crédito de IBS/CBS hoje é apurado item a item, mas não fica gravado como uma série anual. A DRE recompõe essa série na hora: custo dos itens de compra menos o crédito apurado, multiplicado pela fração do cronograma de transição de cada ano — a mesma curva já usada no preço necessário.

## Parte A — DRE ano a ano

Nova tabela `dre_projecao_anual` (por Caso, ano e cenário "atual"/"projetado") com receita bruta, deduções, receita líquida, custo, lucro bruto, despesas operacionais, resultado antes de IR/CS, IR/CS e resultado líquido.

Nova tabela `despesa_operacional_anual` (Caso, ano, valor) para a entrada manual.

Origem de cada linha:

| Linha | Atual | Projetado |
| --- | --- | --- |
| Receita bruta | valor dos itens de venda (mercadoria + serviço prestado) | soma do valor desonerado dos mesmos itens (base sem tributo por dentro) |
| Deduções | tributos atuais já extraídos item a item (ICMS/IPI/PIS/COFINS/ISS) | débito de IBS/CBS apurado item a item × fração do ano |
| Custo | valor dos itens de compra | custo menos crédito de IBS/CBS × fração do ano |
| Despesas operacionais | valor informado no Caso | mesmo valor |
| IR/CS | motor de regime, cenário atual | motor de regime, cenário reforma |

Notas fixas na tela: mudança de base da receita projetada (a CBS não compõe a receita bruta) e a ressalva de que aumento de IRPJ/CSLL pode decorrer de melhora do lucro operacional, não de piora.

## Parte B — Fluxo de caixa mensal

Nova tabela `parametro_fluxo_caixa` por Caso: prazo médio de recebimento (30), prazo médio de pagamento a fornecedores (30) e periodicidade de compensação do crédito (30) — todos editáveis na tela, marcados como estimativas sujeitas à regulamentação do split payment.

Nova tabela `fluxo_caixa_projecao_mensal`: Caso, ano, mês, entradas de clientes, saídas para fornecedores, saídas de despesas, débito retido, crédito disponível, débito líquido recolhido, saldo credor acumulado e variação de caixa.

Cálculo: os totais anuais da DRE projetada são distribuídos igualmente pelos 12 meses (sem sazonalidade, sinalizado na tela); entradas e saídas são deslocadas pelos prazos configurados; o débito retido na venda entra como linha informativa (split payment, nunca chega a entrar no caixa); o crédito fica disponível após a periodicidade configurada e abate o débito do mês, e o excedente acumula como saldo credor.

Painel: gráfico de variação de caixa mês a mês com o saldo credor sobreposto, alerta não bloqueante quando a variação for negativa em dois ou mais meses seguidos, parâmetros editáveis na mesma tela e rodapé lembrando que é projeção simplificada.

## Detalhes técnicos

- Migração com as quatro tabelas, GRANT e RLS no mesmo padrão das demais tabelas do Caso.
- `src/lib/dre/calculo.ts` (puro, com testes) monta a série anual; `src/lib/fluxo/projecao.ts` (puro, com testes) monta a série mensal com defasagens e saldo credor.
- `src/lib/dre.functions.ts` e `src/lib/fluxo-caixa.functions.ts`: leitura dos itens já gravados, cálculo, gravação e devolução das séries; IR/CS obtido reexecutando o motor de regime existente (`src/lib/tax/calc.ts`) sobre a simulação salva do Caso, sem redefinir fórmulas.
- `DrePanel.tsx` e `FluxoCaixaPanel.tsx`, inseridos no Diagnóstico Completo depois do preço necessário; recharts já usado no projeto para o gráfico.
- Itens pendentes de revisão continuam fora das somas, igual à apuração líquida.
- Verificação: testes das funções puras, conferência de que a apuração líquida e os painéis existentes continuam com os mesmos números, e execução das duas telas no Caso de teste.
