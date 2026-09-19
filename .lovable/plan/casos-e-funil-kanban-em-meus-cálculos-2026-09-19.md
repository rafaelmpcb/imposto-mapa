# Casos e funil Kanban em "Meus Cálculos"

O cálculo salvo deixa de ser o objeto principal. Passa a existir o **Caso** (o cliente/empresa), e cada cálculo vira um item do histórico daquele Caso.

Os dados atuais permitem a migração exatamente como pedido: todo cálculo salvo já guarda nome do cliente e CNPJ, então dá para agrupar por CNPJ e deixar os "Sem identificação" isolados.

## Modelo de dados

Nova tabela **casos**:
- nome do cliente / razão social (pode ficar vazio)
- CNPJ (opcional)
- etapa do funil (uma das 12, padrão "Lead")
- responsável (guardado, sem nenhuma regra em cima dele)
- data de criação e de atualização

Nova tabela **documentos do caso**: relação criada e vazia, sem nenhuma tela de envio nesta etapa.

Cada cálculo salvo ganha o vínculo com um Caso.

## Migração dos dados existentes

Roda junto com a criação das tabelas:
- Cálculos com o mesmo CNPJ → um único Caso, com todos eles no histórico. Nome do Caso = o nome mais recente entre eles.
- Cálculos sem CNPJ → cada um vira o seu próprio Caso.
- Todos os Casos migrados começam na etapa "Lead".

Nenhum cálculo é apagado ou alterado nos valores.

## As 12 etapas

**01 Captação** — Lead · Diagnóstico básico
**02 Diagnóstico** — Memorando assinado · Aguardando documentos · Diagnóstico Full · Em Revisão
**03 Comercial / Entrega** — Reunião agendada · Elaboração de Proposta · Proposta enviada · Contrato assinado · Relatório full Entregue · Acompanhamento e implantação

## Tela "Meus Cálculos"

Toggle **Lista / Kanban** no topo, ao lado da busca. A busca por nome continua igual e vale nas duas visões.

**Lista** — cada linha é um Caso: nome (ou "Sem identificação"), CNPJ quando houver, etapa atual e o resumo do cálculo mais recente (regime e valor de → para). Ao abrir o Caso, aparece o histórico completo de cálculos, cada um com as ações que já existem hoje: Reabrir, Renomear, Compartilhar, Gerar Memorando, Excluir. A seleção múltipla e a exclusão em lote passam a operar sobre os cálculos dentro do Caso aberto.

**Kanban** — 3 blocos empilhados, cada um com título numerado e contador de casos. Dentro de cada bloco, as colunas das etapas lado a lado com rolagem horizontal própria e contador em cada coluna. Cada card mostra nome (ou "Sem identificação"), CNPJ quando houver, resumo do cálculo mais recente e quantos cálculos há no histórico. Mover de etapa: seletor no card com as 12 etapas agrupadas pelos 3 blocos; a mudança salva na hora. Arrastar e soltar não entra agora — o seletor é o que fica.

Quando um cálculo novo é salvo no simulador, ele entra no Caso do mesmo CNPJ se já existir; senão cria um Caso novo.

## Fora desta etapa

Regras de responsável, prazo/SLA, envio de documentos, composição de carteira e checklist por etapa.

## Detalhes técnicos

- Migração cria `public.cases` e `public.case_documents`, adiciona `case_id` em `simulations` e faz o backfill agrupando por `cnpj` normalizado (fallback: um caso por cálculo). GRANTs + RLS para `authenticated`/`service_role`, sem acesso anônimo.
- Etapa do funil como enum `case_stage` com os 12 valores na ordem dada; blocos definidos em `src/lib/cases/stages.ts`.
- Novas server functions em `src/lib/cases.functions.ts` (`listCases`, `updateCaseStage`, `renameCase`), protegidas por `requireSupabaseAuth`, seguindo o padrão de `simulations.functions.ts`.
- `saveSimulation` passa a resolver/criar o Caso e gravar `case_id`.
- `meus-calculos.tsx` ganha o toggle de visão e um `CaseKanban.tsx`; as ações por cálculo são reaproveitadas dentro do detalhe do Caso, sem reescrita de lógica.
