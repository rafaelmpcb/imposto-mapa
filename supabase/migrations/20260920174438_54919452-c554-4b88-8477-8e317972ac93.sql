CREATE TABLE public.nota_fiscal_compra_xml (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  arquivo_original text NOT NULL DEFAULT '',
  chave_acesso text,
  numero_nota text,
  serie text,
  cnpj_emitente text,
  razao_social_emitente text,
  valor_total numeric NOT NULL DEFAULT 0,
  data_emissao timestamp with time zone,
  status_processamento text NOT NULL DEFAULT 'ok',
  aplicado_composicao_carteira boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_compra_xml TO authenticated;
GRANT ALL ON public.nota_fiscal_compra_xml TO service_role;

ALTER TABLE public.nota_fiscal_compra_xml ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage nfe compra xml"
ON public.nota_fiscal_compra_xml FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_nfe_compra_case ON public.nota_fiscal_compra_xml (case_id);
CREATE UNIQUE INDEX idx_nfe_compra_chave ON public.nota_fiscal_compra_xml (case_id, chave_acesso) WHERE chave_acesso IS NOT NULL;

CREATE TRIGGER update_nfe_compra_updated_at
BEFORE UPDATE ON public.nota_fiscal_compra_xml
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();