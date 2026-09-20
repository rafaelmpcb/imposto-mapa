CREATE POLICY "Team members manage office config" ON public.office_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_config TO authenticated;
GRANT ALL ON public.office_config TO service_role;