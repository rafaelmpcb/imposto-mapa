ALTER TABLE public.nota_servico_nfse
  ADD COLUMN IF NOT EXISTS cnpj_tomador text,
  ADD COLUMN IF NOT EXISTS razao_social_tomador text,
  ADD COLUMN IF NOT EXISTS direcao text NOT NULL DEFAULT 'tomado';

CREATE TABLE public.nota_servico_nfse_item_prestado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_servico_id uuid NOT NULL REFERENCES public.nota_servico_nfse(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  nbs text,
  item_lc116 text,
  descricao text,
  valor_servico numeric NOT NULL DEFAULT 0,
  tem_classificacao_documento boolean NOT NULL DEFAULT false,
  cclasstrib text,
  valor_base_calculo numeric NOT NULL DEFAULT 0,
  valor_debito_ibs_cbs numeric NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT '',
  status_classificacao text NOT NULL DEFAULT 'sem_dado',
  opcoes_candidatas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_servico_nfse_item_prestado TO authenticated;
GRANT ALL ON public.nota_servico_nfse_item_prestado TO service_role;

ALTER TABLE public.nota_servico_nfse_item_prestado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage nfse itens prestados"
  ON public.nota_servico_nfse_item_prestado FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_nfse_item_prestado_case ON public.nota_servico_nfse_item_prestado (case_id);
CREATE INDEX idx_nfse_item_prestado_nota ON public.nota_servico_nfse_item_prestado (nota_servico_id);

CREATE TRIGGER update_nfse_item_prestado_updated_at
  BEFORE UPDATE ON public.nota_servico_nfse_item_prestado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();