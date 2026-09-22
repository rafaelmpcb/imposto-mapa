CREATE TABLE public.contrato_reequilibrio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  contraparte text,
  papel text NOT NULL DEFAULT 'prestador',
  regime_prestador text NOT NULL,
  perfil_contratante text NOT NULL,
  preco_mensal_atual numeric NOT NULL DEFAULT 0,
  custo_direto_pct numeric NOT NULL DEFAULT 0,
  credito_insumos_pct numeric NOT NULL DEFAULT 0,
  aliquota_plena_pct numeric NOT NULL DEFAULT 26.5,
  reducao_pct numeric NOT NULL DEFAULT 0,
  ano_referencia integer NOT NULL DEFAULT 2033,
  cenario text NOT NULL DEFAULT 'equilibrio',
  status text NOT NULL DEFAULT 'a_revisar',
  resultado_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_reequilibrio TO authenticated;
GRANT ALL ON public.contrato_reequilibrio TO service_role;

ALTER TABLE public.contrato_reequilibrio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam estudos de contrato"
ON public.contrato_reequilibrio FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_contrato_reequilibrio_case ON public.contrato_reequilibrio(case_id);

CREATE TRIGGER contrato_reequilibrio_updated_at
BEFORE UPDATE ON public.contrato_reequilibrio
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();