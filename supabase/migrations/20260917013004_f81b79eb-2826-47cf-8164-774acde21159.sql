ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tax_config (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.tax_config TO service_role;
ALTER TABLE public.tax_config ENABLE ROW LEVEL SECURITY;