# Parecer Padrão — a camada de entregável

Monta o documento final do escritório a partir de tudo que já foi calculado nas etapas anteriores. Nada é recalculado: o parecer apenas compila, deixa o analista editar por cima e exporta.

## O que o usuário vai ver

Dentro de um Caso, ao lado do Diagnóstico Completo, um novo botão **Parecer Padrão** abre uma tela com as 10 seções em sequência. Cada seção mostra o dado já compilado do Caso e um campo de texto do analista acima desse dado.

- **Gerar rascunho** cria uma versão com um retrato dos dados naquele momento. Versões antigas ficam guardadas como estão; para atualizar, gera-se uma nova versão.
- Antes de **Finalizar**, aparece a lista de verificação com 10 itens. Item não atendido vira aviso com atalho para a tela que resolve — avisa, não impede gerar rascunho.
- **Baixar PDF** gera o documento formatado com as edições do analista.
- **Apresentação guiada** percorre seção a seção, com os blocos de tempo sugeridos numa barra lateral opcional.

## Campos novos no Caso

Dois campos no cadastro: escopo (LIGHT, 1 a 2 meses / COMPLETO, ano fechado) e objetivo da simulação (texto curto). Editáveis na tela do Caso e usados na Seção 1.

## As 10 seções e de onde vem cada dado

| Seção | Origem |
|---|---|
| 1 Identificação e escopo | cadastro do Caso + escopo e objetivo novos + data de geração |
| 2 Base documental e premissas | painel de carga, itens pendentes/sem dado, despesas manuais, origem do ISS, parâmetros com data de alteração, exceções NCM/NBS usadas, limitações fixas |
| 3 Sumário executivo | até 3 achados sugeridos por regras simples (impacto → causa → decisão), sempre editáveis; sem dado, ficam em branco |
| 4 Compras | fornecedores críticos, cenários de compra, crédito apurado, riscos |
| 5 Vendas e precificação | preço necessário agregado, perfil de cliente, evolução por ano |
| 6 DRE e margem | projeção anual atual x projetada, com a ressalva já definida |
| 7 Fluxo de caixa e split | fluxo mensal + os 4 passos do split, sempre com crédito e efeito líquido |
| 8 Regimes tributários | comparativo de regimes e elegibilidade; recomendação é campo obrigatório do analista |
| 9 Plano de ação | 8 áreas fixas com pergunta-guia e ação/responsável/prazo/prioridade/indicador |
| 10 Conclusão e ressalvas | referência às limitações da Seção 2 + síntese do analista + data da próxima revisão |

Seção sem dado no Caso aparece como lacuna documentada, não como erro. Caso sem cálculo salvo (Etapa 1) não gera parecer: mostra a mensagem de pré-requisito.

## Detalhes técnicos

- Migração: colunas `escopo` (enum) e `objetivo` em `cases`; tabela `parecer_padrao` (`case_id`, `versao`, `status`, `dados_compilados_json`, `edicoes_analista_json`, `gerado_em`, `gerado_por`, `finalizado_em`) com GRANTs, RLS e política para usuários autenticados.
- `src/lib/parecer/tipos.ts` — formato do snapshot e das edições por seção.
- `src/lib/parecer/compilar.ts` — módulo puro: recebe as leituras das tabelas de origem e devolve o snapshot das 10 seções, os achados sugeridos e o resultado do checklist. Coberto por testes.
- `src/lib/parecer.functions.ts` — funções protegidas: gerar versão (lê as origens e grava o snapshot), listar versões, salvar edições, finalizar.
- `src/lib/pdf/parecer.server.ts` — PDF A4 no mesmo padrão do relatório atual (cabeçalho, rodapé, paginação, blocos que não quebram), servido por `src/routes/api/public/parecer-pdf.ts` com verificação do token do usuário.
- UI: `ParecerPadraoPanel.tsx` (edição + checklist + versões) e `ParecerApresentacao.tsx` (navegação guiada), abertos pelo Caso em `meus-calculos`.
- Nenhum painel, cálculo ou tabela existente é alterado; só leitura.
