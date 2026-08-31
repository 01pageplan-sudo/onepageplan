CREATE TABLE public.prework_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  email text,
  question text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.prework_questions TO service_role;

ALTER TABLE public.prework_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX prework_questions_created_at_idx ON public.prework_questions (created_at DESC);
CREATE INDEX prework_questions_registration_idx ON public.prework_questions (registration_id);