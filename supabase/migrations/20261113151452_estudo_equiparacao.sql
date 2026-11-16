CREATE TABLE public.estudo_equiparacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  titulo text NOT NULL DEFAULT 'Estudo de equiparação hospitalar',
  receita_mensal numeric NOT NULL DEFAULT 0,
  fracao_procedimentos numeric NOT NULL DEFAULT 0,
  meses_retroativos integer NOT NULL DEFAULT 60,
  exito_pct numeric NOT NULL DEFAULT 20,
  origem_segregacao text NOT NULL DEFAULT 'percentual',
  segregacao_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudo_equiparacao TO authenticated;
GRANT ALL ON public.estudo_equiparacao TO service_role;
ALTER TABLE public.estudo_equiparacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam estudos de equiparacao" ON public.estudo_equiparacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER estudo_equiparacao_updated_at BEFORE UPDATE ON public.estudo_equiparacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
