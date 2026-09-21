CREATE TABLE public.nota_fiscal_venda_xml (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  arquivo_original text NOT NULL DEFAULT '',
  chave_acesso text,
  numero_nota text,
  serie text,
  cnpj_destinatario text,
  razao_social_destinatario text,
  valor_total numeric NOT NULL DEFAULT 0,
  data_emissao timestamp with time zone,
  status_processamento text NOT NULL DEFAULT 'ok',
  aplicado_composicao_carteira boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_venda_xml TO authenticated;
GRANT ALL ON public.nota_fiscal_venda_xml TO service_role;

ALTER TABLE public.nota_fiscal_venda_xml ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage nfe venda xml"
ON public.nota_fiscal_venda_xml FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX nfe_venda_case_idx ON public.nota_fiscal_venda_xml (case_id);
CREATE INDEX nfe_venda_chave_idx ON public.nota_fiscal_venda_xml (case_id, chave_acesso);

CREATE TRIGGER update_nfe_venda_updated_at
BEFORE UPDATE ON public.nota_fiscal_venda_xml
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();