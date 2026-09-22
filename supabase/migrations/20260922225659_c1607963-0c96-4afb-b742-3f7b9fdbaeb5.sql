CREATE TABLE public.estudo_monofasico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT 'Estudo de recuperação monofásica',
  segmento TEXT NOT NULL DEFAULT 'outro',
  regime TEXT NOT NULL DEFAULT 'simples',
  faturamento_mensal NUMERIC NOT NULL DEFAULT 0,
  participacao_monofasica_pct NUMERIC NOT NULL DEFAULT 0,
  aliquota_efetiva_das_pct NUMERIC NOT NULL DEFAULT 0,
  parcela_pis_cofins_pct NUMERIC NOT NULL DEFAULT 0,
  meses_retroativos INTEGER NOT NULL DEFAULT 60,
  selic_aa_pct NUMERIC NOT NULL DEFAULT 0,
  honorario_exito_pct NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  resultado_json JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudo_monofasico TO authenticated;
GRANT ALL ON public.estudo_monofasico TO service_role;

ALTER TABLE public.estudo_monofasico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada gerencia estudos monofasicos"
ON public.estudo_monofasico FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_estudo_monofasico_case ON public.estudo_monofasico (case_id);

CREATE TRIGGER update_estudo_monofasico_updated_at
BEFORE UPDATE ON public.estudo_monofasico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();