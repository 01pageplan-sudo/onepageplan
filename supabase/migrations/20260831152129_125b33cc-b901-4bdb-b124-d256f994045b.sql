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