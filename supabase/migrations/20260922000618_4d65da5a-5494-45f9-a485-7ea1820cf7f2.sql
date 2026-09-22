ALTER TABLE public.nota_servico_nfse
  ADD COLUMN IF NOT EXISTS codigo_servico text,
  ADD COLUMN IF NOT EXISTS regime_prestador text,
  ADD COLUMN IF NOT EXISTS aplicado_composicao_carteira boolean NOT NULL DEFAULT false;