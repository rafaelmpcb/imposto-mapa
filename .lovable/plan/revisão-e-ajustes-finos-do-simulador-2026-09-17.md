# Revisão e ajustes finos do simulador

Concluir a validação pendente das últimas entregas (tabela "Como a reforma muda" e botão "Baixar PDF") e corrigir os problemas conhecidos encontrados durante a implementação.

## 1. Validação no navegador — tabela de alíquotas

As duas tentativas anteriores de chegar à Etapa 5 falharam por seletores errados e campos não preenchidos. Novo script:

- Preencher o formulário corretamente (seleção de regime via `<select>`, valores de faturamento etc.) até chegar ao resultado.
- Confirmar que a seção "Como a reforma muda" aparece, com as colunas 2026/2027/2033.
- Clicar em uma célula de percentual, editar o valor inline e confirmar que os cards do resultado recalculam.
- Testar "Restaurar valores salvos".
- Capturar screenshots como evidência.

## 2. Validação no navegador — botão "Baixar PDF"

- Na Etapa 5, clicar em "Baixar PDF" e confirmar que o download acontece com o nome `relatorio-reforma-tributaria-[cliente-ou-data].pdf`.
- Abrir o PDF gerado e verificar visualmente o layout (tabelas lado a lado, sem texto cortado).

## 3. Correções no PDF (src/lib/pdf/report.server.ts)

- Nome do arquivo no servidor: o endpoint `/api/public/relatorio-pdf` hoje responde sempre com `relatorio-reforma-tributaria.pdf` fixo; passar a montar o `Content-Disposition` com o nome do cliente (ou a data), igual ao navegador.
- `dualRow` desenha apenas a primeira linha do rótulo: ajustar para quebrar rótulos longos em até 2 linhas ou truncar com reticências, sem sobrepor o valor.
- `box()` não quebra texto longo: aplicar o mesmo `wrap` já existente no restante do documento.
- Regenerar PDFs de exemplo (empresa e Pessoa Física) e revisar página por página em imagem antes de considerar pronto.

## 4. Ajuste do recálculo da tabela (src/components/simulator/ResultView.tsx)

- O contador `ratesVersion` com `void ratesVersion` é um truque frágil: substituir por uma abordagem idiomática (ex.: `key` no `<RateMatrix />` ou `useMemo` dependente da versão) mantendo o recálculo imediato ao editar valores.

## 5. Revalidação final

- Rodar testes existentes (`bunx vitest run`) e typecheck.
- Repetir o fluxo no navegador de ponta a ponta: preencher → resultado → editar alíquota → baixar PDF → conferir arquivo.
- Atualizar o roadmap removendo o item pendente da tabela de alíquotas.

Sem mudanças de escopo: nada de diagnóstico real, CTA externo ou novas seções nesta rodada.
