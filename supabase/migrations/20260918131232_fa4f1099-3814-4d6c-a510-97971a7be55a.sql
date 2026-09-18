CREATE TABLE public.tax_parameters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  param_key text NOT NULL,
  value numeric NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT '',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX tax_parameters_key_idx ON public.tax_parameters (param_key, effective_from DESC, created_at DESC);

GRANT SELECT ON public.tax_parameters TO anon;
GRANT SELECT, INSERT ON public.tax_parameters TO authenticated;
GRANT ALL ON public.tax_parameters TO service_role;

ALTER TABLE public.tax_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tax parameters are publicly readable"
  ON public.tax_parameters FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Team members can add parameter versions"
  ON public.tax_parameters FOR INSERT
  TO authenticated
  WITH CHECK (true);