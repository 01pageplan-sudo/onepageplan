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