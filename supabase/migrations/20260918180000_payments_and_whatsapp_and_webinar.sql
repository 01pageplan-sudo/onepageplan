-- ==============================================================================
-- 1. PAYMENTS TABLE & COURSE ACCESS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'captured', -- 'captured', 'refunded', 'failed'
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_email ON public.payments (lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_payments_rzp_order ON public.payments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on payments"
  ON public.payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================================================
-- 2. ENHANCE EMAIL_SENDS WITH FULL LIFECYCLE EVENT TRACKING
-- ==============================================================================
ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_url TEXT,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_sends_clicked_at ON public.email_sends(clicked_at);
CREATE INDEX IF NOT EXISTS idx_email_sends_delivered_at ON public.email_sends(delivered_at);

-- ==============================================================================
-- 3. WHATSAPP_SENDS TABLE WITH FULL LIFECYCLE EVENT TRACKING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  message_key TEXT NOT NULL,
  occurrence TEXT NOT NULL DEFAULT 'once',
  phone TEXT NOT NULL,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'sending', -- 'sending', 'sent', 'delivered', 'read', 'clicked', 'failed', 'skipped'
  provider_message_id TEXT, -- Meta WAMID
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sends_dedupe
  ON public.whatsapp_sends(registration_id, message_key, occurrence);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_phone ON public.whatsapp_sends(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_status ON public.whatsapp_sends(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_wamid ON public.whatsapp_sends(provider_message_id);

ALTER TABLE public.whatsapp_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_sends"
  ON public.whatsapp_sends FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================================================
-- 4. HISTORICAL WEBINAR LOGS & SESSION ARCHIVE TABLES
-- ==============================================================================
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

CREATE POLICY "Service role full access on webinar_event_logs"
  ON public.webinar_event_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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

CREATE POLICY "Service role full access on webinar_session_history"
  ON public.webinar_session_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. RPC FUNCTIONS
-- ==============================================================================

-- 5.1 Atomically Record Payment & Apply 'purchased' Tag
CREATE OR REPLACE FUNCTION public.record_successful_payment(
  p_email TEXT,
  p_amount NUMERIC,
  p_order_id TEXT,
  p_payment_id TEXT,
  p_signature TEXT,
  p_notes JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(p_email));
  v_reg_id UUID;
  v_payment_id UUID;
BEGIN
  -- Look up matching registration
  SELECT id INTO v_reg_id
  FROM public.registrations
  WHERE email = v_clean_email
  ORDER BY created_at DESC
  LIMIT 1;

  -- Insert payment record
  INSERT INTO public.payments (
    registration_id, email, amount, currency,
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    status, notes
  ) VALUES (
    v_reg_id, v_clean_email, p_amount, 'INR',
    p_order_id, p_payment_id, p_signature,
    'captured', p_notes
  )
  ON CONFLICT (razorpay_payment_id) DO UPDATE
    SET status = 'captured', updated_at = now()
  RETURNING id INTO v_payment_id;

  -- If registration exists, update status and apply tag
  IF v_reg_id IS NOT NULL THEN
    UPDATE public.registrations
    SET status = 'purchased'
    WHERE id = v_reg_id;

    -- Add purchased tag
    INSERT INTO public.lead_tags (registration_id, tag)
    VALUES (v_reg_id, 'purchased')
    ON CONFLICT DO NOTHING;

    -- Remove any pending nurture emails (stops sales pitch immediately)
    DELETE FROM public.email_sends
    WHERE registration_id = v_reg_id
      AND status = 'pending'
      AND template LIKE 'nurture%';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'registration_id', v_reg_id
  );
END;
$$;

-- 5.2 Check if user has course access
CREATE OR REPLACE FUNCTION public.check_course_access(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.payments
    WHERE lower(trim(email)) = lower(trim(p_email))
      AND status = 'captured'
  );
END;
$$;

-- 5.3 Record WhatsApp Status / Click Events from Meta Webhook
CREATE OR REPLACE FUNCTION public.record_whatsapp_event(
  p_wamid TEXT,
  p_status TEXT,
  p_timestamp TIMESTAMPTZ DEFAULT now(),
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_status TEXT := lower(trim(p_status));
BEGIN
  IF p_wamid IS NULL OR trim(p_wamid) = '' THEN
    RETURN false;
  END IF;

  UPDATE public.whatsapp_sends
  SET
    status = v_clean_status,
    delivered_at = CASE WHEN v_clean_status = 'delivered' AND delivered_at IS NULL THEN p_timestamp ELSE delivered_at END,
    read_at = CASE WHEN v_clean_status = 'read' AND read_at IS NULL THEN p_timestamp ELSE read_at END,
    clicked_at = CASE WHEN v_clean_status = 'clicked' AND clicked_at IS NULL THEN p_timestamp ELSE clicked_at END,
    error = COALESCE(p_error, error),
    updated_at = now()
  WHERE provider_message_id = trim(p_wamid);

  RETURN FOUND;
END;
$$;

-- 5.4 Admin WhatsApp Dashboard RPC
CREATE OR REPLACE FUNCTION public.admin_get_whatsapp_dashboard(p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_sent INTEGER;
  v_delivered INTEGER;
  v_read INTEGER;
  v_clicked INTEGER;
  v_failed INTEGER;
  v_recent JSONB;
BEGIN
  PERFORM public.assert_admin(p_password);

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('sent', 'delivered', 'read', 'clicked')),
         count(*) FILTER (WHERE status IN ('delivered', 'read', 'clicked')),
         count(*) FILTER (WHERE status IN ('read', 'clicked')),
         count(*) FILTER (WHERE status = 'clicked'),
         count(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_sent, v_delivered, v_read, v_clicked, v_failed
  FROM public.whatsapp_sends;

  SELECT coalesce(jsonb_agg(sub), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT w.id, w.phone, w.template_name, w.message_key, w.status,
           w.provider_message_id, w.error, w.sent_at, w.delivered_at, w.read_at, w.clicked_at, w.created_at,
           r.full_name AS attendee_name
    FROM public.whatsapp_sends w
    LEFT JOIN public.registrations r ON r.id = w.registration_id
    ORDER BY w.created_at DESC
    LIMIT 100
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'sent', v_sent,
    'delivered', v_delivered,
    'read', v_read,
    'clicked', v_clicked,
    'failed', v_failed,
    'delivered_rate', CASE WHEN v_sent > 0 THEN round((v_delivered::numeric / v_sent::numeric) * 100, 1) ELSE 0 END,
    'read_rate', CASE WHEN v_delivered > 0 THEN round((v_read::numeric / v_delivered::numeric) * 100, 1) ELSE 0 END,
    'clicked_rate', CASE WHEN v_delivered > 0 THEN round((v_clicked::numeric / v_delivered::numeric) * 100, 1) ELSE 0 END,
    'recent_sends', v_recent
  );
END;
$$;

-- 5.5 Admin Historical Webinar Logs RPC
CREATE OR REPLACE FUNCTION public.admin_get_historical_webinar_logs(
  p_password TEXT,
  p_session_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessions JSONB;
  v_events JSONB;
BEGIN
  PERFORM public.assert_admin(p_password);

  -- Available distinct session dates with aggregated counts
  SELECT coalesce(jsonb_agg(sub), '[]'::jsonb)
  INTO v_sessions
  FROM (
    SELECT session_date,
           count(*) as total_events,
           count(DISTINCT email) as unique_attendees,
           count(*) FILTER (WHERE event_type = 'join') as joins,
           count(*) FILTER (WHERE event_type = 'leave') as leaves
    FROM public.webinar_event_logs
    GROUP BY session_date
    ORDER BY session_date DESC
  ) sub;

  -- Events for requested session date or latest session date
  SELECT coalesce(jsonb_agg(ev), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT id, webinar_id, session_date, email, event_type, duration_seconds, event_data, created_at
    FROM public.webinar_event_logs
    WHERE (p_session_date IS NULL OR session_date = p_session_date)
    ORDER BY created_at DESC
    LIMIT 150
  ) ev;

  RETURN jsonb_build_object(
    'sessions', v_sessions,
    'events', v_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_successful_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_successful_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, service_role;

REVOKE ALL ON FUNCTION public.check_course_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_course_access(TEXT) TO anon, service_role;

REVOKE ALL ON FUNCTION public.record_whatsapp_event(TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_event(TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, service_role;

REVOKE ALL ON FUNCTION public.admin_get_whatsapp_dashboard(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_whatsapp_dashboard(TEXT) TO anon, service_role;

REVOKE ALL ON FUNCTION public.admin_get_historical_webinar_logs(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_historical_webinar_logs(TEXT, DATE) TO anon, service_role;

-- ==============================================================================
-- 6. COURSE DISCUSSION & LESSON COMMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.course_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_comments_lesson ON public.course_comments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_comments_created ON public.course_comments(created_at ASC);

ALTER TABLE public.course_comments ENABLE ROW LEVEL SECURITY;

-- Allow reading comments for public/authenticated users
CREATE POLICY "Public read course comments"
  ON public.course_comments FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- Allow inserting comments for anon and service_role
CREATE POLICY "Public insert course comments"
  ON public.course_comments FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);
