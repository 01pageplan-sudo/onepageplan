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