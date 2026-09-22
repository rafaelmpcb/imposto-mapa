# Painel da carga documental + filtro por CFOP

Duas adições independentes ao Diagnóstico Completo, sem mexer em nenhum cálculo existente.

## Parte A — Painel da carga documental

### Contagem de duplicados
Hoje, quando o mesmo arquivo é reenviado, a nota repetida é simplesmente ignorada e ninguém fica sabendo. Passa a ser registrada.

Como o banco impede gravar duas vezes a mesma chave de acesso no mesmo Caso, o registro do reenvio vai para um pequeno registro próprio de ocorrências (`case_documento_duplicado`: Caso, tipo de documento, chave, nome do arquivo, data). Efeito prático é o pedido: o reenvio não soma de novo no crédito/débito, não duplica linha na composição de carteira, e passa a aparecer contado como "Duplicado".

Entra nos quatro pontos de envio já existentes: NF-e de compra, NF-e de venda, NFS-e tomada e NFS-e prestada.

### Agregação
Nova visão `vw_painel_carga` por Caso e tipo de documento (NF-e compra, NF-e venda, NFS-e tomado, NFS-e prestado), com:
- Válidos (processados, entraram no cálculo)
- Não são notas (arquivo não reconhecido como documento fiscal)
- Ignorados (documento reconhecido, fora do escopo processado)
- Duplicados (reenvios detectados)
- Manuais (sempre zero por enquanto — não existe lançamento manual no sistema)
- Total recebido

Novo carregamento de dados para a tela, somando também o total geral do Caso.

### Tela
Novo painel "Painel da carga", posicionado antes dos painéis de resultado no Diagnóstico Completo:
- Resumo geral: total recebido, válidos, e quanto ficou fora em cada categoria (quantidade, % e valor quando disponível)
- Tabela por tipo de documento com as seis colunas acima
- Lista dos documentos que não entraram, com o motivo
- Aviso visual (não bloqueante) quando "não são notas + ignorados + duplicados" passar de 10% do total recebido, com o limiar ajustável na própria tela
- Nota explicando que "Manuais" fica zerado enquanto não existir lançamento manual

Nada é bloqueado: os demais painéis continuam acessíveis normalmente.

## Parte B — CFOP como filtro

- Nova referência estática pequena de CFOP → descrição (compras e vendas de mercadoria mais comuns). CFOP fora da lista aparece só com o código.
- Filtro de CFOP (seleção múltipla) no painel de crédito por NCM, no painel de débito por NCM e no painel de fornecedores/clientes críticos, populado com os CFOPs presentes nos itens do próprio Caso.
- O filtro só esconde/mostra linhas já calculadas — nenhum recálculo. Ao selecionar, aparece a legenda com a descrição do CFOP.
- Não se aplica a serviços (NFS-e não tem CFOP).

## Detalhes técnicos

- Migração: tabela `case_documento_duplicado` (com GRANTs e RLS no padrão do projeto), view `vw_painel_carga` unindo as três tabelas de documentos mais o registro de duplicados.
- As views de concentração ganham `cfop` como coluna de agrupamento; o painel já reagrupa no cliente, então os totais atuais não mudam.
- Servidor: `src/lib/carga.functions.ts` (leitura da view + lista de não processados); `saveNotasCompra`, `saveNotasVenda` e `saveNotasServico` passam a gravar as ocorrências de duplicado e a devolver a contagem.
- Cliente: `src/components/cases/PainelCargaPanel.tsx`, `src/lib/nfe/cfop.ts` (referência estática) e filtro de CFOP em `CreditoNcmPanel`, `DebitoNcmPanel` e `ConcentracaoPanel`.
- Verificação: reenviar o mesmo arquivo e confirmar que a segunda vez conta como duplicado sem alterar crédito/débito nem a composição de carteira.
