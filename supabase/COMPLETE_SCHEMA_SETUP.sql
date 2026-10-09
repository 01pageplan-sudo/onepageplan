-- ==============================================================================
-- THE ONE PAGE PLAN: COMPLETE CONSOLIDATED SUPABASE SCHEMA SETUP
-- Idempotent script: Safe to run multiple times in Supabase SQL Editor.
-- Sets up all missing tables, RLS policies, permissions, RPC functions, and default seed data.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. APP_CONFIG TABLE & RLS REPAIR
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'service role manages app config'
  ) THEN
    CREATE POLICY "service role manages app config" ON public.app_config FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Allow anon & authenticated to read non-sensitive configuration keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'anon read public app_config'
  ) THEN
    CREATE POLICY "anon read public app_config" ON public.app_config FOR SELECT TO anon, authenticated
  USING (key NOT IN ('admin_password', 'cron_secret'));
  END IF;
END $$;

-- Allow anon & authenticated to update non-sensitive configuration keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'anon update public app_config'
  ) THEN
    CREATE POLICY "anon update public app_config" ON public.app_config FOR ALL TO anon, authenticated
  USING (key NOT IN ('admin_password', 'cron_secret'))
  WITH CHECK (key NOT IN ('admin_password', 'cron_secret'));
  END IF;
END $$;

GRANT ALL ON public.app_config TO anon, authenticated, service_role;

-- Ensure default webinar_id exists
INSERT INTO public.app_config (key, value)
VALUES ('webinar_id', 'cmthk6y4001kos60ybxfkbc67')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. EMAIL_SENDS EXTENSIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_url TEXT,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_sends_delivered_at ON public.email_sends(delivered_at);
CREATE INDEX IF NOT EXISTS idx_email_sends_clicked_at ON public.email_sends(clicked_at);

-- ------------------------------------------------------------------------------
-- 3. COMMERCE SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commerce_settings (
  id INT PRIMARY KEY DEFAULT 1,
  legal_entity_name TEXT NOT NULL DEFAULT 'Manrrs Wellness LLP',
  registered_address TEXT NOT NULL DEFAULT 'India',
  gstin TEXT DEFAULT NULL,
  sac_code TEXT DEFAULT NULL,
  community_url TEXT DEFAULT NULL,
  community_set_at TIMESTAMPTZ DEFAULT NULL,
  gold_on_sale BOOLEAN NOT NULL DEFAULT false,
  diamond_on_sale BOOLEAN NOT NULL DEFAULT false,
  mrc_base_price INT NOT NULL DEFAULT 601,
  silver_base_price INT NOT NULL DEFAULT 6001,
  gold_base_price INT NOT NULL DEFAULT 24000,
  gold_completer_price INT NOT NULL DEFAULT 18001,
  diamond_base_price INT NOT NULL DEFAULT 60001,
  diamond_renewal_price INT NOT NULL DEFAULT 60001,
  bonus_cohort_count INT NOT NULL DEFAULT 2,
  bonus_per_cohort_count INT NOT NULL DEFAULT 10,
  late_joiner_cohort_id UUID DEFAULT NULL,
  silver_milestones JSONB NOT NULL DEFAULT '[{"threshold": 100, "price": 7001}]'::jsonb,
  mrc_included_bullets TEXT DEFAULT '• Money Reality Check 12 recorded diagnostic sessions
• 4 diagnostic calculator & audit sheets
• 1 Thursday guest seat (valid for 60 days)
• 60 days of community access',
  silver_included_bullets TEXT DEFAULT '• The Calm Money System lifetime curriculum & missions
• Consolidated asset & liability audit model
• Real return & 30% tax drag calculations
• MWP Act, nomination & legal architecture framework
• Cohort membership & live implementation sprints',
  gold_included_bullets TEXT DEFAULT '• Lifetime Silver access + complete Gold curriculum
• Advanced wealth transmission & estate structuring
• Direct quarterly portfolio reviews & private office sessions
• Priority cohort positioning',
  diamond_included_bullets TEXT DEFAULT '• Lifetime Silver and Gold membership
• 12 months of direct Diamond private office advisory
• Bespoke estate, trust & tax optimization architecture
• Direct 1-on-1 private advisory access',
  policy_terms_markdown TEXT DEFAULT NULL,
  policy_privacy_markdown TEXT DEFAULT NULL,
  policy_refund_markdown TEXT DEFAULT NULL,
  policy_shipping_markdown TEXT DEFAULT NULL,
  policy_contact_markdown TEXT DEFAULT NULL,
  messaging_test_mode BOOLEAN NOT NULL DEFAULT true,
  test_recipient_email TEXT DEFAULT 'dodhia.milan@gmail.com',
  test_recipient_phone TEXT DEFAULT '+919820000000',
  resend_from_email TEXT DEFAULT 'connect@onepageplan.in',
  resend_from_name TEXT DEFAULT 'Milan Dodhia',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commerce_settings_single_row CHECK (id = 1)
);

ALTER TABLE public.commerce_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commerce_settings' AND policyname = 'allow all on commerce_settings'
  ) THEN
    CREATE POLICY "allow all on commerce_settings" ON public.commerce_settings FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.commerce_settings TO anon, authenticated, service_role;

-- Seed default settings if empty
INSERT INTO public.commerce_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. COHORTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_number INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  submission_deadline TIMESTAMPTZ NOT NULL,
  is_late_joiner_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cohorts' AND policyname = 'allow all on cohorts'
  ) THEN
    CREATE POLICY "allow all on cohorts" ON public.cohorts FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.cohorts TO anon, authenticated, service_role;

-- Seed default initial cohorts
INSERT INTO public.cohorts (cohort_number, name, start_date, submission_deadline)
VALUES 
  (1, 'Cohort 1', now() + interval '14 days', now() + interval '35 days'),
  (2, 'Cohort 2', now() + interval '45 days', now() + interval '66 days'),
  (3, 'Cohort 3', now() + interval '75 days', now() + interval '96 days')
ON CONFLICT (cohort_number) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. DISCOUNT CODES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' (INR) or 'percentage' (%)
  discount_value INT NOT NULL,
  applies_to_products TEXT[] NOT NULL DEFAULT ARRAY['all'], -- 'all' or product ids
  max_uses INT DEFAULT NULL, -- NULL = unlimited
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (upper(trim(code)));

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'discount_codes' AND policyname = 'allow all on discount_codes'
  ) THEN
    CREATE POLICY "allow all on discount_codes" ON public.discount_codes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.discount_codes TO anon, authenticated, service_role;

-- Seed default test coupon codes
INSERT INTO public.discount_codes (code, discount_type, discount_value, applies_to_products, is_active)
VALUES 
  ('WELCOME500', 'fixed', 500, ARRAY['all'], true),
  ('SILVER1000', 'fixed', 1000, ARRAY['silver'], true),
  ('GOLD2000', 'fixed', 2000, ARRAY['gold'], true),
  ('DIAMOND5000', 'fixed', 5000, ARRAY['diamond'], true),
  ('VIP50', 'percentage', 50, ARRAY['all'], true)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. REFERRAL PARTNERS & CONVERSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  partner_name TEXT NOT NULL,
  partner_email TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  reward_value INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_partners_code ON public.referral_partners (lower(trim(code)));

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_partners' AND policyname = 'allow all on referral_partners'
  ) THEN
    CREATE POLICY "allow all on referral_partners" ON public.referral_partners FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.referral_partners TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  product_id TEXT NOT NULL,
  pricing_rule_applied TEXT NOT NULL,
  base_price INT NOT NULL,
  credit_applied INT NOT NULL DEFAULT 0,
  discount_code_applied TEXT DEFAULT NULL,
  discount_amount INT NOT NULL DEFAULT 0,
  referral_code_applied TEXT DEFAULT NULL,
  amount_charged INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'captured', 'failed', 'refunded'
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON public.orders (lower(trim(buyer_email)));
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_rzp_order_id ON public.orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'allow all on orders'
  ) THEN
    CREATE POLICY "allow all on orders" ON public.orders FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.orders TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. REFERRAL CONVERSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_partner_id UUID REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_email TEXT NOT NULL,
  order_amount INT NOT NULL,
  reward_amount INT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_conversions' AND policyname = 'allow all on referral_conversions'
  ) THEN
    CREATE POLICY "allow all on referral_conversions" ON public.referral_conversions FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.referral_conversions TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. MANUAL GRANTS & MEMBER ACCESS GRANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manual_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  product_id TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT 'admin',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_grants_email ON public.manual_grants (lower(trim(email)));

ALTER TABLE public.manual_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manual_grants' AND policyname = 'allow all on manual_grants'
  ) THEN
    CREATE POLICY "allow all on manual_grants" ON public.manual_grants FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.manual_grants TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  source TEXT NOT NULL, -- 'razorpay', 'manual_grant', 'upgrade', 'system'
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  manual_grant_id UUID REFERENCES public.manual_grants(id) ON DELETE SET NULL,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_access_email_prod ON public.member_access_grants (lower(trim(email)), product_id);

ALTER TABLE public.member_access_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'member_access_grants' AND policyname = 'allow all on member_access_grants'
  ) THEN
    CREATE POLICY "allow all on member_access_grants" ON public.member_access_grants FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.member_access_grants TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. INVOICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL UNIQUE,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  product_name TEXT NOT NULL,
  amount_charged INT NOT NULL,
  tax_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.18,
  tax_amount INT NOT NULL,
  base_amount INT NOT NULL,
  gstin TEXT,
  sac_code TEXT,
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_access_token ON public.invoices (access_token);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_email ON public.invoices (lower(trim(buyer_email)));

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'allow all on invoices'
  ) THEN
    CREATE POLICY "allow all on invoices" ON public.invoices FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.invoices TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. COMMERCE EVENTS & RECONCILIATION FLAGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commerce_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commerce_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commerce_events' AND policyname = 'allow all on commerce_events'
  ) THEN
    CREATE POLICY "allow all on commerce_events" ON public.commerce_events FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.commerce_events TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.reconciliation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  description TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.reconciliation_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reconciliation_flags' AND policyname = 'allow all on reconciliation_flags'
  ) THEN
    CREATE POLICY "allow all on reconciliation_flags" ON public.reconciliation_flags FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.reconciliation_flags TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 12. COURSE COMPLETIONS & CATALOG
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  certificate_name TEXT,
  tshirt_size TEXT,
  shipping_address TEXT,
  reward_submitted_at TIMESTAMPTZ
);

ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_completions' AND policyname = 'allow all on course_completions'
  ) THEN
    CREATE POLICY "allow all on course_completions" ON public.course_completions FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.course_completions TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.course_lessons_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  module_number INT NOT NULL,
  lesson_number INT NOT NULL,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_lessons_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_lessons_catalog' AND policyname = 'allow all on course_lessons_catalog'
  ) THEN
    CREATE POLICY "allow all on course_lessons_catalog" ON public.course_lessons_catalog FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.course_lessons_catalog TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.course_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_comments_lesson ON public.course_comments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_comments_created ON public.course_comments(created_at ASC);

ALTER TABLE public.course_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'course_comments' AND policyname = 'allow all on course_comments'
  ) THEN
    CREATE POLICY "allow all on course_comments" ON public.course_comments FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.course_comments TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. PAYMENTS & WHATSAPP SENDS & WEBINAR LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'captured',
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_email ON public.payments (lower(trim(email)));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'allow all on payments'
  ) THEN
    CREATE POLICY "allow all on payments" ON public.payments FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.payments TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.whatsapp_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  message_key TEXT NOT NULL,
  occurrence TEXT NOT NULL DEFAULT 'once',
  phone TEXT NOT NULL,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sends_dedupe
  ON public.whatsapp_sends(registration_id, message_key, occurrence);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_phone ON public.whatsapp_sends(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sends_status ON public.whatsapp_sends(status);

ALTER TABLE public.whatsapp_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_sends' AND policyname = 'allow all on whatsapp_sends'
  ) THEN
    CREATE POLICY "allow all on whatsapp_sends" ON public.whatsapp_sends FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.whatsapp_sends TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.webinar_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  email TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webinar_event_logs_session ON public.webinar_event_logs(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_webinar_event_logs_email ON public.webinar_event_logs(lower(trim(email)));

ALTER TABLE public.webinar_event_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webinar_event_logs' AND policyname = 'allow all on webinar_event_logs'
  ) THEN
    CREATE POLICY "allow all on webinar_event_logs" ON public.webinar_event_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.webinar_event_logs TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.webinar_session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id TEXT NOT NULL,
  session_date DATE NOT NULL UNIQUE,
  total_attendees INTEGER DEFAULT 0,
  peak_concurrent INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webinar_session_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webinar_session_history' AND policyname = 'allow all on webinar_session_history'
  ) THEN
    CREATE POLICY "allow all on webinar_session_history" ON public.webinar_session_history FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.webinar_session_history TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  sender_name TEXT,
  message_body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  provider_message_id TEXT UNIQUE,
  replied_to_wamid TEXT,
  replied_to_message_key TEXT,
  raw_payload JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_inbound_messages' AND policyname = 'allow all on whatsapp_inbound_messages'
  ) THEN
    CREATE POLICY "allow all on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.whatsapp_inbound_messages TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 14. COMPLETION PAGE TEMPLATES & TOKEN WARNINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.completion_page_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  html_content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpt_slug_active ON public.completion_page_templates (slug, is_active);

ALTER TABLE public.completion_page_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'completion_page_templates' AND policyname = 'allow all on completion_page_templates'
  ) THEN
    CREATE POLICY "allow all on completion_page_templates" ON public.completion_page_templates FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.completion_page_templates TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.token_render_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  unknown_tokens JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.token_render_warnings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'token_render_warnings' AND policyname = 'allow all on token_render_warnings'
  ) THEN
    CREATE POLICY "allow all on token_render_warnings" ON public.token_render_warnings FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.token_render_warnings TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 15. MESSAGE TEMPLATES & SCHEDULER & ATTENDANCE
-- ------------------------------------------------------------------------------
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
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'allow all on message_templates'
  ) THEN
    CREATE POLICY "allow all on message_templates" ON public.message_templates FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.message_templates TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  category TEXT NOT NULL,
  context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  skip_reason TEXT,
  error_message TEXT,
  provider_message_id TEXT,
  product_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  sequence_group TEXT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scheduled_messages' AND policyname = 'allow all on scheduled_messages'
  ) THEN
    CREATE POLICY "allow all on scheduled_messages" ON public.scheduled_messages FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.scheduled_messages TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.message_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  category TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  error_message TEXT,
  skip_reason TEXT,
  is_test_mode BOOLEAN NOT NULL DEFAULT false,
  payload_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_send_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_send_logs' AND policyname = 'allow all on message_send_logs'
  ) THEN
    CREATE POLICY "allow all on message_send_logs" ON public.message_send_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.message_send_logs TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.communication_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  channel TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(identifier, channel)
);

ALTER TABLE public.communication_suppressions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_suppressions' AND policyname = 'allow all on communication_suppressions'
  ) THEN
    CREATE POLICY "allow all on communication_suppressions" ON public.communication_suppressions FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.communication_suppressions TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  session_date TEXT NOT NULL,
  attended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  followup_sent BOOLEAN NOT NULL DEFAULT false,
  followup_sent_at TIMESTAMPTZ,
  UNIQUE(email)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'allow all on attendance_records'
  ) THEN
    CREATE POLICY "allow all on attendance_records" ON public.attendance_records FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.attendance_records TO anon, authenticated, service_role;

-- Seed the 7 approved WhatsApp templates
INSERT INTO public.message_templates (key, channel, category, subject, body, meta_template_name, meta_language, meta_approval_status, is_active)
VALUES 
  ('3p_direct_integration_test', 'whatsapp', 'transactional', NULL, 'Hello {{1}}, this is a test message from The One Page Plan direct WhatsApp integration.', '3p_direct_integration_test', 'en_US', 'APPROVED', true),
  ('webinar_confirmation', 'whatsapp', 'transactional', NULL, 'Hi {{1}}, you are confirmed for the Masterclass. Join room: {{2}}', 'webinar_confirmation', 'en', 'APPROVED', true),
  ('webinar_reminder_2h', 'whatsapp', 'transactional', NULL, 'Hi {{1}}, masterclass starts in 2 hours! Join here: {{2}}', 'webinar_reminder_2h', 'en', 'APPROVED', true),
  ('webinar_reminder_15m', 'whatsapp', 'transactional', NULL, 'Hi {{1}}, we are starting in 15 minutes! Join live: {{2}}', 'webinar_reminder_15m', 'en', 'APPROVED', true),
  ('webinar_live_now', 'whatsapp', 'transactional', NULL, 'Hi {{1}}, Milan is live right now! Enter session: {{2}}', 'webinar_live_now', 'en', 'APPROVED', true),
  ('webinar_missed', 'whatsapp', 'transactional', NULL, 'Hi {{1}}, we missed you at the masterclass today. Watch the summary: {{2}}', 'webinar_missed', 'en', 'APPROVED', true),
  ('course_purchase_confirmat', 'whatsapp', 'transactional', NULL, 'Welcome {{1}}! Your access to The Calm Money System is active: {{2}}', 'course_purchase_confirmat', 'en', 'APPROVED', true)
ON CONFLICT (key) DO UPDATE SET
  meta_approval_status = EXCLUDED.meta_approval_status,
  is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 16. SECURITY DEFINER RPC FUNCTIONS
-- ------------------------------------------------------------------------------

-- App config setter with admin password verification
CREATE OR REPLACE FUNCTION public.admin_set_app_config(
  p_password text,
  p_key text,
  p_value text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin(p_password);
  IF p_key = 'admin_password' THEN
    RAISE EXCEPTION 'Cannot change admin password via this function';
  END IF;

  INSERT INTO public.app_config (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN true;
END;
$$;


GRANT EXECUTE ON FUNCTION public.admin_set_app_config(text, text, text) TO anon, authenticated, service_role;

-- Dedicated webinar ID saver with admin check
CREATE OR REPLACE FUNCTION public.admin_save_webinar_id(
  p_password text,
  p_webinar_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin(p_password);

  INSERT INTO public.app_config (key, value)
  VALUES ('webinar_id', trim(p_webinar_id))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  -- Also update email_settings joining link for full sync
  UPDATE public.email_settings
  SET joining_link = 'https://webinar.gg/room/' || trim(p_webinar_id),
      updated_at = now()
  WHERE id = 1;

  RETURN true;
END;
$$;


GRANT EXECUTE ON FUNCTION public.admin_save_webinar_id(text, text) TO anon, authenticated, service_role;

-- Save messaging settings RPC
CREATE OR REPLACE FUNCTION public.admin_save_messaging_settings(
  p_password text,
  p_test_mode boolean,
  p_test_email text DEFAULT 'dodhia.milan@gmail.com',
  p_test_phone text DEFAULT '+919820000000'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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


GRANT EXECUTE ON FUNCTION public.admin_save_messaging_settings(text, boolean, text, text) TO anon, authenticated, service_role;

-- Validate discount coupon code RPC
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code TEXT,
  p_product TEXT,
  p_base_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount INT := 0;
  v_final INT := p_base_amount;
BEGIN
  SELECT * INTO v_coupon
  FROM public.discount_codes
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired coupon code.');
  END IF;

  -- Check if applies to product
  IF NOT ('all' = ANY(v_coupon.applies_to_products) OR p_product = ANY(v_coupon.applies_to_products)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon is not applicable to the selected product.');
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := round((p_base_amount * v_coupon.discount_value)::numeric / 100);
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  IF v_discount >= p_base_amount THEN
    v_discount := p_base_amount - 1;
  END IF;

  v_final := p_base_amount - v_discount;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT, TEXT, INT) TO anon, authenticated, service_role;

-- Compute current silver pricing with cohort & milestone rules
CREATE OR REPLACE FUNCTION public.compute_current_silver_pricing()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_active_count INT;
  v_current_price INT;
  v_next_threshold INT := NULL;
  v_next_price INT := NULL;
  v_ms RECORD;
BEGIN
  SELECT * INTO v_settings FROM public.commerce_settings WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active_count', 0, 'current_price', 6001, 'next_threshold', NULL, 'next_price', NULL);
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.member_access_grants
  WHERE product_id IN ('silver', 'gold', 'diamond') AND is_active = true;

  v_current_price := v_settings.silver_base_price;

  FOR v_ms IN SELECT * FROM jsonb_to_recordset(v_settings.silver_milestones) AS x(threshold INT, price INT) ORDER BY threshold ASC LOOP
    IF v_active_count >= v_ms.threshold THEN
      v_current_price := v_ms.price;
    ELSIF v_next_threshold IS NULL THEN
      v_next_threshold := v_ms.threshold;
      v_next_price := v_ms.price;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'active_count', v_active_count,
    'current_price', v_current_price,
    'next_threshold', v_next_threshold,
    'next_price', v_next_price
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.compute_current_silver_pricing() TO anon, authenticated, service_role;

-- Record successful payment RPC
CREATE OR REPLACE FUNCTION public.record_successful_payment(
  p_email TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_order_id TEXT,
  p_payment_id TEXT,
  p_notes JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg_id UUID;
  v_payment_id UUID;
BEGIN
  SELECT id INTO v_reg_id
  FROM public.registrations
  WHERE lower(trim(email)) = lower(trim(p_email))
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.payments (
    registration_id, email, amount, currency,
    razorpay_order_id, razorpay_payment_id, notes, status
  ) VALUES (
    v_reg_id, lower(trim(p_email)), p_amount, coalesce(p_currency, 'INR'),
    p_order_id, p_payment_id, coalesce(p_notes, '{}'::jsonb), 'captured'
  )
  ON CONFLICT (razorpay_payment_id) DO UPDATE SET status = 'captured', updated_at = now()
  RETURNING id INTO v_payment_id;

  IF v_reg_id IS NOT NULL THEN
    UPDATE public.registrations
    SET status = 'purchased',
        tags = array_append(coalesce(tags, '{}'::text[]), 'purchased'),
        updated_at = now()
    WHERE id = v_reg_id;
  END IF;

  RETURN v_payment_id;
END;
$$;


GRANT EXECUTE ON FUNCTION public.record_successful_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- WhatsApp send event recorder RPC
CREATE OR REPLACE FUNCTION public.record_whatsapp_event(
  p_wamid TEXT,
  p_event TEXT,
  p_event_time TIMESTAMPTZ,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT := lower(trim(p_event));
BEGIN
  UPDATE public.whatsapp_sends
  SET
    status = CASE
      WHEN v_event = 'read' THEN 'read'
      WHEN v_event = 'delivered' AND status NOT IN ('read', 'clicked') THEN 'delivered'
      WHEN v_event = 'failed' THEN 'failed'
      ELSE status
    END,
    delivered_at = CASE WHEN v_event = 'delivered' AND delivered_at IS NULL THEN coalesce(p_event_time, now()) ELSE delivered_at END,
    read_at = CASE WHEN v_event = 'read' AND read_at IS NULL THEN coalesce(p_event_time, now()) ELSE read_at END,
    error = coalesce(p_error, error),
    updated_at = now()
  WHERE provider_message_id = trim(p_wamid);

  RETURN FOUND;
END;
$$;


GRANT EXECUTE ON FUNCTION public.record_whatsapp_event(TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated, service_role;

-- WhatsApp dashboard summary RPC
CREATE OR REPLACE FUNCTION public.admin_get_whatsapp_dashboard(p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_sent INTEGER;
  v_delivered INTEGER;
  v_read INTEGER;
  v_clicked INTEGER;
  v_failed INTEGER;
  v_recent JSONB;
BEGIN
  PERFORM public.assert_admin(p_password);

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('sent', 'delivered', 'read', 'clicked')),
         count(*) FILTER (WHERE status IN ('delivered', 'read', 'clicked')),
         count(*) FILTER (WHERE status IN ('read', 'clicked')),
         count(*) FILTER (WHERE status = 'clicked'),
         count(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_sent, v_delivered, v_read, v_clicked, v_failed
  FROM public.whatsapp_sends;

  SELECT coalesce(jsonb_agg(sub), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT w.id, w.phone, w.template_name, w.message_key, w.status,
           w.provider_message_id, w.error, w.sent_at, w.delivered_at, w.read_at, w.clicked_at, w.created_at,
           r.full_name AS attendee_name
    FROM public.whatsapp_sends w
    LEFT JOIN public.registrations r ON r.id = w.registration_id
    ORDER BY w.created_at DESC
    LIMIT 100
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'sent', v_sent,
    'delivered', v_delivered,
    'read', v_read,
    'clicked', v_clicked,
    'failed', v_failed,
    'delivered_rate', CASE WHEN v_sent > 0 THEN round((v_delivered::numeric / v_sent::numeric) * 100, 1) ELSE 0 END,
    'read_rate', CASE WHEN v_delivered > 0 THEN round((v_read::numeric / v_delivered::numeric) * 100, 1) ELSE 0 END,
    'clicked_rate', CASE WHEN v_delivered > 0 THEN round((v_clicked::numeric / v_delivered::numeric) * 100, 1) ELSE 0 END,
    'recent_sends', v_recent
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.admin_get_whatsapp_dashboard(TEXT) TO anon, authenticated, service_role;

-- Historical webinar logs RPC
CREATE OR REPLACE FUNCTION public.admin_get_historical_webinar_logs(
  p_password TEXT,
  p_session_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessions JSONB;
  v_events JSONB;
BEGIN
  PERFORM public.assert_admin(p_password);

  SELECT coalesce(jsonb_agg(sub), '[]'::jsonb)
  INTO v_sessions
  FROM (
    SELECT session_date,
           count(*) as total_events,
           count(DISTINCT email) as unique_attendees,
           count(*) FILTER (WHERE event_type = 'join') as joins,
           count(*) FILTER (WHERE event_type = 'leave') as leaves
    FROM public.webinar_event_logs
    GROUP BY session_date
    ORDER BY session_date DESC
  ) sub;

  SELECT coalesce(jsonb_agg(ev), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT id, webinar_id, session_date, email, event_type, duration_seconds, event_data, created_at
    FROM public.webinar_event_logs
    WHERE (p_session_date IS NULL OR session_date = p_session_date)
    ORDER BY created_at DESC
    LIMIT 150
  ) ev;

  RETURN jsonb_build_object(
    'sessions', v_sessions,
    'events', v_events
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.admin_get_historical_webinar_logs(TEXT, DATE) TO anon, authenticated, service_role;

-- Record email provider delivery/open events RPC
CREATE OR REPLACE FUNCTION public.record_email_provider_event(
  p_password text, p_provider_id text, p_email text, p_event text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_event text := lower(coalesce(p_event, ''));
BEGIN
  PERFORM public.assert_admin(p_password);

  IF p_provider_id IS NOT NULL AND length(trim(p_provider_id)) > 0 THEN
    SELECT id INTO v_id FROM public.email_sends
    WHERE provider_id = trim(p_provider_id)
    ORDER BY coalesce(sent_at, created_at) DESC LIMIT 1;
  END IF;

  IF v_id IS NULL AND p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_id FROM public.email_sends
    WHERE email = lower(trim(p_email))
    ORDER BY coalesce(sent_at, created_at) DESC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN RETURN false; END IF;

  IF p_provider_id IS NOT NULL THEN
    UPDATE public.email_sends SET provider_id = coalesce(provider_id, trim(p_provider_id)) WHERE id = v_id;
  END IF;

  IF v_event LIKE '%open%' THEN
    UPDATE public.email_sends
    SET status = 'opened',
        opened_at = coalesce(opened_at, now())
    WHERE id = v_id;
  ELSIF v_event LIKE '%click%' THEN
    UPDATE public.email_sends
    SET status = 'clicked',
        clicked_at = coalesce(clicked_at, now())
    WHERE id = v_id;
  ELSIF v_event LIKE '%deliver%' THEN
    UPDATE public.email_sends
    SET status = 'delivered',
        delivered_at = coalesce(delivered_at, now())
    WHERE id = v_id AND status NOT IN ('opened', 'clicked', 'bounced', 'complained');
  ELSIF v_event LIKE '%bounce%' THEN
    UPDATE public.email_sends SET status = 'bounced', bounced_at = coalesce(bounced_at, now()) WHERE id = v_id;
  ELSIF v_event LIKE '%complain%' THEN
    UPDATE public.email_sends SET status = 'complained' WHERE id = v_id;
  END IF;

  RETURN true;
END;
$$;


GRANT EXECUTE ON FUNCTION public.record_email_provider_event(text, text, text, text) TO anon, authenticated, service_role;

-- Course access checker RPC
CREATE OR REPLACE FUNCTION public.check_course_access(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant RECORD;
BEGIN
  SELECT * INTO v_grant
  FROM public.member_access_grants
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('has_access', true, 'product_id', v_grant.product_id);
  END IF;

  RETURN jsonb_build_object('has_access', false);
END;
$$;


GRANT EXECUTE ON FUNCTION public.check_course_access(TEXT) TO anon, authenticated, service_role;

-- Completion page template versioning RPC
CREATE OR REPLACE FUNCTION public.save_completion_template(
  p_slug TEXT,
  p_html_content TEXT,
  p_uploaded_by TEXT DEFAULT 'admin',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version INT := 1;
  v_inserted_id UUID;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.completion_page_templates
  WHERE slug = p_slug;

  UPDATE public.completion_page_templates
  SET is_active = false
  WHERE slug = p_slug AND is_active = true;

  INSERT INTO public.completion_page_templates (
    slug, version, html_content, is_active, uploaded_by, notes
  ) VALUES (
    p_slug, v_next_version, p_html_content, true, p_uploaded_by, p_notes
  ) RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object('ok', true, 'id', v_inserted_id, 'slug', p_slug, 'version', v_next_version);
END;
$$;


GRANT EXECUTE ON FUNCTION public.save_completion_template(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Rollback completion template RPC
CREATE OR REPLACE FUNCTION public.rollback_completion_template(
  p_slug TEXT,
  p_target_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.completion_page_templates
    WHERE slug = p_slug AND version = p_target_version
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Target version does not exist.');
  END IF;

  UPDATE public.completion_page_templates
  SET is_active = false
  WHERE slug = p_slug;

  UPDATE public.completion_page_templates
  SET is_active = true
  WHERE slug = p_slug AND version = p_target_version;

  RETURN jsonb_build_object('ok', true, 'slug', p_slug, 'active_version', p_target_version);
END;
$$;


GRANT EXECUTE ON FUNCTION public.rollback_completion_template(TEXT, INT) TO anon, authenticated, service_role;

-- Bulk upload members RPC
CREATE OR REPLACE FUNCTION public.bulk_upload_members(
  p_password TEXT,
  p_members JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_created INT := 0;
  v_skipped INT := 0;
  v_cohort_id UUID;
BEGIN
  PERFORM public.assert_admin(p_password);

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_members) AS x(
    email TEXT, full_name TEXT, phone TEXT, product_id TEXT, cohort_number INT, notes TEXT
  ) LOOP
    IF v_item.email IS NULL OR length(trim(v_item.email)) = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Look up cohort if provided
    IF v_item.cohort_number IS NOT NULL THEN
      SELECT id INTO v_cohort_id FROM public.cohorts WHERE cohort_number = v_item.cohort_number;
    ELSE
      v_cohort_id := NULL;
    END IF;

    -- Insert manual grant
    INSERT INTO public.manual_grants (email, full_name, phone, product_id, reason)
    VALUES (lower(trim(v_item.email)), coalesce(v_item.full_name, 'Member'), v_item.phone, coalesce(v_item.product_id, 'silver'), v_item.notes);

    -- Insert access grant
    INSERT INTO public.member_access_grants (email, product_id, source, cohort_id)
    VALUES (lower(trim(v_item.email)), coalesce(v_item.product_id, 'silver'), 'bulk_upload', v_cohort_id);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped);
END;
$$;


GRANT EXECUTE ON FUNCTION public.bulk_upload_members(TEXT, JSONB) TO anon, authenticated, service_role;

-- Grant entitlement on payment capture RPC
CREATE OR REPLACE FUNCTION public.grant_entitlement_on_capture(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_cohort_id UUID;
  v_invoice_num TEXT;
  v_token TEXT;
  v_settings RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_settings FROM public.commerce_settings WHERE id = 1;

  -- Default cohort 1 if available
  SELECT id INTO v_cohort_id FROM public.cohorts ORDER BY cohort_number ASC LIMIT 1;

  -- Grant access
  INSERT INTO public.member_access_grants (email, product_id, source, order_id, cohort_id)
  VALUES (lower(trim(v_order.buyer_email)), v_order.product_id, 'razorpay', v_order.id, v_cohort_id);

  -- Generate invoice
  v_invoice_num := 'OPP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.invoices (
    order_id, invoice_number, access_token,
    buyer_name, buyer_email, buyer_phone,
    product_name, amount_charged,
    tax_rate, tax_amount, base_amount,
    gstin, sac_code
  ) VALUES (
    v_order.id, v_invoice_num, v_token,
    coalesce(v_order.buyer_name, 'Learner'), lower(trim(v_order.buyer_email)), v_order.buyer_phone,
    v_order.product_id, v_order.amount_charged,
    0.18, round(v_order.amount_charged * 0.18 / 1.18), round(v_order.amount_charged / 1.18),
    v_settings.gstin, v_settings.sac_code
  );

  RETURN true;
END;
$$;


GRANT EXECUTE ON FUNCTION public.grant_entitlement_on_capture(UUID) TO anon, authenticated, service_role;

-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 17. REPAIRED ADMIN_EMAIL_STATS (COUNTS SENT, DELIVERED, OPENED STATUSES)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_email_stats(
  p_password text, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.assert_admin(p_password);
  SELECT jsonb_build_object(
    'sent', count(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked')),
    'queued', count(*) FILTER (WHERE status = 'queued'),
    'opened', count(*) FILTER (WHERE opened_at IS NOT NULL OR status = 'opened'),
    'delivered', count(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'bounced', count(*) FILTER (WHERE status = 'bounced'),
    'complained', count(*) FILTER (WHERE status = 'complained'),
    'people', count(DISTINCT email) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked')),
    'by_template', coalesce((
      SELECT jsonb_object_agg(template, n) FROM (
        SELECT template, count(*) AS n FROM public.email_sends e2
        WHERE (p_from IS NULL OR e2.created_at >= p_from)
          AND (p_to IS NULL OR e2.created_at < p_to)
          AND e2.status IN ('sent', 'delivered', 'opened', 'clicked')
        GROUP BY template
      ) q
    ), '{}'::jsonb)
  ) INTO v
  FROM public.email_sends e;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_email_stats(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- SETUP COMPLETE
-- ==============================================================================
