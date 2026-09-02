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
