CREATE TABLE public.case_documento_duplicado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  chave_acesso text,
  arquivo_original text NOT NULL,
  motivo text NOT NULL DEFAULT 'chave_acesso_ja_processada',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documento_duplicado TO authenticated;
GRANT ALL ON public.case_documento_duplicado TO service_role;

ALTER TABLE public.case_documento_duplicado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam duplicados do escritorio"
ON public.case_documento_duplicado FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_case_documento_duplicado_case ON public.case_documento_duplicado (case_id);

CREATE OR REPLACE VIEW public.vw_painel_carga AS
WITH docs AS (
  SELECT case_id, 'nfe_compra'::text AS tipo_documento, status_processamento FROM public.nota_fiscal_compra_xml
  UNION ALL
  SELECT case_id, 'nfe_venda'::text, status_processamento FROM public.nota_fiscal_venda_xml
  UNION ALL
  SELECT case_id,
         CASE WHEN direcao = 'prestado' THEN 'nfse_prestado' ELSE 'nfse_tomado' END,
         status_processamento
  FROM public.nota_servico_nfse
),
agg AS (
  SELECT case_id, tipo_documento,
    count(*) FILTER (WHERE status_processamento = 'ok')::int AS validos,
    count(*) FILTER (WHERE status_processamento IN ('xml_invalido','nao_e_nfe','nao_e_nfse','documento_invalido'))::int AS nao_sao_notas,
    count(*) FILTER (WHERE status_processamento NOT IN ('ok','xml_invalido','nao_e_nfe','nao_e_nfse','documento_invalido'))::int AS ignorados,
    count(*)::int AS gravados
  FROM docs
  GROUP BY case_id, tipo_documento
),
dup AS (
  SELECT case_id, tipo_documento, count(*)::int AS duplicados
  FROM public.case_documento_duplicado
  GROUP BY case_id, tipo_documento
)
SELECT
  COALESCE(a.case_id, d.case_id) AS case_id,
  COALESCE(a.tipo_documento, d.tipo_documento) AS tipo_documento,
  COALESCE(a.validos, 0) AS validos,
  COALESCE(a.nao_sao_notas, 0) AS nao_sao_notas,
  COALESCE(a.ignorados, 0) AS ignorados,
  COALESCE(d.duplicados, 0) AS duplicados,
  0 AS manuais,
  COALESCE(a.gravados, 0) + COALESCE(d.duplicados, 0) AS total_recebido
FROM agg a
FULL OUTER JOIN dup d ON d.case_id = a.case_id AND d.tipo_documento = a.tipo_documento;

GRANT SELECT ON public.vw_painel_carga TO authenticated;
GRANT SELECT ON public.vw_painel_carga TO service_role;

DROP VIEW IF EXISTS public.vw_concentracao_compras_ncm;
CREATE VIEW public.vw_concentracao_compras_ncm AS
SELECT i.case_id,
  COALESCE(i.ncm, '—') AS codigo,
  COALESCE(i.cfop, '—') AS cfop,
  n.cnpj_emitente AS cnpj_contraparte,
  n.razao_social_emitente AS nome_contraparte,
  sum(i.valor_item) AS valor_base_total,
  COALESCE(sum(i.valor_credito_ibs_cbs) FILTER (WHERE i.status_classificacao = 'ok'), 0::numeric) AS valor_apurado_total,
  count(*)::int AS n_itens,
  count(*) FILTER (WHERE i.status_classificacao = ANY (ARRAY['ambiguo_revisao_pendente','marcado_revisao']))::int AS n_itens_pendentes
FROM public.nota_fiscal_compra_xml_item i
JOIN public.nota_fiscal_compra_xml n ON n.id = i.nota_fiscal_compra_xml_id
GROUP BY i.case_id, COALESCE(i.ncm, '—'), COALESCE(i.cfop, '—'), n.cnpj_emitente, n.razao_social_emitente;

DROP VIEW IF EXISTS public.vw_concentracao_vendas_ncm;
CREATE VIEW public.vw_concentracao_vendas_ncm AS
SELECT i.case_id,
  COALESCE(i.ncm, '—') AS codigo,
  COALESCE(i.cfop, '—') AS cfop,
  n.cnpj_destinatario AS cnpj_contraparte,
  n.razao_social_destinatario AS nome_contraparte,
  sum(i.valor_item) AS valor_base_total,
  COALESCE(sum(i.valor_debito_ibs_cbs) FILTER (WHERE i.status_classificacao = 'ok'), 0::numeric) AS valor_apurado_total,
  count(*)::int AS n_itens,
  count(*) FILTER (WHERE i.status_classificacao = ANY (ARRAY['ambiguo_revisao_pendente','marcado_revisao']))::int AS n_itens_pendentes
FROM public.nota_fiscal_venda_xml_item i
JOIN public.nota_fiscal_venda_xml n ON n.id = i.nota_fiscal_venda_xml_id
GROUP BY i.case_id, COALESCE(i.ncm, '—'), COALESCE(i.cfop, '—'), n.cnpj_destinatario, n.razao_social_destinatario;

GRANT SELECT ON public.vw_concentracao_compras_ncm TO authenticated, service_role;
GRANT SELECT ON public.vw_concentracao_vendas_ncm TO authenticated, service_role;