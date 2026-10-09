-- Migration: 20261009140000_messaging_and_delivery_fixes.sql
-- Description: Fix RLS for commerce_settings & message_templates, add messaging controls, and fix email delivery status tracking

-- 1. Ensure commerce_settings columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'commerce_settings' AND column_name = 'messaging_test_mode'
  ) THEN
    ALTER TABLE public.commerce_settings 
      ADD COLUMN IF NOT EXISTS messaging_test_mode BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS test_recipient_email TEXT DEFAULT 'dodhia.milan@gmail.com',
      ADD COLUMN IF NOT EXISTS test_recipient_phone TEXT DEFAULT '+919820000000',
      ADD COLUMN IF NOT EXISTS resend_from_email TEXT DEFAULT 'connect@onepageplan.in',
      ADD COLUMN IF NOT EXISTS resend_from_name TEXT DEFAULT 'Milan Dodhia';
  END IF;
END $$;

-- 2. Allow anon to read commerce_settings (so admin panel anon client can read test mode and settings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'commerce_settings' AND policyname = 'anon read commerce_settings'
  ) THEN
    CREATE POLICY "anon read commerce_settings" ON public.commerce_settings
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 3. Ensure message_templates exists and allow anon to read
CREATE TABLE IF NOT EXISTS public.message_templates (
  key TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  meta_template_name TEXT,
  meta_language TEXT DEFAULT 'en',
  meta_approval_status TEXT DEFAULT 'APPROVED',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'anon read message_templates'
  ) THEN
    CREATE POLICY "anon read message_templates" ON public.message_templates
      FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'service_role all message_templates'
  ) THEN
    CREATE POLICY "service_role all message_templates" ON public.message_templates
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Fix record_email_provider_event to accurately capture 'delivered' and 'opened' statuses and match by email fallback
CREATE OR REPLACE FUNCTION public.record_email_provider_event(
  p_password text, p_provider_id text, p_email text, p_event text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_event text := lower(coalesce(p_event, ''));
BEGIN
  PERFORM public.assert_admin(p_password);

  -- 1. Try finding by provider_id
  IF p_provider_id IS NOT NULL AND length(trim(p_provider_id)) > 0 THEN
    SELECT id INTO v_id FROM public.email_sends
    WHERE provider_id = trim(p_provider_id)
    ORDER BY coalesce(sent_at, created_at) DESC LIMIT 1;
  END IF;

  -- 2. Fall back to matching by recipient email
  IF v_id IS NULL AND p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_id FROM public.email_sends
    WHERE email = lower(trim(p_email))
    ORDER BY coalesce(sent_at, created_at) DESC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN RETURN false; END IF;

  -- Store provider_id if it was missing
  IF p_provider_id IS NOT NULL THEN
    UPDATE public.email_sends SET provider_id = coalesce(provider_id, trim(p_provider_id)) WHERE id = v_id;
  END IF;

  -- Update appropriate event status
  IF v_event LIKE '%open%' THEN
    UPDATE public.email_sends
    SET status = 'opened',
        opened_at = coalesce(opened_at, now())
    WHERE id = v_id;
  ELSIF v_event LIKE '%click%' THEN
    UPDATE public.email_sends
    SET status = 'clicked'
    WHERE id = v_id;
  ELSIF v_event LIKE '%deliver%' THEN
    UPDATE public.email_sends
    SET status = 'delivered'
    WHERE id = v_id AND status NOT IN ('opened', 'clicked', 'bounced', 'complained');
  ELSIF v_event LIKE '%bounce%' THEN
    UPDATE public.email_sends SET status = 'bounced' WHERE id = v_id;
  ELSIF v_event LIKE '%complain%' THEN
    UPDATE public.email_sends SET status = 'complained' WHERE id = v_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_provider_event(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_email_provider_event(text, text, text, text) TO anon, service_role;

-- 5. Helper RPC to save messaging settings with admin password assert
CREATE OR REPLACE FUNCTION public.admin_save_messaging_settings(
  p_password text,
  p_test_mode boolean,
  p_test_email text DEFAULT 'dodhia.milan@gmail.com',
  p_test_phone text DEFAULT '+919820000000'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_password);

  INSERT INTO public.commerce_settings (id, messaging_test_mode, test_recipient_email, test_recipient_phone)
  VALUES (1, p_test_mode, coalesce(p_test_email, 'dodhia.milan@gmail.com'), coalesce(p_test_phone, '+919820000000'))
  ON CONFLICT (id) DO UPDATE SET
    messaging_test_mode = EXCLUDED.messaging_test_mode,
    test_recipient_email = EXCLUDED.test_recipient_email,
    test_recipient_phone = EXCLUDED.test_recipient_phone,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_messaging_settings(text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_messaging_settings(text, boolean, text, text) TO anon, service_role;
