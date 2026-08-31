CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages app config"
  ON public.app_config FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.app_config (key, value)
VALUES ('admin_password', '3Qt@fQMkD6x')
ON CONFLICT (key) DO NOTHING;

-- Save or update a registration for the current session.
CREATE OR REPLACE FUNCTION public.register_attendee(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p->>'email'));
  v_session date := (p->>'session_date')::date;
  v_phone text := coalesce(p->>'phone_e164', '');
  v_existing public.registrations;
  v_id uuid;
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_session IS NULL THEN
    RAISE EXCEPTION 'email and session_date are required';
  END IF;

  SELECT * INTO v_existing
  FROM public.registrations
  WHERE email = v_email AND session_date = v_session
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.registrations SET
      full_name = coalesce(nullif(trim(p->>'full_name'), ''), full_name),
      phone_e164 = CASE WHEN v_phone <> '' THEN v_phone ELSE phone_e164 END,
      whatsapp_consent = coalesce((p->>'whatsapp_consent')::boolean, false),
      consent_at = CASE
        WHEN coalesce((p->>'whatsapp_consent')::boolean, false)
          THEN coalesce(consent_at, now())
        ELSE consent_at END,
      voice_consent = coalesce((p->>'voice_consent')::boolean, false) OR voice_consent,
      voice_consent_at = CASE
        WHEN coalesce((p->>'voice_consent')::boolean, false) OR voice_consent
          THEN coalesce(voice_consent_at, now())
        ELSE NULL END,
      profile_type = coalesce(p->>'profile_type', profile_type),
      pain_point = coalesce(p->>'pain_point', pain_point)
    WHERE id = v_existing.id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  INSERT INTO public.registrations (
    full_name, email, phone_e164, whatsapp_consent, consent_at,
    voice_consent, voice_consent_at, profile_type, pain_point, session_date,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, landing_path
  ) VALUES (
    coalesce(nullif(trim(p->>'full_name'), ''), 'Guest'),
    v_email,
    v_phone,
    coalesce((p->>'whatsapp_consent')::boolean, false),
    CASE WHEN coalesce((p->>'whatsapp_consent')::boolean, false) THEN now() ELSE NULL END,
    coalesce((p->>'voice_consent')::boolean, false),
    CASE WHEN coalesce((p->>'voice_consent')::boolean, false) THEN now() ELSE NULL END,
    p->>'profile_type',
    p->>'pain_point',
    v_session,
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign',
    p->>'utm_content', p->>'utm_term',
    p->>'referrer', p->>'landing_path'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_attendee(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_attendee(jsonb) TO anon, authenticated, service_role;

-- Record delivery outcome for email / whatsapp.
CREATE OR REPLACE FUNCTION public.mark_registration_delivery(
  p_id uuid,
  p_channel text,
  p_sent boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_channel = 'email' THEN
    UPDATE public.registrations
    SET email_sent_at = CASE WHEN p_sent THEN now() ELSE email_sent_at END,
        email_error = CASE WHEN p_sent THEN NULL ELSE left(coalesce(p_error, 'unknown'), 500) END
    WHERE id = p_id;
  ELSIF p_channel = 'whatsapp' THEN
    UPDATE public.registrations
    SET whatsapp_sent_at = CASE WHEN p_sent THEN now() ELSE whatsapp_sent_at END,
        whatsapp_error = CASE WHEN p_sent THEN NULL ELSE left(coalesce(p_error, 'unknown'), 500) END
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) TO anon, authenticated, service_role;

-- Save a pre-work question.
CREATE OR REPLACE FUNCTION public.submit_prework_question(
  p_question text,
  p_registration_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question text := left(trim(coalesce(p_question, '')), 500);
BEGIN
  IF v_question = '' THEN
    RAISE EXCEPTION 'question is required';
  END IF;

  INSERT INTO public.prework_questions (question, registration_id, email)
  VALUES (v_question, p_registration_id, nullif(lower(trim(coalesce(p_email, ''))), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_prework_question(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_prework_question(text, uuid, text) TO anon, authenticated, service_role;

-- Save a newsletter subscriber.
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(
  p_email text,
  p_source text DEFAULT 'declined_modal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' THEN
    RAISE EXCEPTION 'valid email required';
  END IF;

  INSERT INTO public.newsletter_subscribers (email, source)
  VALUES (v_email, coalesce(nullif(trim(p_source), ''), 'declined_modal'));
END;
$$;

REVOKE ALL ON FUNCTION public.subscribe_newsletter(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, text) TO anon, authenticated, service_role;

-- Admin list, password gated.
CREATE OR REPLACE FUNCTION public.admin_registrations(
  p_password text,
  p_session_date date
)
RETURNS TABLE (
  created_at timestamptz,
  full_name text,
  email text,
  phone_e164 text,
  whatsapp_consent boolean,
  voice_consent boolean,
  profile_type text,
  pain_point text,
  status text,
  email_sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected text;
BEGIN
  SELECT value INTO v_expected FROM public.app_config WHERE key = 'admin_password';

  IF v_expected IS NULL OR p_password IS NULL OR p_password <> v_expected THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT r.created_at, r.full_name, r.email, r.phone_e164, r.whatsapp_consent,
         r.voice_consent, r.profile_type, r.pain_point, r.status, r.email_sent_at
  FROM public.registrations r
  WHERE r.session_date = p_session_date
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_registrations(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_registrations(text, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.app_config_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_config_updated_at ON public.app_config;
CREATE TRIGGER app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.app_config_touch_updated_at();