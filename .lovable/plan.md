# Perfil identificado no relatório

## Objetivo
Adicionar um bloco informativo “Perfil identificado” no início do resultado em tela e do PDF, antes dos números e gráficos.

## Implementação
- Criar uma única função compartilhada que monte o texto usando apenas os dados de CNPJ já salvos, a atividade atualmente selecionada e o enquadramento já retornado pelo cálculo.
- Exibir o bloco somente quando razão social, CNPJ, código CNAE e descrição CNAE estiverem completos; buscas puladas, falhas ou dados incompletos não mostrarão nada.
- Manter a narrativa no nível do setor, indicando o regime informado e, conforme o resultado existente, a aplicação, perda ou inexistência de redução de alíquota.
- Passar os dados completos do CNPJ ao gerador de PDF e às visualizações somente leitura, garantindo o mesmo texto literal em todas as versões.

## Validação
- Verificar tela e PDF com CNPJ completo.
- Verificar que o bloco desaparece no preenchimento manual e com CNAE incompleto.
- Confirmar que trocar manualmente a atividade altera o texto e que nenhum cálculo foi modificado.
