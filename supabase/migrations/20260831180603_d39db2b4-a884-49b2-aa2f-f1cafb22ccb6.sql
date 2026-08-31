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