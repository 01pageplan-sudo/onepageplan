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
  v_clean_email TEXT := lower(trim(coalesce(p_email, '')));
  v_clean_tier TEXT := lower(trim(coalesce(p_tier, '')));
BEGIN
  IF v_clean_tier = '' THEN
    RETURN false;
  END IF;

  -- Admin emails bypass
  IF v_clean_email = 'dodhia.milan@gmail.com' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.member_access_grants
    WHERE (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (v_clean_email <> '' AND lower(trim(email)) = v_clean_email)
    )
    AND access_tier = v_clean_tier
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 6. Keep backward-compatible has_active_access for background tasks
CREATE OR REPLACE FUNCTION public.has_active_access(p_email TEXT, p_tier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_active_access_for_user(NULL, p_email, p_tier);
END;
$$;

-- 7. Idempotent function to link all existing and historical purchases to auth.users.id
CREATE OR REPLACE FUNCTION public.link_user_entitlements(
  p_user_id UUID,
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(coalesce(p_email, '')));
BEGIN
  IF p_user_id IS NULL OR v_clean_email = '' THEN
    RETURN;
  END IF;

  -- Link member_access_grants
  UPDATE public.member_access_grants
  SET user_id = p_user_id
  WHERE lower(trim(email)) = v_clean_email
    AND (user_id IS NULL OR user_id = p_user_id);

  -- Link orders
  UPDATE public.orders
  SET user_id = p_user_id
  WHERE lower(trim(buyer_email)) = v_clean_email
    AND (user_id IS NULL OR user_id = p_user_id);

  -- Link course_completions
  UPDATE public.course_completions
  SET user_id = p_user_id
  WHERE lower(trim(email)) = v_clean_email
    AND (user_id IS NULL OR user_id = p_user_id);

  -- Link course_comments
  UPDATE public.course_comments
  SET user_id = p_user_id
  WHERE lower(trim(author_email)) = v_clean_email
    AND (user_id IS NULL OR user_id = p_user_id);
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

-- 9. Permissions
GRANT EXECUTE ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_access(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_user_entitlements(UUID, TEXT) TO authenticated, service_role;
