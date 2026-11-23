-- Contador de chamadas por minuto para limitar rotas públicas de API
-- (ex.: /api/public/sdr-simulacao). Só acessado pelo service_role no
-- servidor; sem policies para authenticated/anon de propósito.
CREATE TABLE IF NOT EXISTS public.api_rate_limit (
  bucket text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_rate_limit ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.api_rate_limit TO service_role;

CREATE OR REPLACE FUNCTION public.increment_rate_limit(p_bucket text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.api_rate_limit (bucket, count, updated_at)
  VALUES (p_bucket, 1, now())
  ON CONFLICT (bucket) DO UPDATE
    SET count = public.api_rate_limit.count + 1, updated_at = now()
  RETURNING count;
$$;
REVOKE ALL ON FUNCTION public.increment_rate_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(text) TO service_role;
