# Módulo de Gestão de Contratos e Reequilíbrio Econômico

Calculadora própria para contratos de prestação continuada (serviços prestados ou tomados), independente do simulador de impacto, mas capaz de herdar dados de um Caso quando existirem.

## Etapa 1 — Calculadora pública `/contratos`

Tela zerada, como as demais calculadoras, com botão "Início" e aba no mesmo conjunto das outras ferramentas.

Entradas:
- Título do contrato e contraparte
- Papel: prestador ou contratante
- Regime do prestador: Lucro Real, Presumido, Simples Nacional
- Perfil do contratante: regime regular (toma crédito), Simples ou consumidor final
- Preço mensal atual do contrato e prazo/vigência
- Margem ou custo direto estimado do prestador
- Alíquota plena de referência (26,5% editável) e eventual redução setorial
- Ano de referência na transição (2026–2033)

Três cenários de negociação apresentados lado a lado:
- A — Preservar a margem líquida do prestador
- B — Preservar o custo líquido do contratante (considerando o crédito de IBS/CBS)
- C — Ponto de equilíbrio entre A e B (divisão do impacto)

Saídas:
- Preço sugerido em cada cenário e variação percentual
- Quanto do aumento é absorvido por crédito do contratante
- Evolução ano a ano até 2033 (gráfico + tabela)
- Semáforo de risco do contrato (impacto baixo/médio/alto)
- Minuta de cláusula de revisão e texto de notificação

## Etapa 2 — Carteira de contratos no painel de gestão

Ativar a aba "Gestão de contratos" (hoje "Em breve"):
- Lista dos contratos salvos por Caso, com preço atual, cenário escolhido, variação e status (a revisar, em negociação, aditivo assinado, encerrado)
- Semáforo de risco e totais da carteira
- Ações: abrir, recalcular, excluir

## Etapa 3 — Integração

- Vincular contrato a um Caso (opcional, só para usuário autenticado)
- Alimentar o Parecer Padrão e o PDF com a seção de contratos
- Reaproveitar a ficha de negociação com IA já existente, agora também para contratos

## Detalhes técnicos

- Motor puro em `src/lib/contratos/calculo.ts` com testes Vitest, no mesmo padrão de `aluguel/` e `capex/`
- Tabela `public.contrato_reequilibrio` (case_id opcional, parâmetros, `resultado_json`, status), com GRANTs e RLS
- Funções server-side em `src/lib/contratos.functions.ts` (salvar, listar, excluir, atualizar status)
- Rota `src/routes/contratos.tsx` pública; painel `src/components/hub/ContratosHubPanel.tsx` no Hub
- Adicionar a aba em `SimuladorTabs.tsx`, marcar o card como disponível na tela inicial e ativar a aba no `HubTabs.tsx`
- Nenhuma alteração nos cálculos existentes do simulador, locação, CAPEX ou saldos credores

## Escopo excluído

Gestão documental de contratos (CLM), assinatura eletrônica, controle de vencimentos e leitura automática de PDFs de contrato.
