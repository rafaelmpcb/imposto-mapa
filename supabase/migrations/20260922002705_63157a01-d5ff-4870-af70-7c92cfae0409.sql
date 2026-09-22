CREATE TABLE public.nota_fiscal_venda_xml_item (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_venda_xml_id uuid NOT NULL REFERENCES public.nota_fiscal_venda_xml(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  ncm text,
  cfop text,
  descricao text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_item numeric NOT NULL DEFAULT 0,
  tem_ibscbs boolean NOT NULL DEFAULT false,
  cclasstrib text,
  valor_base_calculo numeric NOT NULL DEFAULT 0,
  valor_debito_ibs_cbs numeric NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT '',
  status_classificacao text NOT NULL DEFAULT 'sem_dado',
  opcoes_candidatas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_venda_xml_item TO authenticated;
GRANT ALL ON public.nota_fiscal_venda_xml_item TO service_role;

ALTER TABLE public.nota_fiscal_venda_xml_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage nfe venda itens"
ON public.nota_fiscal_venda_xml_item
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX idx_nfe_venda_item_case ON public.nota_fiscal_venda_xml_item(case_id);
CREATE INDEX idx_nfe_venda_item_nota ON public.nota_fiscal_venda_xml_item(nota_fiscal_venda_xml_id);
CREATE INDEX idx_nfe_venda_item_ncm ON public.nota_fiscal_venda_xml_item(ncm);

CREATE TRIGGER update_nfe_venda_item_updated_at
BEFORE UPDATE ON public.nota_fiscal_venda_xml_item
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();