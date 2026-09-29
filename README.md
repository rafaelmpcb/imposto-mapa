# Remix of Reforma Fácil

Quero construir um simulador web de impacto da Reforma Tributária brasileira (IBS/CBS) para uso de um escritório de advocacia tributária como ferramenta de captação de clientes (lead magnet). É uma calculadora ESTIMATIVA — não substitui um diagnóstico fiscal completo.

CONTEXTO DO PRODUTO

O usuário (dono de empresa ou profissional liberal) preenche dados básicos sobre seu regime tributário e recebe uma comparação simplificada entre a carga tributária atual e a carga projetada com a Reforma, terminando em um relatório resumido que convida a agendar uma conversa com o escritório para um diagnóstico completo.

FLUXO DE TELAS (wizard de 5 etapas, com barra de progresso no topo)

Etapa 1 — Perfil tributário

- Tipo de contribuinte (select): Pessoa Física (CLT) / Empresa — Simples Nacional / Empresa — Lucro Presumido / Empresa — Lucro Real / MEI

- Atividade (select/autocomplete): Serviços advocatícios, Serviços de saúde, Serviços de educação, Comércio varejista, Indústria, Serviços de tecnologia, Serviços em geral — outros

- Estado (select): as 27 UFs

Etapa 2 — Dados financeiros

- Pessoa Física: salário bruto mensal (R$), número de dependentes

- Simples Nacional: faturamento bruto mensal (R$), Anexo do Simples (I a V, select)

- Lucro Presumido/Real: faturamento bruto mensal (R$), folha de pagamento mensal (R$); se Lucro Real, adicionar margem de lucro estimada (%)

- MEI: faturamento bruto mensal (R$)

Etapa 3 — Validação do benefício fiscal (só aparece se a atividade tiver benefício associado)

- Mensagem: "Identificamos que sua atividade pode ter direito a uma redução de alíquota. Para confirmar, responda:"

- Pergunta (só para profissões regulamentadas): "Todos os sócios da empresa possuem registro no conselho profissional da atividade e nenhum sócio é pessoa jurídica?" (Sim/Não) — se "Não", o benefício não é aplicado e isso é sinalizado no resultado

Etapa 4 — Ajustes opcionais (seção colapsável, fechada por padrão, com texto "Isso é opcional — sem preencher, ainda calculamos uma estimativa")

- % da receita vindo de produtos monofásicos (PIS/COFINS já recolhido na cadeia)

- Valor de compras/insumos do mês (para cálculo de créditos de IBS/CBS)

Etapa 5 — Resultado

- Seletor de ano de referência: "2026 — impacto real agora" / "2027 — primeira mudança relevante" / "2033 — regime pleno (projeção de longo prazo)"

- Cards lado a lado: "Sistema Atual" (vermelho) vs "Reforma Tributária" (verde), com os principais tributos listados e o total

- Texto de resumo executivo: "Com base nos dados informados, sua carga tributária projetada muda de X% para Y% no ano selecionado"

- Bloco "O que esta estimativa considera / não considera" (lista curta)


REGRAS DE CÁLCULO (implementar no frontend por enquanto, sem backend)

Use a alíquota de referência cheia de 26,5% (CBS + IBS combinados) como constante configurável (documentar no código que é um valor sujeito a alteração pelo Senado).

Tabela de benefício por atividade (redução sobre a alíquota cheia de 26,5%):

- Serviços advocatícios, contabilidade, engenharia, medicina, arquitetura (profissões regulamentadas): redução de 30% -> alíquota efetiva 18,55%

- Serviços de saúde, educação, transporte público, insumos agropecuários, produção cultural: redução de 60% -> alíquota efetiva 10,60%

- Demais atividades: sem redução -> 26,5%

Pessoa Física (CLT):

- INSS: mantém igual antes e depois (não muda com a reforma)

- IRPF antes: tabela progressiva atual do IRPF com dedução por dependente de R$189,59/mês, usando o menor valor de imposto entre deduções legais e desconto simplificado

- IRPF depois: isenção total até R$5.000 de salário bruto; entre R$5.000,01 e R$7.350, redução parcial gradual (interpolação linear simples como aproximação); acima de R$7.350, tabela normal

Simples Nacional:

- Antes: tabela de alíquotas efetivas do Simples Nacional por Anexo e faixa de faturamento anual (Anexos I a V)

- Depois: alíquota efetiva da atividade (tabela de benefício acima) sobre o faturamento, descontando a parte de produtos monofásicos informada na Etapa 4

Lucro Presumido:

- Antes: PIS (0,65%) + COFINS (3%) + ICMS ou ISS (alíquota do estado selecionado, tabela abaixo, ou 5% fixo para ISS de serviços) + IRPJ (15% sobre base presumida de 32% para serviços ou 8% para comércio/indústria, mais adicional de 10% sobre o que exceder R$20.000/mês de base presumida) + CSLL (9% sobre base de 32% ou 12%) + CPP (20% sobre a folha informada)

- Depois: alíquota efetiva da atividade sobre o faturamento (substitui PIS+COFINS+ICMS/ISS), subtraindo créditos proporcionais ao valor de compras informado na Etapa 4; IRPJ, CSLL e CPP continuam como no "antes"

Lucro Real:

- Antes: PIS (1,65%) + COFINS (7,6%) não cumulativos (com crédito proporcional às compras informadas) + ICMS/ISS (mesma lógica do Presumido) + IRPJ e CSLL sobre lucro real (faturamento x margem de lucro informada, mesma alíquota e adicional do Presumido) + CPP sobre folha

- Depois: mesma lógica de substituição do Presumido, com créditos não cumulativos completos

MEI:

- Antes e depois: valor fixo de DAS por atividade (Comércio: R$70,60; Serviços: R$75,60; Comércio e Serviços: R$76,60 — valores de referência 2026, deixar como constante configurável)

Tabela de ICMS por UF (alíquota interna padrão, usar no cálculo do "antes" para Presumido/Real):

AC 19,0 | AL 21,5 | AP 18,0 | AM 20,0 | BA 20,5 | CE 20,0 | DF 20,0 | ES 17,0 | GO 19,0 | MA 23,0 | MT 17,0 | MS 17,0 | MG 18,0 | PA 19,0 | PB 20,0 | PR 19,5 | PE 20,5 | PI 22,5 | RJ 22,0 | RN 20,0 | RS 17,0 | RO 19,5 | RR 20,0 | SC 17,0 | SP 18,0 | SE 20,0 | TO 20,0

DESIGN

- Estilo sóbrio e profissional (tons de azul-marinho e cinza, tipografia limpa), pensado para público empresarial/jurídico — nada de visual "gamificado"

- Totalmente responsivo (mobile-first, já que parte do tráfego vem de link compartilhado no WhatsApp)

- Barra de progresso visível no topo do wizard

- Card de resultado com contraste claro entre "antes" (vermelho/laranja) e "depois" (verde)

AVISOS LEGAIS (exibir de forma visível, não só no rodapé)

- Na tela de resultado: "Esta é uma estimativa baseada nos dados informados e na legislação vigente da Reforma Tributária (LC 214/2025) em [data]. Não substitui uma análise fiscal completa nem constitui aconselhamento jurídico ou tributário."

- Junto ao seletor de ano: "Os valores de 2027 em diante são projeções baseadas no cronograma legal atual, que ainda pode ser ajustado por regulamentação complementar."

Por enquanto, não precisa persistir dados em banco — pode guardar o resultado em memória/local storage. Podemos adicionar Supabase depois para salvar leads.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://imposto-mapa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/948a8240-2127-43bc-b8c2-39abc0133663).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
