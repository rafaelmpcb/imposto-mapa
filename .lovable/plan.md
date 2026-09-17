# Melhorias selecionadas para o simulador

Escopo aprovado: itens 2, 4, 5, 6, 7 e 8 da lista anterior.

## 1. Gestão do histórico em "Meus Cálculos" (item 2)

- Campo de busca no topo, filtrando por nome do cliente/empresa.
- Botão "Excluir" em cada cálculo, com confirmação antes de apagar.
- Edição do nome de identificação direto na lista, sem precisar reabrir o cálculo.
- Todas as ações passam pelo mesmo código de acesso do advogado.

## 2. Página de entrada explicativa + busca no Google (item 4)

- Nova página inicial explicando a Reforma: o que muda, cronograma 2026–2033, quem é afetado, e o que o simulador entrega.
- Botão de destaque levando ao simulador.
- Títulos e descrições otimizados para buscas como "calculadora reforma tributária" e "simulador IBS CBS".
- O simulador passa a viver em seu próprio endereço; quem já usa o link atual continua chegando ao lugar certo.

## 3. Gráfico visual antes/depois (item 5)

- Gráfico de barras no resultado comparando a carga atual com a projetada.
- Segunda visão com a evolução ao longo de 2026, 2027 e 2033, mostrando a transição.
- Visível também no Modo Apresentação, por ser resumo de alto nível.

## 4. Testes automatizados das fórmulas (item 6)

- Bateria de testes cobrindo: Pessoa Física (CLT), Simples por anexo, Lucro Presumido, Lucro Real, MEI.
- Testes das reduções de 30% (Art. 127) e 60% (Art. 125) e das regras de transição por ano.
- Testes da comparação entre regimes (inferência de anexo e margem padrão de 20%).
- Objetivo: mudanças futuras na legislação não quebram resultados em silêncio.

## 5. Painel de ajuste de alíquotas e constantes (item 7)

- Tela acessível pelo mesmo código de acesso do advogado, para editar as alíquotas de referência (IBS, CBS, percentuais de transição, reduções).
- Valores guardados na nuvem, com botão "Restaurar padrão".
- O simulador passa a usar esses valores; se nada for alterado, usa os padrões atuais.

## 6. Compartilhamento por link (item 8)

- Botão "Compartilhar" em um cálculo salvo, gerando um link somente-leitura.
- Quem abre o link vê o resultado (resumo, cards, diferença, comparação entre regimes) sem poder editar nem ver os outros cálculos.
- Avisos legais e o texto de estimativa aparecem na página compartilhada.
- Possibilidade de revogar o link depois.

## Detalhes técnicos

- Banco: novas colunas/tabelas para token público de compartilhamento (`share_token`, `share_enabled`) e uma tabela de configuração de alíquotas; nenhuma leitura direta por `anon` além do registro compartilhado com token válido.
- Leitura/escrita do histórico continua por server functions protegidas pelo código (`ADVOGADO_ACCESS_CODE`); acréscimo de `deleteSimulation`, `renameSimulation`, `toggleShare`, além de `getSharedSimulation` (pública, só por token).
- Constantes: `src/lib/tax/constants.ts` passa a ter um carregador que mescla overrides vindos do banco, mantendo os padrões como fallback.
- Gráficos com Recharts, já disponível no stack.
- Testes com Vitest em `src/lib/tax/__tests__/`.
- Rotas novas: `/` (landing), `/simulador`, `/config-aliquotas`, `/s/$token`; cada uma com `head()` próprio (título, descrição, OG).

## Ordem de execução

1. Testes das fórmulas (rede de segurança antes de mexer no resto)
2. Gestão do histórico
3. Gráfico antes/depois
4. Compartilhamento por link
5. Painel de alíquotas
6. Landing + SEO
