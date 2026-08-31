# Restructure the success page steps

The success page currently asks people to "confirm on the session platform" after we've already told them the joining link is on its way. That contradiction goes, and the page becomes three clean steps.

## New structure on /confirmed

Step 1 — Done (what they just completed)
- Keeps the existing "Your details are with us. The joining link is on its way by email and on WhatsApp." line.
- Gains the calendar download button, moved into this card.

Step 2 — Ask me one question
- The existing "Ask me one question" section moves up to become Step 2, directly after Step 1, and gets the prominent treatment the old confirm card had (heavier border, larger heading, step label).
- Copy, textarea behaviour, 500-char cap, counter after 400, in-place confirmation, localStorage memory and retry all stay exactly as they are.

Step 3 — Join the WhatsApp group
- The existing WhatsApp group section becomes Step 3, with the step label added, still only shown when the group link is configured.

## Removed

- The whole "Step 2. Confirm on the session platform." card and its "Confirm my seat" button.
- The "Before Saturday" checklist, including its "Add it to your calendar" line and download button (the button itself survives inside Step 1).

## Kept unchanged

- Heading "Your seat is saved", the optional prep video section, the footer, the Meta Pixel Lead event, and the page metadata.

## Technical notes

- All edits are in `src/routes/confirmed.tsx`; `downloadIcs` stays and is called from the Step 1 card. The `Check` icon import is dropped if the checklist is the only user.
- `src/components/site/AskQuestion.tsx` gains a step label and slightly stronger card styling to match its new prominence; its form logic and copy are untouched.
- `VITE_WEBINAR_URL` is still used for the calendar file location, just no longer as a visible CTA.
