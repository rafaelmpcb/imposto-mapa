ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'completo';
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS objetivo text;
ALTER TABLE public.cases ADD CONSTRAINT cases_escopo_check CHECK (escopo IN ('light','completo'));

CREATE TABLE public.parecer_padrao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  dados_compilados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  edicoes_analista_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_em timestamp with time zone NOT NULL DEFAULT now(),
  gerado_por uuid,
  finalizado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parecer_padrao_status_check CHECK (status IN ('rascunho','em_revisao','finalizado')),
  CONSTRAINT parecer_padrao_versao_unica UNIQUE (case_id, versao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parecer_padrao TO authenticated;
GRANT ALL ON public.parecer_padrao TO service_role;

ALTER TABLE public.parecer_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam pareceres"
ON public.parecer_padrao FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX parecer_padrao_case_idx ON public.parecer_padrao (case_id, versao DESC);

CREATE TRIGGER update_parecer_padrao_updated_at
BEFORE UPDATE ON public.parecer_padrao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();