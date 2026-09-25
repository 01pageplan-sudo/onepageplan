-- ========================================================
-- SUPABASE COMPLETE SCHEMA SETUP FOR ONE PAGE PLAN
-- Project Ref: oezzpvbixrzmafdgudnj
-- ========================================================

-- --------------------------------------------------------
-- Migration: 20260829033405_27e2eb07-b97f-433e-886d-f388f39555c2.sql
-- --------------------------------------------------------
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone_e164 text NOT NULL,
  whatsapp_consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  voice_consent boolean NOT NULL DEFAULT false,
  voice_consent_at timestamptz,
  profile_type text,
  pain_point text,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','attended','dropped_off','no_show')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  email_sent_at timestamptz,
  email_error text,
  whatsapp_sent_at timestamptz,
  whatsapp_error text,
  raw_webhook jsonb
);

CREATE UNIQUE INDEX registrations_email_session_idx ON public.registrations (lower(email), session_date);
CREATE INDEX registrations_session_date_idx ON public.registrations (session_date);

GRANT ALL ON public.registrations TO service_role;

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Migration: 20260829062515_f3a69f37-7c0d-4721-8d0d-48e3c2f361e7.sql
-- --------------------------------------------------------
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'declined_modal',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT TO anon
  WITH CHECK (true);

-- --------------------------------------------------------
-- Migration: 20260831134723_ea476e77-f2be-4d8b-b609-2f8bcc949612.sql
-- --------------------------------------------------------
CREATE TABLE public.prework_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  email text,
  question text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.prework_questions TO service_role;

ALTER TABLE public.prework_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX prework_questions_created_at_idx ON public.prework_questions (created_at DESC);
CREATE INDEX prework_questions_registration_idx ON public.prework_questions (registration_id);

-- --------------------------------------------------------
-- Migration: 20260831151944_e9342c6d-d2fa-4821-9e5c-04a2777b0a50.sql
-- --------------------------------------------------------
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
VALUES ('admin_password', 'CHANGE_IN_DASHBOARD')
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

-- --------------------------------------------------------
-- Migration: 20260831152129_125b33cc-b901-4bdb-b124-d256f994045b.sql
-- --------------------------------------------------------
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
  SELECT id INTO v_id
  FROM public.registrations
  WHERE email = lower(trim(coalesce(p_email, '')))
    AND session_date = p_session_date
  LIMIT 1;

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

-- --------------------------------------------------------
-- Migration: 20260831154340_c0e81e0c-335e-4bd8-ab98-e6ad76a47762.sql
-- --------------------------------------------------------
-- 1) Remove blanket EXECUTE inherited via PUBLIC, and remove access for signed-in users.
REVOKE ALL ON FUNCTION public.register_attendee(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_prework_question(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscribe_newsletter(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_registrations(text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_webinar_event(text, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_config_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Re-grant EXECUTE ONLY to anon (the publishable key the server uses), since this
--    site has no user accounts. Each function validates its own input; the admin
--    reader additionally requires the stored admin password.
GRANT EXECUTE ON FUNCTION public.register_attendee(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_prework_question(text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_registrations(text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.record_webinar_event(text, date, text, jsonb) TO anon;

GRANT EXECUTE ON FUNCTION public.register_attendee(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_prework_question(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_registrations(text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_webinar_event(text, date, text, jsonb) TO service_role;

-- 3) prework_questions: explicit deny-by-default. No direct table access at all;
--    inserts happen only through public.submit_prework_question (SECURITY DEFINER).
ALTER TABLE public.prework_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prework_questions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.prework_questions TO service_role;

DROP POLICY IF EXISTS "No direct access to prework questions" ON public.prework_questions;
CREATE POLICY "No direct access to prework questions"
  ON public.prework_questions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- --------------------------------------------------------
-- Migration: 20260831180603_d39db2b4-a884-49b2-aa2f-f1cafb22ccb6.sql
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_registration_for_room(p_email text, p_session_date date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.full_name
  FROM public.registrations r
  WHERE lower(r.email) = lower(trim(p_email))
    AND r.session_date = p_session_date
  ORDER BY r.created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_registration_for_room(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_registration_for_room(text, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_registration_for_room(text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_registration_for_room(text, date) TO service_role;

-- --------------------------------------------------------
-- Migration: 20260901114356_b07e243b-c561-4897-8e0c-f3ab0a6bdbc4.sql
-- --------------------------------------------------------
-- ============ settings ============
CREATE TABLE public.email_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  joining_link text NOT NULL DEFAULT '',
  calendar_link text NOT NULL DEFAULT '',
  registration_link text NOT NULL DEFAULT '',
  whatsapp_link text NOT NULL DEFAULT '',
  monthly_checkout_link text NOT NULL DEFAULT '',
  annual_checkout_link text NOT NULL DEFAULT '',
  nurture_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_settings_single_row CHECK (id = 1)
);
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages email settings" ON public.email_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.email_settings (id, joining_link, registration_link)
VALUES (1, 'https://webinar.gg/register/cmthk6y4001kos60ybxfkbc67', 'https://onepageplan.in');

-- ============ tags ============
CREATE TABLE public.lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, tag)
);
GRANT ALL ON public.lead_tags TO service_role;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages lead tags" ON public.lead_tags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ email send log / queue ============
CREATE TABLE public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.registrations(id) ON DELETE CASCADE,
  email text NOT NULL,
  template text NOT NULL,
  session_date date,
  status text NOT NULL DEFAULT 'queued',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  provider_id text,
  error text,
  attempts smallint NOT NULL DEFAULT 0,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_sends_due_idx ON public.email_sends (status, scheduled_at);
CREATE INDEX email_sends_registration_idx ON public.email_sends (registration_id);
CREATE INDEX email_sends_provider_idx ON public.email_sends (provider_id);
GRANT ALL ON public.email_sends TO service_role;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages email sends" ON public.email_sends
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ shared password gate ============
CREATE OR REPLACE FUNCTION public.assert_admin(p_password text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expected text;
BEGIN
  SELECT value INTO v_expected FROM public.app_config WHERE key = 'admin_password';
  IF v_expected IS NULL OR p_password IS NULL OR p_password <> v_expected THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_admin(text) TO anon, service_role;

-- ============ leads ============
CREATE OR REPLACE FUNCTION public.admin_leads(
  p_password text,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid, created_at timestamptz, full_name text, email text, phone_e164 text,
  whatsapp_consent boolean, voice_consent boolean, profile_type text, pain_point text,
  status text, session_date date, utm_source text, landing_path text,
  email_sent_at timestamptz, tags text[], tag_dates jsonb,
  emails_sent integer, emails_opened integer, emails_failed integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  RETURN QUERY
  SELECT r.id, r.created_at, r.full_name, r.email, r.phone_e164,
         r.whatsapp_consent, r.voice_consent, r.profile_type, r.pain_point,
         r.status, r.session_date, r.utm_source, r.landing_path, r.email_sent_at,
         COALESCE(t.tags, ARRAY[]::text[]),
         COALESCE(t.tag_dates, '{}'::jsonb),
         COALESCE(s.sent, 0), COALESCE(s.opened, 0), COALESCE(s.failed, 0)
  FROM public.registrations r
  LEFT JOIN (
    SELECT registration_id, array_agg(tag ORDER BY tag) AS tags,
           jsonb_object_agg(tag, created_at) AS tag_dates
    FROM public.lead_tags GROUP BY registration_id
  ) t ON t.registration_id = r.id
  LEFT JOIN (
    SELECT registration_id,
           count(*) FILTER (WHERE status = 'sent')::int AS sent,
           count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
           count(*) FILTER (WHERE status IN ('failed','bounced'))::int AS failed
    FROM public.email_sends GROUP BY registration_id
  ) s ON s.registration_id = r.id
  WHERE (p_from IS NULL OR r.created_at >= p_from)
    AND (p_to IS NULL OR r.created_at < p_to)
  ORDER BY r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_leads(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_leads(text, timestamptz, timestamptz) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_lead(p_password text, p_registration_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  DELETE FROM public.registrations WHERE id = p_registration_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_lead(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_lead(text, uuid) TO anon, service_role;

-- ============ tags ============
CREATE OR REPLACE FUNCTION public.admin_set_tag(
  p_password text, p_registration_id uuid, p_tag text, p_add boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tag text := lower(trim(coalesce(p_tag, '')));
BEGIN
  PERFORM public.assert_admin(p_password);
  IF v_tag = '' THEN RAISE EXCEPTION 'tag is required'; END IF;
  IF p_add THEN
    INSERT INTO public.lead_tags (registration_id, tag)
    VALUES (p_registration_id, left(v_tag, 40))
    ON CONFLICT (registration_id, tag) DO NOTHING;
    IF v_tag = 'purchased' THEN
      -- stop anything still queued from the sales sequence
      DELETE FROM public.email_sends
      WHERE registration_id = p_registration_id
        AND status = 'queued'
        AND (template LIKE 'nurture_%' OR template = 'post_session');
    END IF;
  ELSE
    DELETE FROM public.lead_tags WHERE registration_id = p_registration_id AND tag = v_tag;
    IF v_tag = 'purchased' THEN
      DELETE FROM public.email_sends
      WHERE registration_id = p_registration_id
        AND status = 'queued'
        AND template LIKE 'post_purchase_%';
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_tag(text, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tag(text, uuid, text, boolean) TO anon, service_role;

-- ============ settings ============
CREATE OR REPLACE FUNCTION public.admin_get_email_settings(p_password text)
RETURNS public.email_settings
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.email_settings;
BEGIN
  PERFORM public.assert_admin(p_password);
  SELECT * INTO v_row FROM public.email_settings WHERE id = 1;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_email_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_email_settings(text) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.admin_save_email_settings(p_password text, p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  UPDATE public.email_settings SET
    joining_link = coalesce(p->>'joining_link', joining_link),
    calendar_link = coalesce(p->>'calendar_link', calendar_link),
    registration_link = coalesce(p->>'registration_link', registration_link),
    whatsapp_link = coalesce(p->>'whatsapp_link', whatsapp_link),
    monthly_checkout_link = coalesce(p->>'monthly_checkout_link', monthly_checkout_link),
    annual_checkout_link = coalesce(p->>'annual_checkout_link', annual_checkout_link),
    nurture_enabled = coalesce((p->>'nurture_enabled')::boolean, nurture_enabled),
    updated_at = now()
  WHERE id = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_email_settings(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_email_settings(text, jsonb) TO anon, service_role;

-- ============ send log reads ============
CREATE OR REPLACE FUNCTION public.admin_email_sends(
  p_password text, p_registration_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_limit integer DEFAULT 500
)
RETURNS TABLE(
  id uuid, registration_id uuid, email text, template text, status text,
  scheduled_at timestamptz, sent_at timestamptz, opened_at timestamptz, error text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  RETURN QUERY
  SELECT e.id, e.registration_id, e.email, e.template, e.status,
         e.scheduled_at, e.sent_at, e.opened_at, e.error
  FROM public.email_sends e
  WHERE (p_registration_id IS NULL OR e.registration_id = p_registration_id)
    AND (p_from IS NULL OR e.created_at >= p_from)
    AND (p_to IS NULL OR e.created_at < p_to)
  ORDER BY coalesce(e.sent_at, e.scheduled_at) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 500), 2000));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_email_sends(text, uuid, timestamptz, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_email_sends(text, uuid, timestamptz, timestamptz, integer) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.admin_email_stats(
  p_password text, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.assert_admin(p_password);
  SELECT jsonb_build_object(
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'queued', count(*) FILTER (WHERE status = 'queued'),
    'opened', count(*) FILTER (WHERE opened_at IS NOT NULL),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'bounced', count(*) FILTER (WHERE status = 'bounced'),
    'complained', count(*) FILTER (WHERE status = 'complained'),
    'people', count(DISTINCT email) FILTER (WHERE status = 'sent'),
    'by_template', coalesce((
      SELECT jsonb_object_agg(template, n) FROM (
        SELECT template, count(*) AS n FROM public.email_sends e2
        WHERE (p_from IS NULL OR e2.created_at >= p_from)
          AND (p_to IS NULL OR e2.created_at < p_to)
          AND e2.status = 'sent'
        GROUP BY template
      ) q
    ), '{}'::jsonb)
  ) INTO v
  FROM public.email_sends e
  WHERE (p_from IS NULL OR e.created_at >= p_from)
    AND (p_to IS NULL OR e.created_at < p_to);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_email_stats(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_email_stats(text, timestamptz, timestamptz) TO anon, service_role;

-- ============ queue writes (password gated, used by the dispatcher too) ============
CREATE OR REPLACE FUNCTION public.queue_emails(p_password text, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  PERFORM public.assert_admin(p_password);
  WITH inserted AS (
    INSERT INTO public.email_sends
      (registration_id, email, template, session_date, scheduled_at, idempotency_key)
    SELECT (x->>'registration_id')::uuid,
           lower(trim(x->>'email')),
           x->>'template',
           nullif(x->>'session_date', '')::date,
           coalesce((x->>'scheduled_at')::timestamptz, now()),
           nullif(x->>'idempotency_key', '')
    FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) AS x
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_emails(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_emails(text, jsonb) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.claim_due_emails(p_password text, p_limit integer DEFAULT 25)
RETURNS TABLE(
  id uuid, registration_id uuid, email text, template text, session_date date,
  full_name text, scheduled_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  RETURN QUERY
  WITH due AS (
    SELECT e.id FROM public.email_sends e
    WHERE e.status = 'queued' AND e.scheduled_at <= now()
    ORDER BY e.scheduled_at
    LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.email_sends e
    SET status = 'sending', claimed_at = now(), attempts = e.attempts + 1
    WHERE e.id IN (SELECT id FROM due)
    RETURNING e.*
  )
  SELECT c.id, c.registration_id, c.email, c.template, c.session_date,
         coalesce(r.full_name, 'there'), c.scheduled_at
  FROM claimed c
  LEFT JOIN public.registrations r ON r.id = c.registration_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_due_emails(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_emails(text, integer) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.mark_email_send(
  p_password text, p_id uuid, p_status text,
  p_provider_id text DEFAULT NULL, p_error text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  UPDATE public.email_sends SET
    status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    provider_id = coalesce(p_provider_id, provider_id),
    error = CASE WHEN p_status = 'sent' THEN NULL ELSE left(coalesce(p_error, error), 500) END
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_email_send(text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_email_send(text, uuid, text, text, text) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.record_email_provider_event(
  p_password text, p_provider_id text, p_email text, p_event text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_event text := lower(coalesce(p_event, ''));
BEGIN
  PERFORM public.assert_admin(p_password);
  SELECT id INTO v_id FROM public.email_sends
  WHERE (p_provider_id IS NOT NULL AND provider_id = p_provider_id)
     OR (p_provider_id IS NULL AND email = lower(trim(coalesce(p_email, ''))))
  ORDER BY coalesce(sent_at, created_at) DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN false; END IF;

  IF v_event LIKE '%opened%' THEN
    UPDATE public.email_sends SET opened_at = coalesce(opened_at, now()) WHERE id = v_id;
  ELSIF v_event LIKE '%bounced%' THEN
    UPDATE public.email_sends SET status = 'bounced' WHERE id = v_id;
  ELSIF v_event LIKE '%complain%' THEN
    UPDATE public.email_sends SET status = 'complained' WHERE id = v_id;
  ELSIF v_event LIKE '%delivered%' THEN
    UPDATE public.email_sends SET status = 'sent' WHERE id = v_id AND status <> 'bounced';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_email_provider_event(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_email_provider_event(text, text, text, text) TO anon, service_role;

-- --------------------------------------------------------
-- Migration: 20260901115124_54d09d1e-d64c-4e60-9fbf-297d2c75722d.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- Migration: 20260901115329_add9fee2-5888-4858-987d-c072115718b4.sql
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_leads(
  p_password text,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid, created_at timestamptz, full_name text, email text, phone_e164 text,
  whatsapp_consent boolean, voice_consent boolean, profile_type text, pain_point text,
  status text, session_date date, utm_source text, landing_path text,
  email_sent_at timestamptz, tags text[], tag_dates jsonb,
  emails_sent integer, emails_opened integer, emails_failed integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  RETURN QUERY
  SELECT r.id, r.created_at, r.full_name, r.email, r.phone_e164,
         r.whatsapp_consent, r.voice_consent, r.profile_type, r.pain_point,
         r.status, r.session_date, r.utm_source, r.landing_path, r.email_sent_at,
         COALESCE(t.tags, ARRAY[]::text[]),
         COALESCE(t.tag_dates, '{}'::jsonb),
         COALESCE(s.sent, 0), COALESCE(s.opened, 0), COALESCE(s.failed, 0)
  FROM public.registrations r
  LEFT JOIN (
    SELECT lt.registration_id, array_agg(lt.tag ORDER BY lt.tag) AS tags,
           jsonb_object_agg(lt.tag, lt.created_at) AS tag_dates
    FROM public.lead_tags lt GROUP BY lt.registration_id
  ) t ON t.registration_id = r.id
  LEFT JOIN (
    SELECT es.registration_id,
           count(*) FILTER (WHERE es.status = 'sent')::int AS sent,
           count(*) FILTER (WHERE es.opened_at IS NOT NULL)::int AS opened,
           count(*) FILTER (WHERE es.status IN ('failed','bounced'))::int AS failed
    FROM public.email_sends es GROUP BY es.registration_id
  ) s ON s.registration_id = r.id
  WHERE (p_from IS NULL OR r.created_at >= p_from)
    AND (p_to IS NULL OR r.created_at < p_to)
  ORDER BY r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_leads(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_leads(text, timestamptz, timestamptz) TO anon, service_role;

-- --------------------------------------------------------
-- Migration: 20260901124732_71736e0e-f11d-4df7-a91f-73f5c8dc991e.sql
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_due_emails(p_password text, p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, registration_id uuid, email text, template text, session_date date, full_name text, scheduled_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_admin(p_password);
  RETURN QUERY
  WITH due AS (
    SELECT e.id AS send_id FROM public.email_sends e
    WHERE e.status = 'queued' AND e.scheduled_at <= now()
    ORDER BY e.scheduled_at
    LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.email_sends e
    SET status = 'sending', claimed_at = now(), attempts = e.attempts + 1
    WHERE e.id IN (SELECT d.send_id FROM due d)
    RETURNING e.*
  )
  SELECT c.id, c.registration_id, c.email, c.template, c.session_date,
         coalesce(r.full_name, 'there'), c.scheduled_at
  FROM claimed c
  LEFT JOIN public.registrations r ON r.id = c.registration_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_due_emails(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_emails(text, integer) TO anon, authenticated, service_role;

-- --------------------------------------------------------
-- Migration: 20260901132003_d0df1463-3e2e-41b7-b767-821ba01f0980.sql
-- --------------------------------------------------------
create table if not exists public.email_template_overrides (
  template_key text primary key,
  subject text,
  heading text,
  body text,
  updated_at timestamptz not null default now()
);

grant all on public.email_template_overrides to service_role;
alter table public.email_template_overrides enable row level security;

drop policy if exists "service role manages template overrides" on public.email_template_overrides;
create policy "service role manages template overrides"
  on public.email_template_overrides for all to service_role using (true) with check (true);

create or replace function public.admin_get_templates(p_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_admin(p_password);
  select coalesce(jsonb_object_agg(t.template_key, jsonb_build_object(
    'subject', t.subject, 'heading', t.heading, 'body', t.body, 'updated_at', t.updated_at
  )), '{}'::jsonb)
  into result
  from public.email_template_overrides t;
  return result;
end;
$$;

create or replace function public.admin_save_template(
  p_password text,
  p_key text,
  p_subject text,
  p_heading text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_password);
  insert into public.email_template_overrides (template_key, subject, heading, body, updated_at)
  values (p_key, nullif(btrim(p_subject), ''), nullif(btrim(p_heading), ''), nullif(btrim(p_body), ''), now())
  on conflict (template_key) do update
    set subject = excluded.subject,
        heading = excluded.heading,
        body = excluded.body,
        updated_at = now();
end;
$$;

create or replace function public.admin_reset_template(p_password text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_password);
  delete from public.email_template_overrides where template_key = p_key;
end;
$$;

revoke all on function public.admin_get_templates(text) from public;
revoke all on function public.admin_save_template(text, text, text, text, text) from public;
revoke all on function public.admin_reset_template(text, text) from public;
grant execute on function public.admin_get_templates(text) to anon, authenticated, service_role;
grant execute on function public.admin_save_template(text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.admin_reset_template(text, text) to anon, authenticated, service_role;

-- --------------------------------------------------------
-- Migration: 20260901141531_469d45aa-95a3-4d6c-87bd-129b50cfbfa3.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- Migration: 20260901143007_9bd8d630-1653-4653-a415-8e3dcb4d939a.sql
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_webinar_call(
  p_email text,
  p_full_name text,
  p_webinar_id text,
  p_request_url text,
  p_request_body jsonb,
  p_response_status integer,
  p_response_body text,
  p_outcome text,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.webinar_api_logs (
    kind, email, full_name, webinar_id, request_url, request_body,
    response_status, response_body, outcome, error
  ) VALUES (
    'join-token',
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    nullif(btrim(coalesce(p_webinar_id, '')), ''),
    p_request_url,
    p_request_body,
    p_response_status,
    left(coalesce(p_response_body, ''), 8000),
    coalesce(nullif(btrim(p_outcome), ''), 'unknown'),
    left(coalesce(p_error, ''), 2000)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.log_webinar_call(text, text, text, text, jsonb, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_webinar_call(text, text, text, text, jsonb, integer, text, text, text) TO anon, authenticated, service_role;

-- --------------------------------------------------------
-- Migration: 20260901144712_b5d85a43-85fd-418f-8daa-fdf08c3ae11c.sql
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_registration_details_for_room(p_email text, p_session_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('full_name', r.full_name, 'phone_e164', coalesce(r.phone_e164, ''))
  FROM public.registrations r
  WHERE lower(r.email) = lower(trim(p_email))
    AND r.session_date = p_session_date
  ORDER BY r.created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_registration_details_for_room(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_registration_details_for_room(text, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_registration_details_for_room(text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_registration_details_for_room(text, date) TO service_role;

-- --------------------------------------------------------
-- Migration: 20260902221500_update_newsletter_subscribers.sql
-- --------------------------------------------------------
-- Add full_name column to newsletter_subscribers if it does not exist
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS full_name text DEFAULT '';

-- Update subscribe_newsletter RPC function
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(
  p_email text,
  p_source text DEFAULT 'declined_modal',
  p_full_name text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_full_name, ''));
BEGIN
  IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' THEN
    RAISE EXCEPTION 'valid email required';
  END IF;

  INSERT INTO public.newsletter_subscribers (email, source, full_name)
  VALUES (v_email, coalesce(nullif(trim(p_source), ''), 'declined_modal'), v_name)
  ON CONFLICT (email) DO UPDATE SET
    full_name = CASE WHEN v_name <> '' THEN v_name ELSE public.newsletter_subscribers.full_name END,
    source = EXCLUDED.source;

  INSERT INTO public.registrations (
    full_name, email, phone_e164, whatsapp_consent, voice_consent,
    profile_type, pain_point, status, session_date, utm_source
  )
  VALUES (
    coalesce(nullif(v_name, ''), 'Subscriber'),
    v_email,
    '',
    false,
    false,
    'Newsletter (Declined Modal)',
    'I want someone to tell me which stock or fund to buy',
    'subscribed',
    CURRENT_DATE,
    coalesce(nullif(trim(p_source), ''), 'declined_modal')
  )
  ON CONFLICT (email, session_date) DO NOTHING;
END;
$$;

-- Migrate existing newsletter subscribers into registrations table so admin_leads RPC reads them
INSERT INTO public.registrations (
  full_name, email, phone_e164, whatsapp_consent, voice_consent,
  profile_type, pain_point, status, session_date, utm_source, created_at
)
SELECT
  coalesce(nullif(ns.full_name, ''), 'Subscriber'),
  ns.email,
  '',
  false,
  false,
  'Newsletter (Declined Modal)',
  'I want someone to tell me which stock or fund to buy',
  'subscribed',
  ns.created_at::date,
  coalesce(nullif(ns.source, ''), 'declined_modal'),
  ns.created_at
FROM public.newsletter_subscribers ns
ON CONFLICT (email, session_date) DO NOTHING;


-- --------------------------------------------------------
-- Migration: 20260906120500_update_email_settings_joining_link.sql
-- --------------------------------------------------------
-- Update the joining link in email_settings from webinar.gg to onepageplan.in/room
UPDATE public.email_settings
SET joining_link = 'https://onepageplan.in/room'
WHERE joining_link LIKE '%webinar.gg%' OR joining_link = '' OR joining_link IS NULL;


-- --------------------------------------------------------
-- Migration: 20260918180000_payments_and_whatsapp_and_webinar.sql
-- --------------------------------------------------------
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


