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