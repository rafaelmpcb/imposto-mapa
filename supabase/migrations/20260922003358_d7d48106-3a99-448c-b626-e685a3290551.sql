CREATE TABLE public.item_revisao_evento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  origem text NOT NULL,
  acao text NOT NULL,
  anexo text,
  cclasstrib text,
  reducao_pct numeric,
  status_anterior text,
  status_novo text,
  valor_anterior numeric,
  valor_novo numeric,
  observacao text,
  decidido_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_revisao_evento_case ON public.item_revisao_evento (case_id);
CREATE INDEX idx_item_revisao_evento_item ON public.item_revisao_evento (item_id, created_at DESC);

GRANT SELECT, INSERT ON public.item_revisao_evento TO authenticated;
GRANT ALL ON public.item_revisao_evento TO service_role;

ALTER TABLE public.item_revisao_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem o historico de revisao"
ON public.item_revisao_evento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados registram decisoes de revisao"
ON public.item_revisao_evento FOR INSERT TO authenticated WITH CHECK (true);