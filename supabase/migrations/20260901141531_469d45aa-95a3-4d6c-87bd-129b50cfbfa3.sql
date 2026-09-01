CREATE TABLE public.webinar_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'join-token',
  email text,
  full_name text,
  webinar_id text,
  request_url text,
  request_body jsonb,
  response_status integer,
  response_body text,
  outcome text NOT NULL,
  error text
);
CREATE INDEX webinar_api_logs_created_idx ON public.webinar_api_logs (created_at DESC);
GRANT ALL ON public.webinar_api_logs TO service_role;
ALTER TABLE public.webinar_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages webinar api logs" ON public.webinar_api_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.admin_webinar_logs(p_password text, p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, created_at timestamptz, kind text, email text, full_name text,
  webinar_id text, request_url text, request_body jsonb,
  response_status integer, response_body text, outcome text, error text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  RETURN QUERY
  SELECT l.id, l.created_at, l.kind, l.email, l.full_name, l.webinar_id, l.request_url,
         l.request_body, l.response_status, l.response_body, l.outcome, l.error
  FROM public.webinar_api_logs l
  ORDER BY l.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_webinar_logs(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_webinar_logs(text, integer) TO anon, service_role;