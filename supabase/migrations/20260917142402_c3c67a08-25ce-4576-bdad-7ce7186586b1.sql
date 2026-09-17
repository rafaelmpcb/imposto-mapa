ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS cnpj_data jsonb;

CREATE TABLE IF NOT EXISTS public.office_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.office_config TO service_role;
ALTER TABLE public.office_config ENABLE ROW LEVEL SECURITY;