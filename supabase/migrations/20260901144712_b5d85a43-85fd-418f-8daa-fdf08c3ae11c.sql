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