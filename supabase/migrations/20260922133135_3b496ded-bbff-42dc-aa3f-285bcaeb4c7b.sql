ALTER TABLE public.parecer_padrao
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS parecer_padrao_share_token_key ON public.parecer_padrao (share_token) WHERE share_token IS NOT NULL;