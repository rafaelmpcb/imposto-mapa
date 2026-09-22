CREATE TABLE public.estudo_saldos_credores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  titulo text NOT NULL DEFAULT 'Estudo de saldos credores',
  uf text NOT NULL DEFAULT 'SP',
  saldo_icms numeric NOT NULL DEFAULT 0,
  saldo_pis_cofins numeric NOT NULL DEFAULT 0,
  custo_oportunidade_aa_pct numeric NOT NULL DEFAULT 12,
  ipca_aa_pct numeric NOT NULL DEFAULT 4,
  desagio_cessao_pct numeric NOT NULL DEFAULT 30,
  meses_compensacao_cbs integer NOT NULL DEFAULT 24,
  resultado_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudo_saldos_credores TO authenticated;
GRANT ALL ON public.estudo_saldos_credores TO service_role;

ALTER TABLE public.estudo_saldos_credores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam estudos de saldos credores"
ON public.estudo_saldos_credores FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_estudo_saldos_credores_case ON public.estudo_saldos_credores(case_id);

CREATE TRIGGER estudo_saldos_credores_updated_at
BEFORE UPDATE ON public.estudo_saldos_credores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();