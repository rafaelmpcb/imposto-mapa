ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS deal_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_model text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS win_probability integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commercial_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS next_action_title text,
  ADD COLUMN IF NOT EXISTS next_action_date timestamp with time zone;

CREATE TABLE public.case_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_contacts TO authenticated;
GRANT ALL ON public.case_contacts TO service_role;
ALTER TABLE public.case_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage case contacts" ON public.case_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.case_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'nota',
  title text NOT NULL,
  body text,
  happened_at timestamp with time zone NOT NULL DEFAULT now(),
  author_id uuid,
  author_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_interactions TO authenticated;
GRANT ALL ON public.case_interactions TO service_role;
ALTER TABLE public.case_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage case interactions" ON public.case_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_case_contacts_case_id ON public.case_contacts(case_id);
CREATE INDEX idx_case_interactions_case_id ON public.case_interactions(case_id);
CREATE INDEX idx_case_interactions_happened_at ON public.case_interactions(happened_at DESC);

CREATE TRIGGER update_case_contacts_updated_at BEFORE UPDATE ON public.case_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_case_interactions_updated_at BEFORE UPDATE ON public.case_interactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();