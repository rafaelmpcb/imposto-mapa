CREATE TABLE public.case_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  from_stage case_stage,
  to_stage case_stage NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX case_stage_events_case_idx ON public.case_stage_events (case_id, changed_at);

GRANT SELECT, INSERT ON public.case_stage_events TO authenticated;
GRANT ALL ON public.case_stage_events TO service_role;

ALTER TABLE public.case_stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members read case stage events" ON public.case_stage_events
FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.log_case_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.case_stage_events (case_id, from_stage, to_stage, changed_at)
    VALUES (NEW.id, NULL, NEW.stage, COALESCE(NEW.created_at, now()));
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.case_stage_events (case_id, from_stage, to_stage, changed_at)
    VALUES (NEW.id, OLD.stage, NEW.stage, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cases_log_stage_insert
AFTER INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.log_case_stage_change();

CREATE TRIGGER cases_log_stage_update
AFTER UPDATE OF stage ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.log_case_stage_change();

INSERT INTO public.case_stage_events (case_id, from_stage, to_stage, changed_at)
SELECT c.id, NULL, c.stage, c.created_at FROM public.cases c;