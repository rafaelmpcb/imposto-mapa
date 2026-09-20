CREATE TABLE public.pgdasd_extraido (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  arquivo_original text NOT NULL DEFAULT '',
  competencia text,
  cnpj_extraido text,
  razao_social_extraida text,
  rbt12 numeric,
  receita_bruta_pa numeric,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  folha_12_meses numeric,
  valor_total_das numeric,
  detalhamento_tributos jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_extracao text NOT NULL DEFAULT 'ok',
  aplicado_ao_calculo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgdasd_extraido TO authenticated;
GRANT ALL ON public.pgdasd_extraido TO service_role;

ALTER TABLE public.pgdasd_extraido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage pgdasd" ON public.pgdasd_extraido
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX pgdasd_extraido_case_id_idx ON public.pgdasd_extraido (case_id, created_at DESC);

CREATE TRIGGER update_pgdasd_extraido_updated_at
  BEFORE UPDATE ON public.pgdasd_extraido
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();