-- lovable-cron-fallback-reviewed: 144 runs/day; session reminders must land at fixed clock times (Sat 18:00, 19:00, 19:20 IST), so no row-change trigger can express the delay; 10-minute granularity is the coarsest that keeps those emails on time.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

INSERT INTO public.app_config (key, value)
VALUES ('cron_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value)
VALUES ('dispatch_url', 'https://onepageplan.in/api/public/email-dispatch')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT exists (
    SELECT 1 FROM public.app_config
    WHERE key = 'cron_secret' AND value = coalesce(p_secret, '')
  );
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.dispatch_due_emails()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_url text; v_secret text;
BEGIN
  SELECT value INTO v_url FROM public.app_config WHERE key = 'dispatch_url';
  SELECT value INTO v_secret FROM public.app_config WHERE key = 'cron_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_due_emails() FROM PUBLIC;

SELECT cron.schedule('dispatch-due-emails', '*/10 * * * *', $$SELECT public.dispatch_due_emails();$$);