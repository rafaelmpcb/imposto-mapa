CREATE TABLE public.integration_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.integration_config TO service_role;
ALTER TABLE public.integration_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.case_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'gerado',
  document_key TEXT,
  request_signature_key TEXT,
  sign_url TEXT,
  signed_file_url TEXT,
  ambiente TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.case_contracts TO service_role;
ALTER TABLE public.case_contracts ENABLE ROW LEVEL SECURITY;

CREATE INDEX case_contracts_case_id_idx ON public.case_contracts (case_id);
CREATE INDEX case_contracts_document_key_idx ON public.case_contracts (document_key);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_case_contracts_updated_at BEFORE UPDATE ON public.case_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();