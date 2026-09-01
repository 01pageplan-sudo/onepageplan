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