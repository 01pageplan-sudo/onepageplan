-- Migration: 20261003230000_completion_templates.sql
-- Description: Completion page templates, versioning, rollback, token render warnings, and reward form tracking

-- 1. COMPLETION PAGE TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.completion_page_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL, -- e.g. 'money-reality-check', 'silver', 'silver-upgrade', 'gold', 'diamond', 'course-complete'
  version INT NOT NULL DEFAULT 1,
  html_content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpt_slug_active ON public.completion_page_templates (slug, is_active);
CREATE INDEX IF NOT EXISTS idx_cpt_slug_version ON public.completion_page_templates (slug, version DESC);

-- Ensure only one template is active per slug at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_cpt_single_active_per_slug
  ON public.completion_page_templates (slug)
  WHERE (is_active = true);

-- 2. TOKEN RENDER WARNINGS LOG
CREATE TABLE IF NOT EXISTS public.token_render_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  unknown_tokens JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trw_slug_created ON public.token_render_warnings (slug, created_at DESC);

-- 3. EXTEND COURSE COMPLETIONS FOR REWARDS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'course_completions' AND column_name = 'certificate_name'
  ) THEN
    ALTER TABLE public.course_completions 
      ADD COLUMN certificate_name TEXT,
      ADD COLUMN tshirt_size TEXT,
      ADD COLUMN shipping_address TEXT,
      ADD COLUMN reward_submitted_at TIMESTAMPTZ;
  END IF;
END $$;

-- 4. FUNCTION TO UPLOAD OR REPLACE TEMPLATE (ATOMIC ROLLBACK / VERSION INCREMENT)
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
  -- Find max version for this slug
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.completion_page_templates
  WHERE slug = p_slug;

  -- Deactivate previous active version
  UPDATE public.completion_page_templates
  SET is_active = false
  WHERE slug = p_slug AND is_active = true;

  -- Insert new active version
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

-- 5. FUNCTION TO ROLLBACK TEMPLATE TO A PREVIOUS VERSION
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
  -- Check if target version exists
  IF NOT EXISTS (
    SELECT 1 FROM public.completion_page_templates
    WHERE slug = p_slug AND version = p_target_version
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Target version does not exist.');
  END IF;

  -- Deactivate current active
  UPDATE public.completion_page_templates
  SET is_active = false
  WHERE slug = p_slug;

  -- Activate target version
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
