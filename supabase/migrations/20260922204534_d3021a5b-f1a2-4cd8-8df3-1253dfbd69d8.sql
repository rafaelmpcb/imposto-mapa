CREATE TABLE public.estudo_capex (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  tipo_ativo text NOT NULL,
  regime text NOT NULL,
  valor_investimento numeric NOT NULL DEFAULT 0,
  icms_pct numeric NOT NULL DEFAULT 0,
  ipi_pct numeric NOT NULL DEFAULT 0,
  fator_ciap_pct numeric NOT NULL DEFAULT 100,
  custo_oportunidade_aa_pct numeric NOT NULL DEFAULT 0,
  aliquota_plena_pct numeric NOT NULL DEFAULT 26.5,
  ano_aquisicao integer NOT NULL,
  resultado_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudo_capex TO authenticated;
GRANT ALL ON public.estudo_capex TO service_role;

ALTER TABLE public.estudo_capex ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam estudos de capex"
ON public.estudo_capex FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_estudo_capex_case ON public.estudo_capex(case_id);

CREATE TRIGGER estudo_capex_updated_at
BEFORE UPDATE ON public.estudo_capex
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();