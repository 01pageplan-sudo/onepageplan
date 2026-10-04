-- Migration: 20261003240000_messaging_system.sql
-- Description: Unified template registry, message scheduler, send logs, communication suppressions, and attendance tracking

-- 1. MESSAGE TEMPLATES REGISTRY
CREATE TABLE IF NOT EXISTS public.message_templates (
  key TEXT PRIMARY KEY,
  channel TEXT NOT NULL, -- 'email', 'whatsapp'
  category TEXT NOT NULL, -- 'transactional', 'marketing'
  subject TEXT, -- For emails
  body TEXT NOT NULL, -- Email copy / Meta WhatsApp copy
  meta_template_name TEXT, -- Meta template name (e.g. 'mrc_confirmation_wa')
  meta_language TEXT DEFAULT 'en',
  meta_approval_status TEXT DEFAULT 'APPROVED', -- 'APPROVED', 'PENDING', 'REJECTED', 'PAUSED'
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mt_channel ON public.message_templates (channel);
CREATE INDEX IF NOT EXISTS idx_mt_category ON public.message_templates (category);

-- 2. SCHEDULED MESSAGES QUEUE
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  template_key TEXT NOT NULL REFERENCES public.message_templates(key) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'email', 'whatsapp'
  category TEXT NOT NULL, -- 'transactional', 'marketing'
  context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled'
  skip_reason TEXT,
  error_message TEXT,
  provider_message_id TEXT, -- Resend email ID or Meta WhatsApp WAMID
  product_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  sequence_group TEXT, -- e.g. 'mrc_upgrade_sequence', 'gold_completer_sequence', 'abandoned_recovery'
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sm_status_scheduled ON public.scheduled_messages (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_sm_recipient_email ON public.scheduled_messages (lower(trim(recipient_email)));
CREATE INDEX IF NOT EXISTS idx_sm_recipient_phone ON public.scheduled_messages (recipient_phone);
CREATE INDEX IF NOT EXISTS idx_sm_sequence_group ON public.scheduled_messages (sequence_group);
CREATE INDEX IF NOT EXISTS idx_sm_product_id ON public.scheduled_messages (product_id);

-- 3. MESSAGE SEND LOGS
CREATE TABLE IF NOT EXISTS public.message_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  category TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  status TEXT NOT NULL, -- 'sent', 'delivered', 'read', 'failed', 'skipped'
  provider TEXT NOT NULL, -- 'resend', 'meta_whatsapp'
  provider_message_id TEXT,
  error_message TEXT,
  skip_reason TEXT,
  is_test_mode BOOLEAN NOT NULL DEFAULT false,
  payload_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msl_created ON public.message_send_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msl_template ON public.message_send_logs (template_key);
CREATE INDEX IF NOT EXISTS idx_msl_email ON public.message_send_logs (lower(trim(recipient_email)));

-- 4. COMMUNICATION SUPPRESSIONS (Unsubscribe & STOP Opt-Outs)
CREATE TABLE IF NOT EXISTS public.communication_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Normalized email or phone digits
  channel TEXT NOT NULL, -- 'email', 'whatsapp', 'all'
  reason TEXT NOT NULL, -- 'user_unsubscribe', 'whatsapp_stop_reply', 'bounce', 'spam_complaint'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(identifier, channel)
);

CREATE INDEX IF NOT EXISTS idx_cs_identifier ON public.communication_suppressions (identifier);

-- 5. ATTENDANCE DEDUPLICATION RECORDS
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

CREATE INDEX IF NOT EXISTS idx_ar_email ON public.attendance_records (lower(trim(email)));

-- 6. EXTEND COMMERCE SETTINGS FOR MESSAGING CONTROLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'commerce_settings' AND column_name = 'messaging_test_mode'
  ) THEN
    ALTER TABLE public.commerce_settings 
      ADD COLUMN messaging_test_mode BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN test_recipient_email TEXT DEFAULT 'dodhia.milan@gmail.com',
      ADD COLUMN test_recipient_phone TEXT DEFAULT '+919820000000',
      ADD COLUMN resend_from_email TEXT DEFAULT 'connect@onepageplan.in',
      ADD COLUMN resend_from_name TEXT DEFAULT 'Milan Dodhia';
  END IF;
END $$;
