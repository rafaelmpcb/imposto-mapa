CREATE TABLE public.parametro_cenario_compras (
  case_id uuid PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  aliquota_ibs_cbs_plena_pct numeric NOT NULL DEFAULT 26.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametro_cenario_compras TO authenticated;
GRANT ALL ON public.parametro_cenario_compras TO service_role;
ALTER TABLE public.parametro_cenario_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escritorio mantem parametros de cenario" ON public.parametro_cenario_compras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_parametro_cenario_compras_updated_at BEFORE UPDATE ON public.parametro_cenario_compras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cronograma_transicao_ibscbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  fracao_aliquota_plena numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cronograma_transicao_case_ano ON public.cronograma_transicao_ibscbs (case_id, ano) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX cronograma_transicao_padrao_ano ON public.cronograma_transicao_ibscbs (ano) WHERE case_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_transicao_ibscbs TO authenticated;
GRANT ALL ON public.cronograma_transicao_ibscbs TO service_role;
ALTER TABLE public.cronograma_transicao_ibscbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escritorio mantem cronograma de transicao" ON public.cronograma_transicao_ibscbs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_cronograma_transicao_updated_at BEFORE UPDATE ON public.cronograma_transicao_ibscbs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cronograma_transicao_ibscbs (case_id, ano, fracao_aliquota_plena) VALUES
  (NULL, 2027, 0.10),
  (NULL, 2028, 0.20),
  (NULL, 2029, 0.40),
  (NULL, 2030, 0.60),
  (NULL, 2031, 0.80),
  (NULL, 2032, 0.90),
  (NULL, 2033, 1.00);

ALTER TABLE public.nota_fiscal_venda_xml_item
  ADD COLUMN valor_icms numeric NOT NULL DEFAULT 0,
  ADD COLUMN valor_ipi numeric NOT NULL DEFAULT 0,
  ADD COLUMN valor_pis numeric NOT NULL DEFAULT 0,
  ADD COLUMN valor_cofins numeric NOT NULL DEFAULT 0;

ALTER TABLE public.nota_servico_nfse_item_prestado
  ADD COLUMN valor_iss numeric NOT NULL DEFAULT 0;

CREATE TABLE public.nota_fiscal_venda_xml_item_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item_id uuid NOT NULL UNIQUE REFERENCES public.nota_fiscal_venda_xml_item(id) ON DELETE CASCADE,
  tributos_atuais_total numeric NOT NULL DEFAULT 0,
  valor_desonerado numeric NOT NULL DEFAULT 0,
  aliquota_plena_aplicada numeric NOT NULL DEFAULT 0,
  preco_necessario numeric NOT NULL DEFAULT 0,
  variacao_preco_pct numeric NOT NULL DEFAULT 0,
  regime_cliente_snapshot text,
  status_preco text NOT NULL DEFAULT 'ok',
  calculado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_venda_xml_item_preco TO authenticated;
GRANT ALL ON public.nota_fiscal_venda_xml_item_preco TO service_role;
ALTER TABLE public.nota_fiscal_venda_xml_item_preco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escritorio mantem preco de mercadoria" ON public.nota_fiscal_venda_xml_item_preco FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX nfvxi_preco_case_idx ON public.nota_fiscal_venda_xml_item_preco (case_id);

CREATE TABLE public.nota_servico_nfse_item_prestado_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item_id uuid NOT NULL UNIQUE REFERENCES public.nota_servico_nfse_item_prestado(id) ON DELETE CASCADE,
  tributos_atuais_total numeric NOT NULL DEFAULT 0,
  valor_desonerado numeric NOT NULL DEFAULT 0,
  aliquota_plena_aplicada numeric NOT NULL DEFAULT 0,
  preco_necessario numeric NOT NULL DEFAULT 0,
  variacao_preco_pct numeric NOT NULL DEFAULT 0,
  regime_cliente_snapshot text,
  status_preco text NOT NULL DEFAULT 'ok',
  calculado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_servico_nfse_item_prestado_preco TO authenticated;
GRANT ALL ON public.nota_servico_nfse_item_prestado_preco TO service_role;
ALTER TABLE public.nota_servico_nfse_item_prestado_preco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escritorio mantem preco de servico" ON public.nota_servico_nfse_item_prestado_preco FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX nsnip_preco_case_idx ON public.nota_servico_nfse_item_prestado_preco (case_id);

CREATE TABLE public.preco_necessario_projecao_anual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  tipo_item text NOT NULL,
  ano integer NOT NULL,
  preco_necessario_ano numeric NOT NULL DEFAULT 0,
  variacao_preco_pct_ano numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, tipo_item, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preco_necessario_projecao_anual TO authenticated;
GRANT ALL ON public.preco_necessario_projecao_anual TO service_role;
ALTER TABLE public.preco_necessario_projecao_anual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escritorio mantem projecao anual de preco" ON public.preco_necessario_projecao_anual FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX preco_projecao_case_idx ON public.preco_necessario_projecao_anual (case_id, ano);