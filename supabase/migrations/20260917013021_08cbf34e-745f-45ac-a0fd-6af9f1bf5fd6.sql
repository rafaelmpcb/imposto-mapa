GRANT SELECT ON public.tax_config TO anon, authenticated;

CREATE POLICY "Tax config is publicly readable"
  ON public.tax_config
  FOR SELECT
  TO anon, authenticated
  USING (true);