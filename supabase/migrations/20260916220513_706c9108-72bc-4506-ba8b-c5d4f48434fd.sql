CREATE TABLE public.simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  client_name TEXT,
  taxpayer_type TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  uf TEXT NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  year_id INTEGER NOT NULL,
  current_total NUMERIC NOT NULL DEFAULT 0,
  reform_total NUMERIC NOT NULL DEFAULT 0,
  current_rate NUMERIC NOT NULL DEFAULT 0,
  reform_rate NUMERIC NOT NULL DEFAULT 0,
  input JSONB NOT NULL
);

CREATE INDEX simulations_created_at_idx ON public.simulations (created_at DESC);

GRANT INSERT ON public.simulations TO anon;
GRANT INSERT ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a simulation"
  ON public.simulations FOR INSERT TO anon, authenticated
  WITH CHECK (true);