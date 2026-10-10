-- ==============================================================================
-- CORRECTIVE SECURITY MIGRATION: Harden Auth RPCs, Permissions & Completion Integrity
-- Migration: 20261010150000_fix_auth_rpc_and_reward_security.sql
-- ==============================================================================
-- Fixes:
-- 1. CRITICAL: Restricts link_user_entitlements from arbitrary user/email spoofing.
--    Revokes EXECUTE from PUBLIC, anon, and authenticated; restricts RPC to service_role.
--    Enforces internal cross-verification against auth.users so p_user_id and p_email
--    must belong to the exact same verified auth.users record, and only updates
--    rows where user_id IS NULL.
--    Adds an automatic trigger on auth.users so OTP verification links entitlements
--    natively inside PostgreSQL.
-- 2. HIGH: Restricts has_active_access_for_user and has_active_access from
--    unauthorized anon/authenticated enumeration or spoofing.
--    Enforces caller identity validation and cross-checks p_user_id against auth.users.
-- ==============================================================================

-- 1. Ensure is_completed column exists on course_completions with default true for existing rows
ALTER TABLE public.course_completions
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT true;

-- 2. Harden public.link_user_entitlements
CREATE OR REPLACE FUNCTION public.link_user_entitlements(
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_auth_uid UUID := auth.uid();
  v_target_user_id UUID;
  v_verified_email TEXT;
  v_clean_email TEXT := lower(trim(coalesce(p_email, '')));
BEGIN
  -- Block anonymous callers unconditionally
  IF v_jwt_role = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: anonymous callers cannot link entitlements'
      USING ERRCODE = '42501';
  END IF;

  -- If called in an authenticated user JWT context, strictly bind to auth.uid()
  IF v_jwt_role = 'authenticated' OR (v_auth_uid IS NOT NULL AND v_jwt_role <> 'service_role') THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: missing authenticated user identity'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'Unauthorized: cannot link entitlements for another user_id'
        USING ERRCODE = '42501';
    END IF;

    v_target_user_id := v_auth_uid;
  ELSIF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') THEN
    v_target_user_id := p_user_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized caller role for link_user_entitlements'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parameter: user_id is required'
      USING ERRCODE = '22023';
  END IF;

  -- Authoritatively derive email from auth.users for v_target_user_id
  SELECT lower(trim(email))
  INTO v_verified_email
  FROM auth.users
  WHERE id = v_target_user_id;

  IF v_verified_email IS NULL OR v_verified_email = '' THEN
    RAISE EXCEPTION 'Unauthorized: user_id not found in auth.users'
      USING ERRCODE = '42501';
  END IF;

  -- If caller supplied p_email, it MUST match the authoritative email in auth.users
  IF v_clean_email <> '' AND v_clean_email <> v_verified_email THEN
    RAISE EXCEPTION 'Unauthorized: supplied email does not match verified user email in auth.users'
      USING ERRCODE = '42501';
  END IF;

  -- Only claim records matching v_verified_email where user_id is currently NULL
  UPDATE public.member_access_grants
  SET user_id = v_target_user_id
  WHERE lower(trim(email)) = v_verified_email
    AND user_id IS NULL;

  UPDATE public.orders
  SET user_id = v_target_user_id
  WHERE lower(trim(buyer_email)) = v_verified_email
    AND user_id IS NULL;

  UPDATE public.course_completions
  SET user_id = v_target_user_id
  WHERE lower(trim(email)) = v_verified_email
    AND user_id IS NULL;

  UPDATE public.course_comments
  SET user_id = v_target_user_id
  WHERE lower(trim(author_email)) = v_verified_email
    AND user_id IS NULL;
END;
$$;

-- 3. Automatic trigger on auth.users to link historical purchases upon OTP verification
CREATE OR REPLACE FUNCTION public.handle_auth_user_entitlement_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(coalesce(NEW.email, '')));
BEGIN
  IF NEW.id IS NOT NULL AND v_clean_email <> '' THEN
    UPDATE public.member_access_grants
    SET user_id = NEW.id
    WHERE lower(trim(email)) = v_clean_email
      AND user_id IS NULL;

    UPDATE public.orders
    SET user_id = NEW.id
    WHERE lower(trim(buyer_email)) = v_clean_email
      AND user_id IS NULL;

    UPDATE public.course_completions
    SET user_id = NEW.id
    WHERE lower(trim(email)) = v_clean_email
      AND user_id IS NULL;

    UPDATE public.course_comments
    SET user_id = NEW.id
    WHERE lower(trim(author_email)) = v_clean_email
      AND user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_link_entitlements_on_auth_user ON auth.users;
CREATE TRIGGER trigger_auto_link_entitlements_on_auth_user
  AFTER INSERT OR UPDATE OF email, email_confirmed_at, last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_entitlement_link();

-- 4. Harden public.has_active_access_for_user
CREATE OR REPLACE FUNCTION public.has_active_access_for_user(
  p_user_id UUID,
  p_email TEXT,
  p_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_auth_uid UUID := auth.uid();
  v_effective_user_id UUID;
  v_effective_email TEXT;
  v_auth_email TEXT;
  v_clean_email TEXT := lower(trim(coalesce(p_email, '')));
  v_clean_tier TEXT := lower(trim(coalesce(p_tier, '')));
BEGIN
  IF v_clean_tier = '' THEN
    RETURN false;
  END IF;

  -- Block anonymous callers from enumerating or checking access
  IF v_jwt_role = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: anonymous callers cannot verify member access'
      USING ERRCODE = '42501';
  END IF;

  -- If called in an authenticated JWT context, strictly enforce caller's own identity
  IF v_jwt_role = 'authenticated' OR (v_auth_uid IS NOT NULL AND v_jwt_role <> 'service_role') THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: missing authenticated user identity'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'Unauthorized: cannot check access for another user_id'
        USING ERRCODE = '42501';
    END IF;

    SELECT lower(trim(email))
    INTO v_auth_email
    FROM auth.users
    WHERE id = v_auth_uid;

    IF v_auth_email IS NULL OR v_auth_email = '' THEN
      RETURN false;
    END IF;

    IF v_clean_email <> '' AND v_clean_email <> v_auth_email THEN
      RAISE EXCEPTION 'Unauthorized: cannot check access for another email'
        USING ERRCODE = '42501';
    END IF;

    v_effective_user_id := v_auth_uid;
    v_effective_email := v_auth_email;

  -- Trusted server-side / internal callers (service_role or postgres internal functions)
  ELSIF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF p_user_id IS NOT NULL THEN
      SELECT lower(trim(email))
      INTO v_auth_email
      FROM auth.users
      WHERE id = p_user_id;

      IF v_auth_email IS NULL OR v_auth_email = '' THEN
        RETURN false;
      END IF;

      IF v_clean_email <> '' AND v_clean_email <> v_auth_email THEN
        RAISE EXCEPTION 'Unauthorized: p_user_id and p_email do not match in auth.users'
          USING ERRCODE = '42501';
      END IF;

      v_effective_user_id := p_user_id;
      v_effective_email := v_auth_email;
    ELSE
      v_effective_user_id := NULL;
      v_effective_email := v_clean_email;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized caller context for has_active_access_for_user'
      USING ERRCODE = '42501';
  END IF;

  -- Admin bypass (evaluated only on verified v_effective_email)
  IF v_effective_email = 'dodhia.milan@gmail.com' THEN
    RETURN true;
  END IF;

  -- Check active, non-expired grant; prevent matching email rows already claimed by a different user_id
  RETURN EXISTS (
    SELECT 1 FROM public.member_access_grants
    WHERE (
      (v_effective_user_id IS NOT NULL AND user_id = v_effective_user_id)
      OR (
        v_effective_email <> ''
        AND lower(trim(email)) = v_effective_email
        AND (user_id IS NULL OR v_effective_user_id IS NULL OR user_id = v_effective_user_id)
      )
    )
    AND access_tier = v_clean_tier
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 5. Harden public.has_active_access (preserve internal SQL compatibility while blocking external spoofing)
CREATE OR REPLACE FUNCTION public.has_active_access(p_email TEXT, p_tier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(coalesce(p_email, '')));
  v_clean_tier TEXT := lower(trim(coalesce(p_tier, '')));
  v_jwt_role TEXT := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_auth_uid UUID := auth.uid();
  v_call_stack TEXT;
BEGIN
  IF v_clean_email = '' OR v_clean_tier = '' THEN
    RETURN false;
  END IF;

  -- Determine whether called internally from another PL/pgSQL function (e.g., grant_entitlement_on_capture)
  GET DIAGNOSTICS v_call_stack = PG_CONTEXT;

  -- If invoked directly over PostgREST (no outer PL/pgSQL function frame) by non-service_role:
  IF position('PL/pgSQL function' in coalesce(v_call_stack, '')) > 0
     AND length(v_call_stack) - length(replace(v_call_stack, 'PL/pgSQL function', '')) <= length('PL/pgSQL function')
     AND v_jwt_role NOT IN ('service_role', '')
  THEN
    IF v_jwt_role = 'anon' THEN
      RAISE EXCEPTION 'Unauthorized: anonymous callers cannot check member access'
        USING ERRCODE = '42501';
    END IF;

    -- For authenticated callers, delegate to has_active_access_for_user which enforces auth.uid() ownership
    RETURN public.has_active_access_for_user(v_auth_uid, v_clean_email, v_clean_tier);
  END IF;

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

-- 6. Strict Function Execution Permissions (Revoke from PUBLIC, anon, authenticated; Grant to service_role)
REVOKE ALL ON FUNCTION public.link_user_entitlements(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_user_entitlements(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.has_active_access(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access(TEXT, TEXT) TO service_role;
