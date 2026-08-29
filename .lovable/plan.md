Keep WhatsApp number visible and consent checked by default

1. In `src/components/site/RegistrationModal.tsx`, set initial state of `whatsappConsent` and `voiceConsent` to `true`.
2. Remove the conditional wrapper around the WhatsApp number input so it is always rendered.
3. Keep phone validation tied to `whatsappConsent`: require exactly 10 digits when the box is checked; allow empty phone when unchecked.
4. Verify end-to-end that registrations save correctly with the default checked state and when the user unchecks consent.
