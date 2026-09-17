# Melhorias sugeridas para o simulador

Conheço o sistema: simulador de impacto da Reforma Tributária (IBS/CBS) usado como ferramenta de captação pelo escritório, com wizard de 5 etapas, cálculo por regime (PF, Simples, Presumido, Real, MEI), comparação entre regimes, Modo Apresentação, histórico salvo na nuvem ("Meus Cálculos") protegido por código de acesso.

Abaixo, as melhorias que considero mais valiosas, em ordem de prioridade. Aprovar este plano não obriga fazer tudo — você pode me dizer quais itens quer e eu implemento só eles.

## Prioridade alta (valor imediato para o escritório)

1. **Exportar/imprimir o resultado em PDF**
   Hoje o resultado só existe na tela. Um botão "Gerar PDF" (ou versão de impressão bem formatada) permitiria ao advogado entregar um relatório com o nome do cliente, data, estimativas e os avisos legais — reforça o caráter profissional e gera um artefato que o cliente leva da reunião.

2. **Gestão do histórico em "Meus Cálculos"**
   Hoje a lista só cresce. Adicionar: excluir um cálculo, editar o nome/identificação depois de salvo, e busca/filtro por nome do cliente. Evita que testes e simulações antigas poluam a lista.

3. **Link do CTA "Avançar para o diagnóstico completo"**
   O botão ainda é um placeholder sem destino. Assim que você me passar o link real (WhatsApp, agenda, formulário), conecto em minutos — é o principal ponto de conversão da ferramenta.

## Prioridade média (crescimento e confiabilidade)

4. **SEO + página de entrada explicativa**
   Como lead magnet, a ferramenta precisa ser encontrada. Criar uma página inicial com texto sobre a Reforma (o que muda, cronograma 2026–2033) que conduz ao simulador, com título/descrição otimizados para buscas como "calculadora reforma tributária".

5. **Gráfico visual antes/depois**
   Um gráfico de barras simples (carga atual × pós-reforma, ou evolução 2026/2027/2033) torna o resultado mais impactante em reunião do que números soltos.

6. **Testes automatizados das fórmulas**
   O coração do produto é o cálculo. Adicionar testes unitários das alíquotas, reduções (Art. 125/127) e transição por ano, para que futuras alterações na legislação não quebrem resultados silenciosamente.

## Prioridade baixa (refinos)

7. **Painel simples para ajustar alíquotas e constantes**
   Hoje as alíquotas de referência do IBS/CBS estão no código. Um pequeno painel (ou arquivo editável) permitiria atualizar os percentuais conforme a regulamentação evoluir, sem precisar me chamar.

8. **Compartilhamento por link**
   Gerar um link somente-leitura de uma simulação salva, para o advogado enviar ao cliente antes/depois da reunião (com aviso de estimativa).

9. **Fortalecer o acesso ao histórico**
   O código de acesso funciona, mas é compartilhado e fixo. Se o escritório crescer, dá para evoluir para login individual por advogado (cada um vendo só seus cálculos).

## O que eu NÃO faria (respeitando suas decisões anteriores)

- Não adicionaria captura de e-mail/formulário de lead — você deixou claro que não é uma lista de follow-up comercial.
- Não adicionaria login completo para os clientes — o código simples atende ao uso atual.

Me diga quais itens quer implementar (ex.: "1, 2 e 3") e eu executo.
