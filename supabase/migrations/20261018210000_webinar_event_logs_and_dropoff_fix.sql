-- ==============================================================================
-- Webinar Event Logs, Session History & Drop-off Recording Fix
-- ==============================================================================

-- 1. Create webinar_event_logs table if not exists
CREATE TABLE IF NOT EXISTS public.webinar_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  email TEXT,
  event_type TEXT NOT NULL, -- 'join', 'leave', 'chat', 'poll', 'qna', 'drop_off'
  event_data JSONB DEFAULT '{}'::jsonb,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webinar_event_logs_session ON public.webinar_event_logs(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_webinar_event_logs_email ON public.webinar_event_logs(lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_webinar_event_logs_webinar_id ON public.webinar_event_logs(webinar_id);

ALTER TABLE public.webinar_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all on webinar_event_logs" ON public.webinar_event_logs;
DROP POLICY IF EXISTS "Service role full access on webinar_event_logs" ON public.webinar_event_logs;

CREATE POLICY "allow all on webinar_event_logs" ON public.webinar_event_logs
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON public.webinar_event_logs TO anon, authenticated, service_role;

-- 2. Create webinar_session_history table if not exists
CREATE TABLE IF NOT EXISTS public.webinar_session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id TEXT NOT NULL,
  session_date DATE NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0,
  peak_users INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  raw_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webinar_session_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all on webinar_session_history" ON public.webinar_session_history;
DROP POLICY IF EXISTS "Service role full access on webinar_session_history" ON public.webinar_session_history;

CREATE POLICY "allow all on webinar_session_history" ON public.webinar_session_history
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON public.webinar_session_history TO anon, authenticated, service_role;

-- 3. Update record_webinar_event to support fallback matching by email if session_date has timezone/date drift
CREATE OR REPLACE FUNCTION public.record_webinar_event(
  p_email text,
  p_session_date date,
  p_status text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Try exact match on email and session_date
  SELECT id INTO v_id
  FROM public.registrations
  WHERE email = lower(trim(coalesce(p_email, '')))
    AND session_date = p_session_date
  LIMIT 1;

  -- 2. Fallback: If no exact date match, match the most recent registration for this email
  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.registrations
    WHERE email = lower(trim(coalesce(p_email, '')))
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.registrations
  SET raw_webhook = p_payload,
      status = coalesce(nullif(trim(coalesce(p_status, '')), ''), status)
  WHERE id = v_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_webinar_event(text, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_webinar_event(text, date, text, jsonb) TO anon, authenticated, service_role;
