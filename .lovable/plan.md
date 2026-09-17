# Exclusão em lote em "Meus Cálculos"

## Objetivo
Permitir selecionar vários cálculos (ou todos) na aba "Meus Cálculos" e excluí-los de uma vez, mantendo o funcionamento atual da exclusão individual.

## O que muda

### 1. Seleção na interface (`src/routes/meus-calculos.tsx`)
- Cada card de cálculo ganha uma caixa de seleção (checkbox) ao lado do nome.
- Ações "Reabrir", "Renomear", "Compartilhar", "Gerar Memorando" e "Excluir" continuam exatamente como estão em cada card.
- Na barra acima da lista (onde estão o contador e "Atualizar"):
  - Checkbox "Selecionar todos" — marca/desmarca todos os cálculos filtrados pela busca atual.
  - Quando houver itens selecionados, aparece a barra de ação em lote: "Excluir selecionados (N)" com confirmação antes de apagar ("Confirmar exclusão" / "Cancelar"), no mesmo padrão da exclusão individual.
  - Contador mostra também "N selecionado(s)".
- A seleção é limpa quando a lista é recarregada ("Atualizar") ou após a exclusão em lote; itens removidos saem da seleção.
- Seleção segue o filtro da busca: "Selecionar todos" só afeta o que está visível no filtro.

### 2. Função de servidor para lote (`src/lib/simulations.functions.ts`)
- Nova `deleteSimulationsBulk` (POST), mesma validação de código de acesso (`ADVOGADO_ACCESS_CODE`), recebendo `{ code, ids: string[] }` e executando um único `DELETE ... in (ids)` via cliente administrador.
- A exclusão individual existente permanece intacta.

## Sem mudanças no banco de dados
Nenhuma migração, tabela ou política nova — apenas uma chamada de exclusão com vários IDs.

## Validação
- TypeScript e build limpos.
- Teste no navegador: selecionar individualmente, "Selecionar todos", excluir em lote com confirmação, verificar que os itens somem e que o restante permanece; conferir que a exclusão individual continua funcionando.
