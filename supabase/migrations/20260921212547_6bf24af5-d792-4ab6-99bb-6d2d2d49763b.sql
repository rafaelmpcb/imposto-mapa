CREATE TABLE public.ncm_excecao_ibscbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncm text NOT NULL,
  anexo text NOT NULL DEFAULT '',
  anexo_desc text NOT NULL DEFAULT '',
  cclasstrib text,
  reducao_pct numeric NOT NULL DEFAULT 0,
  imposto_seletivo boolean NOT NULL DEFAULT false,
  n_classificacoes_ncm integer NOT NULL DEFAULT 1,
  requer_revisao_humana boolean NOT NULL DEFAULT false,
  observacao text,
  fonte text NOT NULL DEFAULT 'buscadorncm.com.br, conferido contra Calculadora de Tributos RFB/Serpro (base V0057)',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ncm_excecao_ncm ON public.ncm_excecao_ibscbs (ncm);
GRANT SELECT ON public.ncm_excecao_ibscbs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncm_excecao_ibscbs TO authenticated;
GRANT ALL ON public.ncm_excecao_ibscbs TO service_role;
ALTER TABLE public.ncm_excecao_ibscbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NCM exceptions are publicly readable" ON public.ncm_excecao_ibscbs FOR SELECT USING (true);
CREATE POLICY "Team members manage ncm exceptions" ON public.ncm_excecao_ibscbs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.nota_fiscal_compra_xml_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_compra_xml_id uuid NOT NULL REFERENCES public.nota_fiscal_compra_xml(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  ncm text,
  cfop text,
  descricao text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_item numeric NOT NULL DEFAULT 0,
  tem_ibscbs boolean NOT NULL DEFAULT false,
  cclasstrib text,
  valor_base_calculo numeric NOT NULL DEFAULT 0,
  valor_credito_ibs_cbs numeric NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT '',
  status_classificacao text NOT NULL DEFAULT 'sem_dado',
  opcoes_candidatas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfe_compra_item_nota ON public.nota_fiscal_compra_xml_item (nota_fiscal_compra_xml_id);
CREATE INDEX idx_nfe_compra_item_case ON public.nota_fiscal_compra_xml_item (case_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_compra_xml_item TO authenticated;
GRANT ALL ON public.nota_fiscal_compra_xml_item TO service_role;
ALTER TABLE public.nota_fiscal_compra_xml_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage nfe compra items" ON public.nota_fiscal_compra_xml_item FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_nfe_compra_item_updated_at BEFORE UPDATE ON public.nota_fiscal_compra_xml_item FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();