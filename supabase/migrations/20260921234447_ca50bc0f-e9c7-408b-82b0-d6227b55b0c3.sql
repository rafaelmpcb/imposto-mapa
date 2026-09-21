CREATE TABLE public.nbs_excecao_ibscbs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nbs text NOT NULL,
  item_nbs text NOT NULL DEFAULT '',
  descricao_nbs text NOT NULL DEFAULT '',
  cclasstrib text,
  grupo_cclasstrib text,
  nome_cclasstrib text NOT NULL DEFAULT '',
  aliquota_ibs_2026 numeric NOT NULL DEFAULT 0,
  aliquota_cbs_2026 numeric NOT NULL DEFAULT 0,
  regime_especifico_sem_aliquota_simples boolean NOT NULL DEFAULT false,
  n_cclasstrib_por_nbs integer NOT NULL DEFAULT 1,
  requer_revisao_humana boolean NOT NULL DEFAULT false,
  flag_x_origem boolean NOT NULL DEFAULT false,
  observacao text,
  fonte text NOT NULL DEFAULT 'Anexo VIII v1.01.00 (gov.br/nfse) + simulador oficial da reforma, base 2026',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nbs_excecao_nbs ON public.nbs_excecao_ibscbs (nbs);
GRANT SELECT ON public.nbs_excecao_ibscbs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nbs_excecao_ibscbs TO authenticated;
GRANT ALL ON public.nbs_excecao_ibscbs TO service_role;
ALTER TABLE public.nbs_excecao_ibscbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NBS exceptions are publicly readable" ON public.nbs_excecao_ibscbs FOR SELECT USING (true);
CREATE POLICY "Team members manage nbs exceptions" ON public.nbs_excecao_ibscbs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.nota_servico_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  arquivo_original text NOT NULL DEFAULT '',
  chave_acesso text,
  numero_nota text,
  serie text,
  cnpj_prestador text,
  razao_social_prestador text,
  valor_total numeric NOT NULL DEFAULT 0,
  data_emissao timestamptz,
  status_processamento text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfse_case ON public.nota_servico_nfse (case_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_servico_nfse TO authenticated;
GRANT ALL ON public.nota_servico_nfse TO service_role;
ALTER TABLE public.nota_servico_nfse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage nfse" ON public.nota_servico_nfse FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_nfse_updated_at BEFORE UPDATE ON public.nota_servico_nfse FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nota_servico_nfse_item (
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
  valor_credito_ibs_cbs numeric NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT '',
  status_classificacao text NOT NULL DEFAULT 'sem_dado',
  opcoes_candidatas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfse_item_case ON public.nota_servico_nfse_item (case_id);
CREATE INDEX idx_nfse_item_nota ON public.nota_servico_nfse_item (nota_servico_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_servico_nfse_item TO authenticated;
GRANT ALL ON public.nota_servico_nfse_item TO service_role;
ALTER TABLE public.nota_servico_nfse_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage nfse items" ON public.nota_servico_nfse_item FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_nfse_item_updated_at BEFORE UPDATE ON public.nota_servico_nfse_item FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();