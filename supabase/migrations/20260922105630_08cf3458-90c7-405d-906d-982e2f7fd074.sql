
CREATE TABLE public.despesa_operacional_anual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesa_operacional_anual TO authenticated;
GRANT ALL ON public.despesa_operacional_anual TO service_role;
ALTER TABLE public.despesa_operacional_anual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados mantem despesas do caso" ON public.despesa_operacional_anual
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_despesa_operacional_anual_updated_at BEFORE UPDATE ON public.despesa_operacional_anual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dre_projecao_anual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  cenario text NOT NULL,
  receita_bruta numeric NOT NULL DEFAULT 0,
  deducoes numeric NOT NULL DEFAULT 0,
  receita_liquida numeric NOT NULL DEFAULT 0,
  custo numeric NOT NULL DEFAULT 0,
  lucro_bruto numeric NOT NULL DEFAULT 0,
  despesas_operacionais numeric NOT NULL DEFAULT 0,
  resultado_antes_ircs numeric NOT NULL DEFAULT 0,
  ircs numeric,
  resultado_liquido numeric,
  ircs_origem text,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, ano, cenario)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_projecao_anual TO authenticated;
GRANT ALL ON public.dre_projecao_anual TO service_role;
ALTER TABLE public.dre_projecao_anual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados mantem dre do caso" ON public.dre_projecao_anual
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.parametro_fluxo_caixa (
  case_id uuid PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  prazo_medio_recebimento_dias integer NOT NULL DEFAULT 30,
  prazo_medio_pagamento_fornecedores_dias integer NOT NULL DEFAULT 30,
  periodicidade_compensacao_credito_dias integer NOT NULL DEFAULT 30,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametro_fluxo_caixa TO authenticated;
GRANT ALL ON public.parametro_fluxo_caixa TO service_role;
ALTER TABLE public.parametro_fluxo_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados mantem parametros de fluxo" ON public.parametro_fluxo_caixa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.fluxo_caixa_projecao_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL,
  entradas_clientes numeric NOT NULL DEFAULT 0,
  saidas_fornecedores numeric NOT NULL DEFAULT 0,
  saidas_despesas numeric NOT NULL DEFAULT 0,
  debito_ibscbs_retido numeric NOT NULL DEFAULT 0,
  credito_ibscbs_disponivel numeric NOT NULL DEFAULT 0,
  debito_liquido_recolhido numeric NOT NULL DEFAULT 0,
  saldo_credor_acumulado numeric NOT NULL DEFAULT 0,
  variacao_caixa numeric NOT NULL DEFAULT 0,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_caixa_projecao_mensal TO authenticated;
GRANT ALL ON public.fluxo_caixa_projecao_mensal TO service_role;
ALTER TABLE public.fluxo_caixa_projecao_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados mantem fluxo do caso" ON public.fluxo_caixa_projecao_mensal
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
