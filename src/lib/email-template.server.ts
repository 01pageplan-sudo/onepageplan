import { DISCLAIMER_TEXT } from "./email-templates";

export { DISCLAIMER_TEXT };

export function buildConfirmationEmail(
  firstName: string,
  webinarUrl: string,
  googleCalendarUrl: string,
) {
  const roomUrl = webinarUrl || "https://www.onepageplan.in/room";
  const text = `Hello ${firstName},

Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST and takes ninety minutes.

Two things to have next to you: a pen and paper, and last month's bank statement. You will be doing arithmetic on your own numbers, not watching mine.

Keep the link below. That is how you get in on the night.

${roomUrl}

Add it to your calendar: ${googleCalendarUrl}

Session details: this Saturday, 7:00 PM to 8:30 PM IST, ninety minutes, online.

See you there.

Milan Dodhia
Financial Educator, Milanaire

---
${DISCLAIMER_TEXT}

Mannrs Wellness LLP : connect@onepageplan.in
To stop receiving these emails, reply with the word UNSUBSCRIBE and we will remove you.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#FAF7F0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E5DFD3;border-radius:10px;padding:28px;font-family:Helvetica,Arial,sans-serif;color:#2B2B28;">
            <tr>
              <td style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#B8873B;padding-bottom:12px;">The One Page Plan by Milanaire</td>
            </tr>
            <tr>
              <td style="font-size:22px;font-weight:700;color:#4A5A3A;padding-bottom:16px;line-height:1.25;">Your seat is saved. Here is what to bring.</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;padding-bottom:14px;">Hello ${firstName},</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;padding-bottom:14px;">Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST and takes ninety minutes.</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;padding-bottom:14px;">Two things to have next to you: a pen and paper, and last month's bank statement. You will be doing arithmetic on your own numbers, not watching mine.</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;padding-bottom:20px;">Keep the button below. That is how you get in on the night.</td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:22px;">
                <a href="${roomUrl}" style="display:inline-block;background-color:#4A5A3A;color:#FAF7F0;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;">Open the session</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:14px;line-height:1.6;padding-bottom:22px;"><a href="${googleCalendarUrl}" style="color:#4A5A3A;font-weight:600;">Add it to your calendar</a></td>
            </tr>
            <tr>
              <td style="font-size:12px;line-height:1.6;color:#6B6A63;padding-bottom:14px;">Session details: this Saturday, 7:00 PM to 8:30 PM IST, ninety minutes, online.</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;padding-bottom:6px;">See you there.</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;padding-bottom:20px;">Milan Dodhia<br /><span style="color:#6B6A63;">Financial Educator, Milanaire</span></td>
            </tr>
            <tr>
              <td style="border-top:1px solid #E5DFD3;padding-top:16px;font-size:11px;line-height:1.6;color:#6B6A63;">
                ${DISCLAIMER_TEXT}
                <br /><br />
                Mannrs Wellness LLP : connect@onepageplan.in
                <br />
                To stop receiving these emails, reply with the word UNSUBSCRIBE and we will remove you.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}
