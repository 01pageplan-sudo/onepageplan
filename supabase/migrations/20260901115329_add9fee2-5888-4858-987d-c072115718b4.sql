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