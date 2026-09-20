CREATE TYPE public.carteira_tipo AS ENUM ('cliente','fornecedor');
CREATE TYPE public.carteira_regime AS ENUM ('simples','regular','pendente','erro');
CREATE TYPE public.carteira_status AS ENUM ('ok','nao_encontrado','erro','pendente');

CREATE TABLE public.composicao_carteira (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  cnpj text NOT NULL,
  tipo public.carteira_tipo NOT NULL,
  valor_movimentado numeric NOT NULL DEFAULT 0,
  percentual_carteira numeric NOT NULL DEFAULT 0,
  regime public.carteira_regime NOT NULL DEFAULT 'pendente',
  fonte_classificacao text NOT NULL DEFAULT 'CNPJá — API Pública',
  data_classificacao timestamp with time zone,
  status_consulta public.carteira_status NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicao_carteira TO authenticated;
GRANT ALL ON public.composicao_carteira TO service_role;
ALTER TABLE public.composicao_carteira ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage composicao carteira" ON public.composicao_carteira FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX composicao_carteira_case_idx ON public.composicao_carteira (case_id, tipo);
CREATE TRIGGER update_composicao_carteira_updated_at BEFORE UPDATE ON public.composicao_carteira FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.case_diagnostic_docs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  status text NOT NULL DEFAULT 'nao_enviado',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (case_id, doc_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_diagnostic_docs TO authenticated;
GRANT ALL ON public.case_diagnostic_docs TO service_role;
ALTER TABLE public.case_diagnostic_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage diagnostic docs" ON public.case_diagnostic_docs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_case_diagnostic_docs_updated_at BEFORE UPDATE ON public.case_diagnostic_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS carteira_column_mapping jsonb;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS carteira_uploaded_at timestamp with time zone;