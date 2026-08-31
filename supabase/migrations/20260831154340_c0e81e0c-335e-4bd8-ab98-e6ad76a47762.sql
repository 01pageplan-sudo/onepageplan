-- 1) Remove blanket EXECUTE inherited via PUBLIC, and remove access for signed-in users.
REVOKE ALL ON FUNCTION public.register_attendee(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_prework_question(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscribe_newsletter(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_registrations(text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_webinar_event(text, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_config_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Re-grant EXECUTE ONLY to anon (the publishable key the server uses), since this
--    site has no user accounts. Each function validates its own input; the admin
--    reader additionally requires the stored admin password.
GRANT EXECUTE ON FUNCTION public.register_attendee(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_prework_question(text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_registrations(text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.record_webinar_event(text, date, text, jsonb) TO anon;

GRANT EXECUTE ON FUNCTION public.register_attendee(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_registration_delivery(uuid, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_prework_question(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_registrations(text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_webinar_event(text, date, text, jsonb) TO service_role;

-- 3) prework_questions: explicit deny-by-default. No direct table access at all;
--    inserts happen only through public.submit_prework_question (SECURITY DEFINER).
ALTER TABLE public.prework_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prework_questions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.prework_questions TO service_role;

DROP POLICY IF EXISTS "No direct access to prework questions" ON public.prework_questions;
CREATE POLICY "No direct access to prework questions"
  ON public.prework_questions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);