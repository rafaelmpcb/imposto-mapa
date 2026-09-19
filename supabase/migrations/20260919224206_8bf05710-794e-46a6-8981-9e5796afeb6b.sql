CREATE TYPE public.case_stage AS ENUM (
  'lead',
  'diagnostico_basico',
  'memorando_assinado',
  'aguardando_documentos',
  'diagnostico_full',
  'em_revisao',
  'reuniao_agendada',
  'elaboracao_proposta',
  'proposta_enviada',
  'contrato_assinado',
  'relatorio_entregue',
  'acompanhamento_implantacao'
);

CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text,
  cnpj text,
  stage public.case_stage NOT NULL DEFAULT 'lead',
  owner_id uuid,
  owner_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage cases" ON public.cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.case_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;
GRANT ALL ON public.case_documents TO service_role;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage case documents" ON public.case_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_case_documents_updated_at BEFORE UPDATE ON public.case_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.simulations
  ADD COLUMN case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;

CREATE INDEX idx_simulations_case_id ON public.simulations(case_id);
CREATE INDEX idx_cases_cnpj ON public.cases(cnpj);

-- Backfill: agrupa por CNPJ normalizado; cálculos sem CNPJ viram um caso cada.
WITH normalized AS (
  SELECT id, created_at, client_name,
         NULLIF(regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), '') AS cnpj_digits
  FROM public.simulations
), grouped AS (
  SELECT cnpj_digits,
         (ARRAY_AGG(client_name ORDER BY created_at DESC) FILTER (WHERE client_name IS NOT NULL))[1] AS client_name,
         MIN(created_at) AS created_at
  FROM normalized
  WHERE cnpj_digits IS NOT NULL
  GROUP BY cnpj_digits
), inserted_grouped AS (
  INSERT INTO public.cases (client_name, cnpj, stage, created_at)
  SELECT client_name, cnpj_digits, 'lead', created_at FROM grouped
  RETURNING id, cnpj
)
UPDATE public.simulations s
SET case_id = ig.id
FROM inserted_grouped ig, normalized n
WHERE n.id = s.id AND n.cnpj_digits = ig.cnpj;

WITH solo AS (
  SELECT id, client_name, created_at
  FROM public.simulations
  WHERE case_id IS NULL
), inserted_solo AS (
  INSERT INTO public.cases (client_name, cnpj, stage, created_at)
  SELECT client_name, NULL, 'lead', created_at FROM solo
  RETURNING id, client_name, created_at
)
UPDATE public.simulations s
SET case_id = i.id
FROM (
  SELECT DISTINCT ON (created_at, COALESCE(client_name, '')) id, client_name, created_at
  FROM inserted_solo
) i
WHERE s.case_id IS NULL
  AND s.created_at = i.created_at
  AND COALESCE(s.client_name, '') = COALESCE(i.client_name, '');