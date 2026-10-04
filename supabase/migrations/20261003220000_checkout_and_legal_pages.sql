-- ==============================================================================
-- CHECKOUT & LEGAL PAGES CONFIGURATION
-- Adds editable what's included bullet lists per product and legal policy markdowns
-- ==============================================================================

ALTER TABLE public.commerce_settings 
  ADD COLUMN IF NOT EXISTS mrc_included_bullets TEXT DEFAULT '• Money Reality Check 12 recorded diagnostic sessions
• 4 diagnostic calculator & audit sheets
• 1 Thursday guest seat (valid for 60 days)
• 60 days of community access',
  ADD COLUMN IF NOT EXISTS silver_included_bullets TEXT DEFAULT '• The Calm Money System lifetime curriculum & missions
• Consolidated asset & liability audit model
• Real return & 30% tax drag calculations
• MWP Act, nomination & legal architecture framework
• Cohort membership & live implementation sprints',
  ADD COLUMN IF NOT EXISTS gold_included_bullets TEXT DEFAULT '• Lifetime Silver access + complete Gold curriculum
• Advanced wealth transmission & estate structuring
• Direct quarterly portfolio reviews & private office sessions
• Priority cohort positioning',
  ADD COLUMN IF NOT EXISTS diamond_included_bullets TEXT DEFAULT '• Lifetime Silver and Gold membership
• 12 months of direct Diamond private office advisory
• Bespoke estate, trust & tax optimization architecture
• Direct 1-on-1 private advisory access',
  ADD COLUMN IF NOT EXISTS policy_terms_markdown TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_privacy_markdown TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_refund_markdown TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_shipping_markdown TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policy_contact_markdown TEXT DEFAULT NULL;
