import { createFileRoute } from "@tanstack/react-router";
import { createPublicServerClient } from "@/lib/supabase-public.server";

/**
 * Public 1-click unsubscribe endpoint for marketing emails.
 * Appended to every marketing email footer and List-Unsubscribe header.
 * Endpoint: GET /api/public/unsubscribe?email=...
 */
export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const email = (url.searchParams.get("email") || "").trim().toLowerCase();

        if (!email || !email.includes("@")) {
          return new Response("Invalid email address.", { status: 400 });
        }

        const db = createPublicServerClient();

        // 1. Record suppression
        await db.from("communication_suppressions" as never).upsert(
          {
            identifier: email,
            channel: "email",
            reason: "user_unsubscribe",
          } as never,
          { onConflict: "identifier,channel" } as never
        );

        // 2. Also cancel any pending marketing emails in scheduled queue
        await db
          .from("scheduled_messages" as never)
          .update({ status: "cancelled", skip_reason: "user_unsubscribed" } as never)
          .eq("recipient_email" as never, email)
          .eq("category" as never, "marketing")
          .eq("status" as never, "pending");

        const confirmationHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed | The One Page Plan</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #FAF7F0; color: #2B2B28; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
    .box { background: #FFFFFF; border: 1px solid #E5DFD3; border-radius: 12px; padding: 36px 28px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h1 { font-size: 20px; font-weight: 700; color: #4A5A3A; margin: 0 0 12px 0; }
    p { font-size: 14px; color: #6B6A63; line-height: 1.5; margin: 0 0 20px 0; }
    a { display: inline-block; background: #4A5A3A; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="box">
    <h1>You have been unsubscribed</h1>
    <p><strong>${email}</strong> has been removed from all marketing updates. You will not receive any further reminder or promotional emails.</p>
    <p style="font-size: 12px; color: #9CA3AF;">Note: Essential order receipts and course access details will still reach you if you make a purchase.</p>
    <a href="https://onepageplan.in">Return to Homepage</a>
  </div>
</body>
</html>`;

        return new Response(confirmationHtml, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
