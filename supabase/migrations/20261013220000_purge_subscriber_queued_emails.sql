-- Purge any queued webinar emails for subscribers / declined modal leads
-- and add RPC to keep subscriber queues clean.

-- 1. Purge existing queued webinar emails for newsletter subscribers
DELETE FROM public.email_sends e
USING public.registrations r
WHERE e.registration_id = r.id
  AND e.status = 'queued'
  AND (r.status = 'subscribed' OR r.profile_type ILIKE '%Newsletter%')
  AND e.template NOT LIKE 's2_%';

-- 2. Create RPC function callable from server automation
CREATE OR REPLACE FUNCTION public.admin_purge_subscriber_queued_emails(p_password text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  PERFORM public.assert_admin(p_password);
  WITH deleted AS (
    DELETE FROM public.email_sends e
    USING public.registrations r
    WHERE e.registration_id = r.id
      AND e.status = 'queued'
      AND (r.status = 'subscribed' OR r.profile_type ILIKE '%Newsletter%')
      AND e.template NOT LIKE 's2_%'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM deleted;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_subscriber_queued_emails(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_subscriber_queued_emails(text) TO anon, service_role;
