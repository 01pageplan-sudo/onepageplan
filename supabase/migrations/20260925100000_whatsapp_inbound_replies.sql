-- ==============================================================================
-- WHATSAPP INBOUND MESSAGES & CUSTOMER REPLIES
-- ==============================================================================

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

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_phone ON public.whatsapp_inbound_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_registration_id ON public.whatsapp_inbound_messages(registration_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_created_at ON public.whatsapp_inbound_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_is_read ON public.whatsapp_inbound_messages(is_read);

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages;
CREATE POLICY "Service role full access on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public and anon insert on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages;
CREATE POLICY "Public and anon insert on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages FOR INSERT TO anon, service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Public and anon select on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages;
CREATE POLICY "Public and anon select on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages FOR SELECT TO anon, service_role USING (true);

DROP POLICY IF EXISTS "Public and anon update on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages;
CREATE POLICY "Public and anon update on whatsapp_inbound_messages" ON public.whatsapp_inbound_messages FOR UPDATE TO anon, service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.whatsapp_inbound_messages TO anon, service_role;
