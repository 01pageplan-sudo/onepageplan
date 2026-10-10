-- ==============================================================================
-- CORRECTIVE SECURITY & RELIABILITY MIGRATION
-- 1. Align public.commerce_events columns (event_name <-> event_type) so
--    grant_entitlement_on_capture, revoke_entitlement_on_refund, claim_course_reward,
--    and webhook inserts never fail with 42703 column missing or NOT NULL errors.
-- 2. Restrict SECURITY DEFINER administrative & entitlement RPCs
--    (record_manual_grant, bulk_upload_members, save_completion_template,
--     rollback_completion_template, grant_entitlement_on_capture,
--     revoke_entitlement_on_refund) to service_role only and revoke anon access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ALIGN public.commerce_events SCHEMA (event_name <-> event_type)
-- ------------------------------------------------------------------------------
ALTER TABLE public.commerce_events
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

UPDATE public.commerce_events
SET
  event_name = COALESCE(event_name, event_type, 'unknown'),
  event_type = COALESCE(event_type, event_name, 'unknown')
WHERE event_name IS NULL OR event_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_events_name
  ON public.commerce_events (event_name);

CREATE OR REPLACE FUNCTION public.sync_commerce_events_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.event_name IS NULL AND NEW.event_type IS NOT NULL THEN
    NEW.event_name := NEW.event_type;
  ELSIF NEW.event_type IS NULL AND NEW.event_name IS NOT NULL THEN
    NEW.event_type := NEW.event_name;
  ELSIF NEW.event_name IS NULL AND NEW.event_type IS NULL THEN
    NEW.event_name := 'unknown';
    NEW.event_type := 'unknown';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_commerce_events_name_type ON public.commerce_events;

CREATE TRIGGER trg_sync_commerce_events_name_type
  BEFORE INSERT OR UPDATE ON public.commerce_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_commerce_events_columns();

-- ------------------------------------------------------------------------------
-- 2. SECURE record_manual_grant (service_role only)
-- ------------------------------------------------------------------------------
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
  v_jwt_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  );
  v_grant_id UUID;
  v_cohort RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  THEN
    RAISE EXCEPTION 'Unauthorized: record_manual_grant requires service_role'
      USING ERRCODE = '42501';
  END IF;

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

REVOKE ALL ON FUNCTION public.record_manual_grant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_grant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. SECURE bulk_upload_members (service_role only)
-- ------------------------------------------------------------------------------
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
  v_jwt_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  );
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
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  THEN
    RAISE EXCEPTION 'Unauthorized: bulk_upload_members requires service_role'
      USING ERRCODE = '42501';
  END IF;

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
      v_cohort_id := NULL;
      IF v_cohort_num IS NOT NULL THEN
        SELECT id INTO v_cohort_id FROM public.cohorts WHERE cohort_number = v_cohort_num;
      END IF;

      IF v_cohort_id IS NULL AND v_tier IN ('silver', 'gold', 'diamond') THEN
        SELECT id INTO v_cohort_id FROM public.cohorts WHERE start_date > now() ORDER BY start_date ASC LIMIT 1;
      END IF;

      INSERT INTO public.manual_grants (email, name, phone, product_id, reason_note, granted_by)
      VALUES (v_email, v_name, v_phone, v_tier, v_notes, p_admin)
      RETURNING id INTO v_grant_id;

      INSERT INTO public.member_access_grants (
        email, access_tier, source_type, manual_grant_id, status, cohort_id
      ) VALUES (
        v_email, v_tier, 'bulk_upload', v_grant_id, 'active', v_cohort_id
      );

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

REVOKE ALL ON FUNCTION public.bulk_upload_members(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_upload_members(JSONB, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. SECURE save_completion_template & rollback_completion_template (service_role only)
-- ------------------------------------------------------------------------------
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
  v_jwt_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  );
  v_next_version INT := 1;
  v_inserted_id UUID;
BEGIN
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  THEN
    RAISE EXCEPTION 'Unauthorized: save_completion_template requires service_role'
      USING ERRCODE = '42501';
  END IF;

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

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_inserted_id,
    'slug', p_slug,
    'version', v_next_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_completion_template(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_completion_template(TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rollback_completion_template(
  p_slug TEXT,
  p_target_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  );
BEGIN
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  THEN
    RAISE EXCEPTION 'Unauthorized: rollback_completion_template requires service_role'
      USING ERRCODE = '42501';
  END IF;

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

  RETURN jsonb_build_object(
    'ok', true,
    'slug', p_slug,
    'active_version', p_target_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_completion_template(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_completion_template(TEXT, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. SECURE revoke_entitlement_on_refund & grant_entitlement_on_capture (service_role only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_entitlement_on_refund(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(
    current_setting('request.jwt.claim.role', true),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  );
  v_order RECORD;
BEGIN
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  THEN
    RAISE EXCEPTION 'Unauthorized: revoke_entitlement_on_refund requires service_role'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  UPDATE public.orders
  SET
    status = 'refunded',
    refunded_at = now()
  WHERE id = v_order.id;

  UPDATE public.member_access_grants
  SET
    status = 'revoked',
    revoked_at = now()
  WHERE order_id = v_order.id;

  INSERT INTO public.commerce_events (event_name, event_type, email, payload)
  VALUES (
    'refund_processed',
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

REVOKE ALL ON FUNCTION public.revoke_entitlement_on_refund(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_entitlement_on_refund(UUID) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.grant_entitlement_on_capture(uuid,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.grant_entitlement_on_capture(UUID, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.grant_entitlement_on_capture(UUID, TEXT) TO service_role;
  END IF;
END $$;
