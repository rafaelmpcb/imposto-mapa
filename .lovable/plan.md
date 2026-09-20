# Notas fiscais de compra em XML (fornecedores)

Hoje a "Composição de carteira" só aceita relatório em planilha. Vamos criar a via alternativa por notas fiscais de compra (XML de NF-e), para fornecedores, e melhorar a classificação de regime nas duas vias.

## 1. Nova opção de anexo: notas de compra em XML

Dentro do item "Composição de carteira", ao lado do envio de planilha, aparece "Notas fiscais de compra (XML de NF-e)".

- Aceita vários arquivos `.xml` de uma vez ou um `.zip` com as notas dentro.
- É via alternativa ao relatório agregado: o usuário escolhe, por Caso, qual usar. O caminho atual da planilha continua igual.

De cada nota é lido apenas o cabeçalho:

- CNPJ e razão social do emitente (o fornecedor)
- Valor total da nota
- Data de emissão
- Chave de acesso, número e série (para rastreabilidade)

Os itens da nota (produtos, NCM, CFOP) são ignorados. Nota sem CNPJ de emitente, arquivo que não é NF-e ou XML inválido entram numa lista separada, apenas informativa, e não interrompem o processamento das demais.

## 2. Agregação e classificação

- As notas são agrupadas por CNPJ do fornecedor, somando os valores e contando quantas notas.
- Cada CNPJ único é classificado como Simples Nacional ou Regime Regular.
- Fica registrado qual fonte classificou cada CNPJ e a data da nota mais recente usada na soma.
- CNPJ que nenhuma fonte conseguiu classificar fica marcado como erro, com botão "Tentar novamente" individual.
- O processamento é assíncrono e retomável, como já acontece hoje: dá para sair da tela e voltar.

## 3. Classificação mais rápida nas duas vias

A consulta de regime passa a usar duas fontes, tanto na via de XML quanto no fluxo atual de planilha:

- Fonte principal: BrasilAPI (sem limite fixo, processada em fila com concorrência moderada).
- Reserva automática, em caso de falha ou demora: CNPJá (respeitando 5 consultas por minuto).

Isso deve reduzir bastante o tempo de processamento das carteiras grandes que hoje ficam presas ao limite de 5 por minuto.

## 4. Tela de conferência antes de gravar

Uma linha por CNPJ de fornecedor, tudo editável: Nome, Valor, Regime, Quantidade de notas e Fonte da classificação.

- Se o CNPJ já existir na composição vinda da planilha, o sistema avisa e pergunta se substitui ou mantém — nunca soma sozinho.
- Notas sem CNPJ aproveitável aparecem numa lista separada, só para conferência.
- O botão "Confirmar e salvar" só fica disponível depois da conferência.

Ao confirmar, as linhas vão para a mesma composição de carteira já usada hoje, marcadas como fornecedor, com a origem "XML de NF-e (emitente)" e a fonte que classificou.

## Detalhes técnicos

- Migração: nova tabela `nota_fiscal_compra_xml` (`case_id`, `arquivo_original`, `chave_acesso`, `numero_nota`, `serie`, `cnpj_emitente`, `razao_social_emitente`, `valor_total`, `data_emissao`, `status_processamento` = ok / sem_cnpj_emitente / xml_invalido / nao_e_nfe, `aplicado_composicao_carteira`, timestamps), com RLS e grants no mesmo padrão das tabelas do Caso.
- `src/lib/nfe/parse.ts`: leitura client-side com `DOMParser`, `jszip` para `.zip`, extração só do cabeçalho (`emit/CNPJ`, `emit/xNome`, `total/ICMSTot/vNF`, `ide/dhEmi|dEmi`, `infNFe@Id`, `ide/nNF`, `ide/serie`) e agregação por CNPJ.
- `src/lib/nfe.functions.ts`: server functions autenticadas para gravar as notas lidas, listar, classificar em lote e aplicar à `composicao_carteira`.
- Classificação compartilhada em `src/lib/carteira/classify.server.ts`: BrasilAPI (`/api/cnpj/v1/:cnpj`, campo `opcao_pelo_simples`) com fila de concorrência 4, fallback CNPJá (`open.cnpja.com/office/:cnpj`) com espaçamento de 12s; usada por `processCarteiraBatch` e pelo novo fluxo. `fonte_classificacao` passa a registrar a fonte real.
- Novo componente `src/components/cases/NfeCompraPanel.tsx` seguindo o padrão visual de `PgdasdPanel`/`CarteiraResult`; integrado no item "Composição de carteira" de `DiagnosticoCompleto.tsx` sem alterar o fluxo de planilha.
- Testes do parser com XMLs sintéticos de NF-e.
