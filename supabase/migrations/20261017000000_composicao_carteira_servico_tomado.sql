-- Marca linhas de composicao_carteira que vieram da planilha dedicada de
-- "serviços tomados sem XML" (contas a pagar), usada na nova aba de
-- diagnóstico. Aditivo, sem efeito nas linhas existentes.
alter table public.composicao_carteira
  add column if not exists servico_tomado boolean not null default false;
