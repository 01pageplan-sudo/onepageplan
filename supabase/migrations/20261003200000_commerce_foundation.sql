-- ==============================================================================
-- COMMERCE FOUNDATION: Products, Tiers, Multi-Source Access Grants, Invoices,
-- Discounts, Referral Tracking, Bulk Upload & Events
-- Migration: 20261003200000_commerce_foundation.sql
-- ==============================================================================

-- 1. COMMERCE SETTINGS (Single row configuration)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commerce_settings_single_row CHECK (id = 1)
);

-- Seed default settings if not exists
INSERT INTO public.commerce_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. COHORTS
CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_number INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  submission_deadline TIMESTAMPTZ NOT NULL,
  is_late_joiner_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default initial cohorts if empty
INSERT INTO public.cohorts (cohort_number, name, start_date, submission_deadline)
VALUES 
  (1, 'Cohort 1', now() + interval '14 days', now() + interval '35 days'),
  (2, 'Cohort 2', now() + interval '45 days', now() + interval '66 days'),
  (3, 'Cohort 3', now() + interval '75 days', now() + interval '96 days')
ON CONFLICT (cohort_number) DO NOTHING;

-- 3. DISCOUNT CODES
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' (INR) or 'percentage' (%)
  discount_value INT NOT NULL,
  applies_to_products TEXT[] NOT NULL DEFAULT ARRAY['all'], -- 'all' or array of product ids
  max_uses INT DEFAULT NULL, -- NULL = unlimited
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (upper(trim(code)));

-- 4. REFERRAL PARTNERS & TRACKING
CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  partner_name TEXT NOT NULL,
  partner_email TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  reward_value INT NOT NULL DEFAULT 10, -- e.g. 10% or ₹1000
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_partners_code ON public.referral_partners (lower(trim(code)));

-- 5. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  product_id TEXT NOT NULL, -- 'money_reality_check', 'silver', 'gold', 'diamond', 'diamond_renewal'
  pricing_rule_applied TEXT NOT NULL, -- 'full_price', 'mrc_credit', 'special_upgrade_price', 'diamond_renewal'
  base_price INT NOT NULL,
  credit_applied INT NOT NULL DEFAULT 0,
  discount_code_applied TEXT DEFAULT NULL,
  discount_amount INT NOT NULL DEFAULT 0,
  referral_code_applied TEXT DEFAULT NULL,
  amount_charged INT NOT NULL, -- In INR
  currency TEXT NOT NULL DEFAULT 'INR',
  buyer_name TEXT,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  consents_captured JSONB NOT NULL DEFAULT '{}'::jsonb,
  traffic_source JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'captured', 'refunded', 'failed'
  price_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON public.orders (lower(trim(buyer_email)));
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_ref ON public.orders (referral_code_applied);

-- 6. REFERRAL CONVERSIONS
CREATE TABLE IF NOT EXISTS public.referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.referral_partners(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  order_amount INT NOT NULL,
  reward_amount INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_conv_partner ON public.referral_conversions (partner_id);

-- 7. MANUAL GRANTS (Offline payments & Individual Grants)
CREATE TABLE IF NOT EXISTS public.manual_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  product_id TEXT NOT NULL,
  reason_note TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_grants_email ON public.manual_grants (lower(trim(email)));

-- 8. MEMBER ACCESS GRANTS (Multi-source access tracking)
CREATE TABLE IF NOT EXISTS public.member_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  access_tier TEXT NOT NULL, -- 'money_reality_check', 'silver', 'gold', 'diamond'
  source_type TEXT NOT NULL, -- 'direct_purchase', 'upgrade', 'included_in_tier', 'manual_grant', 'bulk_upload'
  parent_product TEXT, -- 'gold', 'diamond' if included_in_tier
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  manual_grant_id UUID REFERENCES public.manual_grants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked'
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL for lifetime, timestamp for Diamond (12 mos) / community
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  has_one_on_one_bonus BOOLEAN NOT NULL DEFAULT false,
  bonus_assigned_manually BOOLEAN NOT NULL DEFAULT false,
  thursday_seat_expires_at TIMESTAMPTZ, -- For MRC: 60 days
  community_access_starts_at TIMESTAMPTZ,
  community_access_expires_at TIMESTAMPTZ,
  locked_silver_upgrade_price INT, -- For MRC
  silver_upgrade_deadline TIMESTAMPTZ, -- For MRC: 30 days at 11:59:59 PM IST
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mag_email_tier ON public.member_access_grants (lower(trim(email)), access_tier);
CREATE INDEX IF NOT EXISTS idx_mag_status ON public.member_access_grants (status);
CREATE INDEX IF NOT EXISTS idx_mag_order_id ON public.member_access_grants (order_id);

-- 9. INVOICES / RECEIPTS
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  financial_year TEXT NOT NULL, -- e.g. '2026-27'
  document_type TEXT NOT NULL, -- 'Receipt' or 'Tax Invoice'
  legal_entity_name TEXT NOT NULL,
  registered_address TEXT NOT NULL,
  gstin TEXT,
  sac_code TEXT,
  buyer_name TEXT,
  buyer_email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  includes_description TEXT NOT NULL,
  term_description TEXT NOT NULL,
  base_price INT NOT NULL,
  credit_applied INT NOT NULL DEFAULT 0,
  special_upgrade_discount INT NOT NULL DEFAULT 0,
  discount_amount INT NOT NULL DEFAULT 0,
  amount_paid INT NOT NULL,
  tax_breakup JSONB DEFAULT NULL,
  download_token TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_fy ON public.invoices (financial_year);
CREATE INDEX IF NOT EXISTS idx_invoices_email ON public.invoices (lower(trim(buyer_email)));

-- 10. COMMERCE EVENTS (Persistent log for Prompt 4 messaging)
CREATE TABLE IF NOT EXISTS public.commerce_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  email TEXT NOT NULL,
  payload JSONB NOT NULL,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commerce_events_name ON public.commerce_events (event_name);
CREATE INDEX IF NOT EXISTS idx_commerce_events_processed ON public.commerce_events (processed);

-- 11. RECONCILIATION FLAGS
CREATE TABLE IF NOT EXISTS public.reconciliation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  email TEXT,
  amount INT,
  issue_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. COURSE COMPLETIONS
CREATE TABLE IF NOT EXISTS public.course_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_before_deadline BOOLEAN NOT NULL DEFAULT false,
  gold_upgrade_eligible BOOLEAN NOT NULL DEFAULT false,
  gold_upgrade_price INT NOT NULL DEFAULT 18001,
  gold_upgrade_deadline TIMESTAMPTZ,
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_course_completions_email ON public.course_completions (lower(trim(email)));

-- 13. COURSE LESSONS CATALOG (Video metadata with server-only embed URLs)
CREATE TABLE IF NOT EXISTS public.course_lessons_catalog (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL, -- 'money_reality_check', 'silver', 'gold', 'diamond'
  title TEXT NOT NULL,
  duration TEXT NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 1800,
  min_watch_seconds INT NOT NULL DEFAULT 120,
  "desc" TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  sequence_order INT NOT NULL
);

-- Seed initial catalog lessons
INSERT INTO public.course_lessons_catalog (id, tier, title, duration, duration_seconds, min_watch_seconds, "desc", embed_url, materials, takeaways, sequence_order)
VALUES
  -- 12 Money Reality Check Sessions
  ('mrc-01', 'money_reality_check', 'MRC 1: Unearthing Scattered Bank Accounts & Folios', '15 mins', 900, 60, 'Systematically tracking every bank account, FD, and folio.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Identify idle savings accounts", "Locate lost MF folios"]'::jsonb, 1),
  ('mrc-02', 'money_reality_check', 'MRC 2: Real Asset vs Nominal Asset Clarity', '18 mins', 1080, 60, 'Separating wealth that beats inflation from wealth that depreciates.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Understand asset drag", "Calculate real inflation"]'::jsonb, 2),
  ('mrc-03', 'money_reality_check', 'MRC 3: The 30% Tax Leak in Traditional Fixed Deposits', '20 mins', 1200, 60, 'Why FD returns after highest slab tax yield negative purchasing power.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Tax slab impact on debt", "Alternative tax-efficient instruments"]'::jsonb, 3),
  ('mrc-04', 'money_reality_check', 'MRC 4: The 4 Core Financial Diagnostic Tools', '22 mins', 1320, 60, 'Introduction to the 4 shared diagnostic frameworks.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Master the audit sheet", "Run your first debt sanity check"]'::jsonb, 4),
  ('mrc-05', 'money_reality_check', 'MRC 5: Emergency Fund Math vs Emotional Buffers', '16 mins', 960, 60, 'How many months of runway you actually need in high-liquidity assets.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Define 6-month runway", "Eliminate panic-driven cash piles"]'::jsonb, 5),
  ('mrc-06', 'money_reality_check', 'MRC 6: High-Interest Debt Triage & Rapid Elimination', '19 mins', 1140, 60, 'Prioritizing personal loans, credit card balances, and auto debt.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Avalanche vs Snowball method", "Refinancing high APR obligations"]'::jsonb, 6),
  ('mrc-07', 'money_reality_check', 'MRC 7: Insurance Check: Term vs Investment Traps', '25 mins', 1500, 60, 'Separating pure risk protection from low-yield endowment policies.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Calculating pure term cover", "Exiting toxic ULIPs"]'::jsonb, 7),
  ('mrc-08', 'money_reality_check', 'MRC 8: Medical Coverage Gaps & Super Top-Up Setup', '21 mins', 1260, 60, 'Why base corporate coverage fails during catastrophic illness.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Deductible optimization", "Restoration and room rent limits"]'::jsonb, 8),
  ('mrc-09', 'money_reality_check', 'MRC 9: Single-Source Risk: Salary vs Sinking Funds', '17 mins', 1020, 60, 'Decoupling household expenses from day 1 paycheck arrival.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Sinking fund segregation", "Smoothing lumpy yearly costs"]'::jsonb, 9),
  ('mrc-10', 'money_reality_check', 'MRC 10: Nomination vs Legal Heir Clarity', '23 mins', 1380, 60, 'Why nominees are only caretakers and how to avoid estate disputes.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Nominee rights vs succession", "Joint account holding types"]'::jsonb, 10),
  ('mrc-11', 'money_reality_check', 'MRC 11: The Thursday Live Clarity Session Preparation', '15 mins', 900, 60, 'How to bring your diagnostic worksheet questions to the live session.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Formulating high-impact questions", "Guest seat guidelines"]'::jsonb, 11),
  ('mrc-12', 'money_reality_check', 'MRC 12: Transitioning from Diagnostic to Execution', '24 mins', 1440, 60, 'How the 30-day Silver upgrade path integrates full portfolio pruning.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["The 30-day upgrade advantage", "Next steps for execution"]'::jsonb, 12),
  
  -- Silver Curriculum Sessions
  ('core-1', 'silver', 'Module 1: The Consolidated Money Picture', '45 mins', 2700, 120, 'Unearth the accounts you forgot existed. Calculate your real asset-to-liability ratio on one single sheet.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["List all scattered EPF and mutual funds", "Establish Baseline Net Worth"]'::jsonb, 13),
  ('core-2', 'silver', 'Module 2: Real Return & The 30% Tax Reality', '50 mins', 3000, 120, 'Why doubling your money in 10 years is actually a negative 1% real return.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Calculate true real return", "Set long-term hurdle rates"]'::jsonb, 14),
  ('core-3', 'silver', 'Module 3: Protection, MWP Act & Nomination Architecture', '40 mins', 2400, 120, 'The single legal clause that decides whether insurance payouts land with your family or creditors.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Invoke Section 6 of MWP Act", "Clean up nominee mismatches"]'::jsonb, 15),
  ('core-4', 'silver', 'Module 4: Writing The One Page Your Family Can Act On', '35 mins', 2100, 120, 'Synthesizing everything into a single, unambiguous document that removes money anxiety.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Format financial life on 1 A4 sheet", "Family clarity walkthrough"]'::jsonb, 16),
  ('imp-1', 'silver', 'Mission 1: The 14-Day Portfolio Pruning Sprint', '25 mins', 1500, 90, 'Step-by-step guidance on closing redundant accounts and pruning toxic policies.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Exit poor endowment policies", "Consolidate into operations hub"]'::jsonb, 17),
  ('imp-2', 'silver', 'Mission 2: Automated Cashflow & Sinking Fund Architecture', '30 mins', 1800, 90, 'Automating savings on day 1 of every month.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Configure Salary -> Sinking Fund pipeline", "High-yield buffer allocation"]'::jsonb, 18),
  ('bonus-1', 'silver', 'Bonus 1: The Will & Estate Planning Masterclass', '55 mins', 3300, 120, 'Drafting a legally binding Will in India without expensive lawyer retainers.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Draft simple Indian will", "Choose trustworthy executors"]'::jsonb, 19),
  ('bonus-2', 'silver', 'Bonus 2: The High-Net-Worth Health Insurance Audit', '40 mins', 2400, 120, 'Navigating super-top-ups, room-rent capping sub-limits, and modern treatments.', 'https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea', '[]'::jsonb, '["Evaluate family floater vs employer policy", "Eliminate co-pay clauses"]'::jsonb, 20)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- DATABASE HELPER FUNCTIONS
-- ==============================================================================

-- 1. Check if user has active access to a specific tier
CREATE OR REPLACE FUNCTION public.has_active_access(p_email TEXT, p_tier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(p_email));
  v_clean_tier TEXT := lower(trim(p_tier));
BEGIN
  IF v_clean_email = '' OR v_clean_tier = '' THEN
    RETURN false;
  END IF;

  -- Admin emails bypass
  IF v_clean_email = 'dodhia.milan@gmail.com' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.member_access_grants
    WHERE lower(trim(email)) = v_clean_email
      AND access_tier = v_clean_tier
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 2. Count active Silver members (paid, unrefunded direct purchases or upgrades)
-- Excludes Silver included in Gold or Diamond purchases!
CREATE OR REPLACE FUNCTION public.get_active_silver_member_count()
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  SELECT COUNT(DISTINCT lower(trim(email))) INTO v_count
  FROM public.member_access_grants
  WHERE access_tier = 'silver'
    AND source_type IN ('direct_purchase', 'upgrade')
    AND status = 'active';

  RETURN v_count;
END;
$$;

-- 3. Compute Silver price from milestone table based on active Silver member count
CREATE OR REPLACE FUNCTION public.compute_current_silver_pricing()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_base_price INT;
  v_milestones JSONB;
  v_current_price INT;
  v_next_price INT := NULL;
  v_next_threshold INT := NULL;
  v_item JSONB;
  v_m_thresh INT;
  v_m_price INT;
BEGIN
  SELECT silver_base_price, silver_milestones
  INTO v_base_price, v_milestones
  FROM public.commerce_settings
  WHERE id = 1;

  v_count := public.get_active_silver_member_count();
  v_current_price := COALESCE(v_base_price, 6001);

  -- Evaluate milestones
  IF jsonb_typeof(v_milestones) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_milestones)
    LOOP
      v_m_thresh := (v_item->>'threshold')::INT;
      v_m_price := (v_item->>'price')::INT;

      IF v_count >= v_m_thresh THEN
        v_current_price := v_m_price;
      ELSIF v_next_threshold IS NULL OR v_m_thresh < v_next_threshold THEN
        v_next_threshold := v_m_thresh;
        v_next_price := v_m_price;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'current_count', v_count,
    'current_price', v_current_price,
    'next_threshold', v_next_threshold,
    'next_price', v_next_price
  );
END;
$$;

-- 4. Validate and apply discount code
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code TEXT,
  p_product TEXT,
  p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code TEXT := upper(trim(p_code));
  v_discount RECORD;
  v_calc_discount INT := 0;
  v_final_amount INT;
BEGIN
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'empty_code');
  END IF;

  SELECT * INTO v_discount
  FROM public.discount_codes
  WHERE upper(trim(code)) = v_clean_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_or_expired_code');
  END IF;

  -- Check product applicability
  IF NOT ('all' = ANY(v_discount.applies_to_products) OR p_product = ANY(v_discount.applies_to_products)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'code_not_applicable_to_product');
  END IF;

  IF v_discount.discount_type = 'percentage' THEN
    v_calc_discount := ROUND((p_amount * v_discount.discount_value) / 100.0)::INT;
  ELSE
    v_calc_discount := v_discount.discount_value;
  END IF;

  -- Prevent reducing below ₹1
  IF v_calc_discount >= p_amount THEN
    v_calc_discount := p_amount - 1;
  END IF;

  v_final_amount := p_amount - v_calc_discount;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_discount.code,
    'discount_type', v_discount.discount_type,
    'discount_value', v_discount.discount_value,
    'discount_amount', v_calc_discount,
    'final_amount', v_final_amount
  );
END;
$$;

-- 5. Generate sequential invoice/receipt number per Indian financial year
CREATE OR REPLACE FUNCTION public.generate_sequential_invoice_number(p_fy TEXT, p_doc_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_count INT;
  v_seq_text TEXT;
BEGIN
  IF p_doc_type = 'Tax Invoice' THEN
    v_prefix := 'INV-' || p_fy || '/';
  ELSE
    v_prefix := 'RCPT-' || p_fy || '/';
  END IF;

  SELECT COUNT(*) + 1 INTO v_count
  FROM public.invoices
  WHERE financial_year = p_fy
    AND document_type = p_doc_type;

  v_seq_text := v_prefix || LPAD(v_count::TEXT, 4, '0');
  RETURN v_seq_text;
END;
$$;

-- 6. Atomic Grant Procedure: Webhook Capture
CREATE OR REPLACE FUNCTION public.grant_entitlement_on_capture(
  p_order_id UUID,
  p_razorpay_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_settings RECORD;
  v_cohort RECORD;
  v_cohort_id UUID := NULL;
  v_had_silver_before BOOLEAN := false;
  v_gives_silver_first_time BOOLEAN := false;
  v_has_bonus BOOLEAN := false;
  v_silver_buyers_in_cohort INT := 0;
  v_fy TEXT;
  v_month INT;
  v_year INT;
  v_doc_type TEXT;
  v_inv_num TEXT;
  v_download_token TEXT;
  v_includes_desc TEXT;
  v_term_desc TEXT;
  v_now TIMESTAMPTZ := now();
  v_diamond_expiry TIMESTAMPTZ := NULL;
  v_mrc_locked_price INT := NULL;
  v_mrc_window_end TIMESTAMPTZ := NULL;
  v_pricing_info JSONB;
  v_ref_partner RECORD;
  v_ref_reward INT := 0;
BEGIN
  -- 1. Fetch order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  -- Idempotency check: if already captured, return success immediately
  IF v_order.status = 'captured' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_id', v_order.id);
  END IF;

  -- 2. Fetch settings
  SELECT * INTO v_settings
  FROM public.commerce_settings
  WHERE id = 1;

  -- 3. Check prior Silver access
  v_had_silver_before := public.has_active_access(v_order.buyer_email, 'silver');

  -- 4. Cohort Assignment (For Silver or Gold/Diamond buyers who get Silver for first time)
  IF v_order.product_id IN ('silver', 'gold', 'diamond') THEN
    IF NOT v_had_silver_before THEN
      v_gives_silver_first_time := true;
    END IF;

    -- Pick late joiner cohort if open, else next cohort with start_date in future
    IF v_settings.late_joiner_cohort_id IS NOT NULL THEN
      SELECT * INTO v_cohort FROM public.cohorts WHERE id = v_settings.late_joiner_cohort_id;
      v_cohort_id := v_cohort.id;
    END IF;

    IF v_cohort_id IS NULL THEN
      SELECT * INTO v_cohort
      FROM public.cohorts
      WHERE start_date > v_now
      ORDER BY start_date ASC
      LIMIT 1;

      IF FOUND THEN
        v_cohort_id := v_cohort.id;
      END IF;
    END IF;

    -- 1:1 Bonus Evaluation (Only for direct Silver purchases in first N cohorts)
    IF v_order.product_id = 'silver' AND v_cohort.cohort_number <= COALESCE(v_settings.bonus_cohort_count, 2) THEN
      SELECT COUNT(*) INTO v_silver_buyers_in_cohort
      FROM public.member_access_grants
      WHERE cohort_id = v_cohort.id
        AND access_tier = 'silver'
        AND source_type IN ('direct_purchase', 'upgrade')
        AND status = 'active';

      IF v_silver_buyers_in_cohort < COALESCE(v_settings.bonus_per_cohort_count, 10) THEN
        v_has_bonus := true;
      END IF;
    END IF;
  END IF;

  -- 5. Mark Order as Captured
  UPDATE public.orders
  SET
    status = 'captured',
    razorpay_payment_id = p_razorpay_payment_id,
    captured_at = v_now
  WHERE id = v_order.id;

  -- Increment discount code usage if one was applied
  IF v_order.discount_code_applied IS NOT NULL THEN
    UPDATE public.discount_codes
    SET used_count = used_count + 1
    WHERE upper(trim(code)) = upper(trim(v_order.discount_code_applied));
  END IF;

  -- Record referral conversion if referral code was used
  IF v_order.referral_code_applied IS NOT NULL THEN
    SELECT * INTO v_ref_partner
    FROM public.referral_partners
    WHERE lower(trim(code)) = lower(trim(v_order.referral_code_applied))
      AND is_active = true;

    IF FOUND THEN
      IF v_ref_partner.reward_type = 'percentage' THEN
        v_ref_reward := ROUND((v_order.amount_charged * v_ref_partner.reward_value) / 100.0)::INT;
      ELSE
        v_ref_reward := v_ref_partner.reward_value;
      END IF;

      INSERT INTO public.referral_conversions (
        partner_id, order_id, referral_code, buyer_email, order_amount, reward_amount
      ) VALUES (
        v_ref_partner.id, v_order.id, v_order.referral_code_applied, lower(trim(v_order.buyer_email)), v_order.amount_charged, v_ref_reward
      );
    END IF;
  END IF;

  -- Also update legacy registrations table if present
  UPDATE public.registrations
  SET status = 'purchased'
  WHERE email = lower(trim(v_order.buyer_email));

  -- 6. Insert Access Grants according to Tier Hierarchy
  IF v_order.product_id = 'money_reality_check' THEN
    -- MRC locked price and window
    v_pricing_info := public.compute_current_silver_pricing();
    v_mrc_locked_price := (v_pricing_info->>'current_price')::INT;
    v_mrc_window_end := (v_now + interval '30 days');

    INSERT INTO public.member_access_grants (
      email, access_tier, source_type, order_id, status,
      thursday_seat_expires_at,
      community_access_starts_at,
      community_access_expires_at,
      locked_silver_upgrade_price,
      silver_upgrade_deadline
    ) VALUES (
      lower(trim(v_order.buyer_email)),
      'money_reality_check',
      'direct_purchase',
      v_order.id,
      'active',
      v_now + interval '60 days',
      CASE WHEN v_settings.community_url IS NOT NULL AND v_settings.community_url <> '' THEN v_now ELSE NULL END,
      CASE WHEN v_settings.community_url IS NOT NULL AND v_settings.community_url <> '' THEN v_now + interval '60 days' ELSE NULL END,
      v_mrc_locked_price,
      v_mrc_window_end
    );

    v_includes_desc := 'Money Reality Check 12-session track, 4 diagnostic tools, 1 Thursday guest seat (60 days), 60 days community access';
    v_term_desc := 'Lifetime video curriculum access · 60 days guest & community privileges';

  ELSIF v_order.product_id = 'silver' THEN
    INSERT INTO public.member_access_grants (
      email, access_tier, source_type, order_id, status,
      cohort_id, has_one_on_one_bonus
    ) VALUES (
      lower(trim(v_order.buyer_email)),
      'silver',
      CASE WHEN v_order.pricing_rule_applied = 'mrc_credit' THEN 'upgrade' ELSE 'direct_purchase' END,
      v_order.id,
      'active',
      v_cohort_id,
      v_has_bonus
    );

    v_includes_desc := 'The Calm Money System · Full Silver curriculum, execution missions, VIP toolkits & live cohort access';
    v_term_desc := 'Lifetime Access';

  ELSIF v_order.product_id = 'gold' THEN
    -- Grants Gold (Lifetime)
    INSERT INTO public.member_access_grants (
      email, access_tier, source_type, order_id, status
    ) VALUES (
      lower(trim(v_order.buyer_email)),
      'gold',
      CASE WHEN v_order.pricing_rule_applied = 'special_upgrade_price' THEN 'upgrade' ELSE 'direct_purchase' END,
      v_order.id,
      'active'
    );

    -- Also includes Silver (Lifetime)
    INSERT INTO public.member_access_grants (
      email, access_tier, source_type, parent_product, order_id, status,
      cohort_id
    ) VALUES (
      lower(trim(v_order.buyer_email)),
      'silver',
      'included_in_tier',
      'gold',
      v_order.id,
      'active',
      v_cohort_id
    );

    v_includes_desc := 'Gold Master Access · Includes Lifetime Gold Access and Lifetime Silver Access';
    v_term_desc := 'Lifetime Access';

  ELSIF v_order.product_id IN ('diamond', 'diamond_renewal') THEN
    v_diamond_expiry := (v_now + interval '1 year');

    -- Grants Diamond (12 months)
    INSERT INTO public.member_access_grants (
      email, access_tier, source_type, order_id, status, expires_at
    ) VALUES (
      lower(trim(v_order.buyer_email)),
      'diamond',
      CASE WHEN v_order.product_id = 'diamond_renewal' THEN 'renewal' ELSE 'direct_purchase' END,
      v_order.id,
      'active',
      v_diamond_expiry
    );

    -- First Diamond purchase grants lifetime Silver and lifetime Gold
    IF v_order.product_id = 'diamond' THEN
      INSERT INTO public.member_access_grants (
        email, access_tier, source_type, parent_product, order_id, status
      ) VALUES (
        lower(trim(v_order.buyer_email)),
        'gold',
        'included_in_tier',
        'diamond',
        v_order.id,
        'active'
      );

      INSERT INTO public.member_access_grants (
        email, access_tier, source_type, parent_product, order_id, status,
        cohort_id
      ) VALUES (
        lower(trim(v_order.buyer_email)),
        'silver',
        'included_in_tier',
        'diamond',
        v_order.id,
        'active',
        v_cohort_id
      );
    END IF;

    v_includes_desc := 'Diamond Elite Access · Includes 12 Months Diamond Access + Lifetime Gold Access + Lifetime Silver Access';
    v_term_desc := 'Diamond term: Valid until ' || to_char(v_diamond_expiry, 'DD Mon YYYY 11:59:59 PM IST') || ' · Silver & Gold: Lifetime';
  END IF;

  -- 7. Generate Invoice / Receipt
  v_month := EXTRACT(MONTH FROM v_now)::INT;
  v_year := EXTRACT(YEAR FROM v_now)::INT;
  IF v_month >= 4 THEN
    v_fy := v_year::TEXT || '-' || LPAD(((v_year + 1) % 100)::TEXT, 2, '0');
  ELSE
    v_fy := (v_year - 1)::TEXT || '-' || LPAD((v_year % 100)::TEXT, 2, '0');
  END IF;

  IF v_settings.gstin IS NOT NULL AND trim(v_settings.gstin) <> '' THEN
    v_doc_type := 'Tax Invoice';
  ELSE
    v_doc_type := 'Receipt';
  END IF;

  v_inv_num := public.generate_sequential_invoice_number(v_fy, v_doc_type);
  v_download_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.invoices (
    order_id, invoice_number, financial_year, document_type,
    legal_entity_name, registered_address, gstin, sac_code,
    buyer_name, buyer_email, product_id, product_name,
    includes_description, term_description,
    base_price, credit_applied, special_upgrade_discount, discount_amount, amount_paid,
    download_token
  ) VALUES (
    v_order.id, v_inv_num, v_fy, v_doc_type,
    v_settings.legal_entity_name, v_settings.registered_address, v_settings.gstin, v_settings.sac_code,
    COALESCE(v_order.buyer_name, 'Valued Member'), v_order.buyer_email, v_order.product_id,
    CASE
      WHEN v_order.product_id = 'money_reality_check' THEN 'Money Reality Check'
      WHEN v_order.product_id = 'silver' THEN 'The Calm Money System (Silver)'
      WHEN v_order.product_id = 'gold' THEN 'Gold Master Access'
      WHEN v_order.product_id = 'diamond' THEN 'Diamond Elite Access (Annual)'
      WHEN v_order.product_id = 'diamond_renewal' THEN 'Diamond Elite Access (Annual Renewal)'
      ELSE v_order.product_id
    END,
    v_includes_desc, v_term_desc,
    v_order.base_price, v_order.credit_applied,
    CASE WHEN v_order.pricing_rule_applied = 'special_upgrade_price' THEN (v_order.base_price - v_order.amount_charged) ELSE 0 END,
    v_order.discount_amount,
    v_order.amount_charged,
    v_download_token
  );

  -- 8. Emit Events for Prompt 4
  INSERT INTO public.commerce_events (event_name, email, payload)
  VALUES (
    'purchase_completed',
    lower(trim(v_order.buyer_email)),
    jsonb_build_object(
      'product', v_order.product_id,
      'amount', v_order.amount_charged,
      'invoice_number', v_inv_num,
      'invoice_token', v_download_token,
      'invoice_link', '/api/invoices/' || v_download_token,
      'access_granted', v_order.product_id,
      'gives_silver_first_time', v_gives_silver_first_time,
      'cohort_number', v_cohort.cohort_number,
      'cohort_name', v_cohort.name,
      'cohort_start_date', v_cohort.start_date,
      'has_one_on_one_bonus', v_has_bonus,
      'mrc_locked_price', v_mrc_locked_price,
      'mrc_window_end_date', v_mrc_window_end,
      'referral_code', v_order.referral_code_applied,
      'discount_code', v_order.discount_code_applied
    )
  );

  IF v_order.product_id = 'money_reality_check' THEN
    INSERT INTO public.commerce_events (event_name, email, payload)
    VALUES (
      'silver_upgrade_window_opened',
      lower(trim(v_order.buyer_email)),
      jsonb_build_object(
        'locked_price', v_mrc_locked_price,
        'deadline', v_mrc_window_end
      )
    );
  END IF;

  IF v_order.pricing_rule_applied IN ('mrc_credit', 'special_upgrade_price') THEN
    INSERT INTO public.commerce_events (event_name, email, payload)
    VALUES (
      'upgrade_completed',
      lower(trim(v_order.buyer_email)),
      jsonb_build_object(
        'from_product', CASE WHEN v_order.pricing_rule_applied = 'mrc_credit' THEN 'money_reality_check' ELSE 'silver' END,
        'to_product', v_order.product_id,
        'amount_paid', v_order.amount_charged
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'invoice_number', v_inv_num,
    'download_token', v_download_token,
    'has_bonus', v_has_bonus
  );
END;
$$;

-- 7. Atomic Refund Procedure
CREATE OR REPLACE FUNCTION public.revoke_entitlement_on_refund(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  -- Mark order refunded
  UPDATE public.orders
  SET
    status = 'refunded',
    refunded_at = now()
  WHERE id = v_order.id;

  -- Revoke grants associated directly with this order
  UPDATE public.member_access_grants
  SET
    status = 'revoked',
    revoked_at = now()
  WHERE order_id = v_order.id;

  -- Emit refund event
  INSERT INTO public.commerce_events (event_name, email, payload)
  VALUES (
    'refund_processed',
    lower(trim(v_order.buyer_email)),
    jsonb_build_object(
      'product', v_order.product_id,
      'order_id', v_order.id,
      'amount', v_order.amount_charged
    )
  );

  RETURN jsonb_build_object('ok', true, 'order_id', v_order.id);
END;
$$;

-- 8. Manual Grant Procedure
CREATE OR REPLACE FUNCTION public.record_manual_grant(
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_product_id TEXT,
  p_reason_note TEXT,
  p_admin TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id UUID;
  v_cohort RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_reason_note IS NULL OR trim(p_reason_note) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_note_required');
  END IF;

  INSERT INTO public.manual_grants (email, name, phone, product_id, reason_note, granted_by)
  VALUES (lower(trim(p_email)), p_name, p_phone, p_product_id, p_reason_note, p_admin)
  RETURNING id INTO v_grant_id;

  IF p_product_id IN ('silver', 'gold', 'diamond') THEN
    SELECT * INTO v_cohort FROM public.cohorts WHERE start_date > v_now ORDER BY start_date ASC LIMIT 1;
  END IF;

  INSERT INTO public.member_access_grants (
    email, access_tier, source_type, manual_grant_id, status, cohort_id
  ) VALUES (
    lower(trim(p_email)),
    p_product_id,
    'manual_grant',
    v_grant_id,
    'active',
    v_cohort.id
  );

  RETURN jsonb_build_object('ok', true, 'manual_grant_id', v_grant_id);
END;
$$;

-- 9. Bulk Upload Members Procedure
CREATE OR REPLACE FUNCTION public.bulk_upload_members(
  p_users JSONB,
  p_admin TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user JSONB;
  v_email TEXT;
  v_name TEXT;
  v_phone TEXT;
  v_tier TEXT;
  v_notes TEXT;
  v_cohort_num INT;
  v_cohort_id UUID;
  v_imported_count INT := 0;
  v_grant_id UUID;
BEGIN
  IF jsonb_typeof(p_users) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'input_must_be_array');
  END IF;

  FOR v_user IN SELECT * FROM jsonb_array_elements(p_users)
  LOOP
    v_email := lower(trim(v_user->>'email'));
    v_name := trim(COALESCE(v_user->>'name', ''));
    v_phone := trim(COALESCE(v_user->>'phone', ''));
    v_tier := lower(trim(COALESCE(v_user->>'tier', 'silver')));
    v_notes := trim(COALESCE(v_user->>'notes', 'Bulk imported user'));
    v_cohort_num := (v_user->>'cohort_number')::INT;

    IF v_email <> '' AND v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      -- Resolve cohort if specified
      v_cohort_id := NULL;
      IF v_cohort_num IS NOT NULL THEN
        SELECT id INTO v_cohort_id FROM public.cohorts WHERE cohort_number = v_cohort_num;
      END IF;

      IF v_cohort_id IS NULL AND v_tier IN ('silver', 'gold', 'diamond') THEN
        SELECT id INTO v_cohort_id FROM public.cohorts WHERE start_date > now() ORDER BY start_date ASC LIMIT 1;
      END IF;

      -- Create manual grant log
      INSERT INTO public.manual_grants (email, name, phone, product_id, reason_note, granted_by)
      VALUES (v_email, v_name, v_phone, v_tier, v_notes, p_admin)
      RETURNING id INTO v_grant_id;

      -- Create member access grant
      INSERT INTO public.member_access_grants (
        email, access_tier, source_type, manual_grant_id, status, cohort_id
      ) VALUES (
        v_email, v_tier, 'bulk_upload', v_grant_id, 'active', v_cohort_id
      );

      -- If Gold or Diamond, also grant included tiers
      IF v_tier = 'gold' THEN
        INSERT INTO public.member_access_grants (
          email, access_tier, source_type, parent_product, manual_grant_id, status, cohort_id
        ) VALUES (
          v_email, 'silver', 'included_in_tier', 'gold', v_grant_id, 'active', v_cohort_id
        );
      ELSIF v_tier = 'diamond' THEN
        INSERT INTO public.member_access_grants (
          email, access_tier, source_type, parent_product, manual_grant_id, status
        ) VALUES (
          v_email, 'gold', 'included_in_tier', 'diamond', v_grant_id, 'active'
        );
        INSERT INTO public.member_access_grants (
          email, access_tier, source_type, parent_product, manual_grant_id, status, cohort_id
        ) VALUES (
          v_email, 'silver', 'included_in_tier', 'diamond', v_grant_id, 'active', v_cohort_id
        );
      END IF;

      v_imported_count := v_imported_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'imported_count', v_imported_count);
END;
$$;

-- 10. Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.commerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons_catalog ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role full access on commerce_settings" ON public.commerce_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on cohorts" ON public.cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on discount_codes" ON public.discount_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on referral_partners" ON public.referral_partners FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on orders" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on referral_conversions" ON public.referral_conversions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on member_access_grants" ON public.member_access_grants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on invoices" ON public.invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on manual_grants" ON public.manual_grants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on commerce_events" ON public.commerce_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on reconciliation_flags" ON public.reconciliation_flags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on course_completions" ON public.course_completions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on course_lessons_catalog" ON public.course_lessons_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Permissions
GRANT EXECUTE ON FUNCTION public.has_active_access(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_silver_member_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_current_silver_pricing() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_sequential_invoice_number(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_entitlement_on_capture(UUID, TEXT) TO service_role, anon;
GRANT EXECUTE ON FUNCTION public.revoke_entitlement_on_refund(UUID) TO service_role, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_grant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role, anon;
GRANT EXECUTE ON FUNCTION public.bulk_upload_members(JSONB, TEXT) TO service_role, anon;
