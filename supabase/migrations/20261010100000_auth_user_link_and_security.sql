-- ==============================================================================
-- AUTHENTICATION & SECURITY: Link Entitlements with Supabase Auth users
-- Migration: 20261010100000_auth_user_link_and_security.sql
-- ==============================================================================

-- 1. Add user_id column referencing auth.users in member_access_grants
ALTER TABLE public.member_access_grants
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mag_user_id ON public.member_access_grants (user_id);

-- 2. Add user_id column referencing auth.users in orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);

-- 3. Add user_id column referencing auth.users in course_completions
ALTER TABLE public.course_completions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_completions_user_id ON public.course_completions (user_id);

-- 4. Add user_id column referencing auth.users in course_comments
ALTER TABLE public.course_comments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.course_comments (user_id);

-- 5. Helper function to check active access by user_id OR verified email
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

  IF v_jwt_role = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: anonymous callers cannot verify member access'
      USING ERRCODE = '42501';
  END IF;

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

  -- Admin emails bypass (only after email verification above)
  IF v_effective_email = 'dodhia.milan@gmail.com' THEN
    RETURN true;
  END IF;

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

-- 6. Keep backward-compatible has_active_access for internal SQL / service_role tasks
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

  GET DIAGNOSTICS v_call_stack = PG_CONTEXT;

  IF position('PL/pgSQL function' in coalesce(v_call_stack, '')) > 0
     AND length(v_call_stack) - length(replace(v_call_stack, 'PL/pgSQL function', '')) <= length('PL/pgSQL function')
     AND v_jwt_role NOT IN ('service_role', '')
  THEN
    IF v_jwt_role = 'anon' THEN
      RAISE EXCEPTION 'Unauthorized: anonymous callers cannot check member access'
        USING ERRCODE = '42501';
    END IF;

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

-- 7. Idempotent function to link all existing and historical purchases to auth.users.id
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
  IF v_jwt_role = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: anonymous callers cannot link entitlements'
      USING ERRCODE = '42501';
  END IF;

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

  SELECT lower(trim(email))
  INTO v_verified_email
  FROM auth.users
  WHERE id = v_target_user_id;

  IF v_verified_email IS NULL OR v_verified_email = '' THEN
    RAISE EXCEPTION 'Unauthorized: user_id not found in auth.users'
      USING ERRCODE = '42501';
  END IF;

  IF v_clean_email <> '' AND v_clean_email <> v_verified_email THEN
    RAISE EXCEPTION 'Unauthorized: supplied email does not match verified user email in auth.users'
      USING ERRCODE = '42501';
  END IF;

  -- Link member_access_grants
  UPDATE public.member_access_grants
  SET user_id = v_target_user_id
  WHERE lower(trim(email)) = v_verified_email
    AND user_id IS NULL;

  -- Link orders
  UPDATE public.orders
  SET user_id = v_target_user_id
  WHERE lower(trim(buyer_email)) = v_verified_email
    AND user_id IS NULL;

  -- Link course_completions
  UPDATE public.course_completions
  SET user_id = v_target_user_id
  WHERE lower(trim(email)) = v_verified_email
    AND user_id IS NULL;

  -- Link course_comments
  UPDATE public.course_comments
  SET user_id = v_target_user_id
  WHERE lower(trim(author_email)) = v_verified_email
    AND user_id IS NULL;
END;
$$;

-- 8. Auto-link trigger when new grants or orders are inserted
CREATE OR REPLACE FUNCTION public.auto_link_user_on_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched_user_id UUID;
  v_target_email TEXT;
BEGIN
  v_target_email := COALESCE(
    CASE WHEN TG_TABLE_NAME = 'orders' THEN (NEW.buyer_email) ELSE (NEW.email) END,
    ''
  );

  IF NEW.user_id IS NULL AND v_target_email <> '' THEN
    SELECT id INTO v_matched_user_id
    FROM auth.users
    WHERE lower(trim(email)) = lower(trim(v_target_email))
    LIMIT 1;

    IF v_matched_user_id IS NOT NULL THEN
      NEW.user_id := v_matched_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_link_user_grants ON public.member_access_grants;
CREATE TRIGGER trigger_auto_link_user_grants
  BEFORE INSERT ON public.member_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_user_on_grant();

DROP TRIGGER IF EXISTS trigger_auto_link_user_orders ON public.orders;
CREATE TRIGGER trigger_auto_link_user_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_user_on_grant();

-- 9. Strict Function Execution Permissions (service_role only for RPC)
REVOKE ALL ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.has_active_access(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.link_user_entitlements(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_user_entitlements(UUID, TEXT) TO service_role;
