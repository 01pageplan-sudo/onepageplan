-- Update the joining link in email_settings from webinar.gg to onepageplan.in/room
UPDATE public.email_settings
SET joining_link = 'https://onepageplan.in/room'
WHERE joining_link LIKE '%webinar.gg%' OR joining_link = '' OR joining_link IS NULL;
