CREATE OR REPLACE VIEW public.vw_concentracao_compras_ncm
WITH (security_invoker = on) AS
SELECT
  i.case_id,
  COALESCE(i.ncm, '—') AS codigo,
  n.cnpj_emitente AS cnpj_contraparte,
  n.razao_social_emitente AS nome_contraparte,
  SUM(i.valor_item) AS valor_base_total,
  COALESCE(SUM(i.valor_credito_ibs_cbs) FILTER (WHERE i.status_classificacao = 'ok'), 0) AS valor_apurado_total,
  COUNT(*)::int AS n_itens,
  COUNT(*) FILTER (WHERE i.status_classificacao IN ('ambiguo_revisao_pendente', 'marcado_revisao'))::int AS n_itens_pendentes
FROM public.nota_fiscal_compra_xml_item i
JOIN public.nota_fiscal_compra_xml n ON n.id = i.nota_fiscal_compra_xml_id
GROUP BY i.case_id, COALESCE(i.ncm, '—'), n.cnpj_emitente, n.razao_social_emitente;

CREATE OR REPLACE VIEW public.vw_concentracao_vendas_ncm
WITH (security_invoker = on) AS
SELECT
  i.case_id,
  COALESCE(i.ncm, '—') AS codigo,
  n.cnpj_destinatario AS cnpj_contraparte,
  n.razao_social_destinatario AS nome_contraparte,
  SUM(i.valor_item) AS valor_base_total,
  COALESCE(SUM(i.valor_debito_ibs_cbs) FILTER (WHERE i.status_classificacao = 'ok'), 0) AS valor_apurado_total,
  COUNT(*)::int AS n_itens,
  COUNT(*) FILTER (WHERE i.status_classificacao IN ('ambiguo_revisao_pendente', 'marcado_revisao'))::int AS n_itens_pendentes
FROM public.nota_fiscal_venda_xml_item i
JOIN public.nota_fiscal_venda_xml n ON n.id = i.nota_fiscal_venda_xml_id
GROUP BY i.case_id, COALESCE(i.ncm, '—'), n.cnpj_destinatario, n.razao_social_destinatario;

CREATE OR REPLACE VIEW public.vw_concentracao_servicos_nbs
WITH (security_invoker = on) AS
SELECT
  i.case_id,
  'tomado'::text AS direcao,
  COALESCE(i.nbs, '—') AS codigo,
  s.cnpj_prestador AS cnpj_contraparte,
  s.razao_social_prestador AS nome_contraparte,
  SUM(i.valor_servico) AS valor_base_total,
  COALESCE(SUM(i.valor_credito_ibs_cbs) FILTER (WHERE i.status_classificacao = 'ok'), 0) AS valor_apurado_total,
  COUNT(*)::int AS n_itens,
  COUNT(*) FILTER (WHERE i.status_classificacao IN ('ambiguo_revisao_pendente', 'marcado_revisao'))::int AS n_itens_pendentes
FROM public.nota_servico_nfse_item i
JOIN public.nota_servico_nfse s ON s.id = i.nota_servico_id
GROUP BY i.case_id, COALESCE(i.nbs, '—'), s.cnpj_prestador, s.razao_social_prestador
UNION ALL
SELECT
  p.case_id,
  'prestado'::text AS direcao,
  COALESCE(p.nbs, '—') AS codigo,
  s.cnpj_tomador AS cnpj_contraparte,
  s.razao_social_tomador AS nome_contraparte,
  SUM(p.valor_servico) AS valor_base_total,
  COALESCE(SUM(p.valor_debito_ibs_cbs) FILTER (WHERE p.status_classificacao = 'ok'), 0) AS valor_apurado_total,
  COUNT(*)::int AS n_itens,
  COUNT(*) FILTER (WHERE p.status_classificacao IN ('ambiguo_revisao_pendente', 'marcado_revisao'))::int AS n_itens_pendentes
FROM public.nota_servico_nfse_item_prestado p
JOIN public.nota_servico_nfse s ON s.id = p.nota_servico_id
GROUP BY p.case_id, COALESCE(p.nbs, '—'), s.cnpj_tomador, s.razao_social_tomador;

GRANT SELECT ON public.vw_concentracao_compras_ncm TO authenticated;
GRANT SELECT ON public.vw_concentracao_vendas_ncm TO authenticated;
GRANT SELECT ON public.vw_concentracao_servicos_nbs TO authenticated;
GRANT SELECT ON public.vw_concentracao_compras_ncm TO service_role;
GRANT SELECT ON public.vw_concentracao_vendas_ncm TO service_role;
GRANT SELECT ON public.vw_concentracao_servicos_nbs TO service_role;