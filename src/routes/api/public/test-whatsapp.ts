import { createFileRoute } from "@tanstack/react-router";
import {
  sendSessionWhatsAppTemplate,
  type ApprovedSessionTemplateName,
} from "@/services/whatsapp";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import { sessionDateISO } from "@/lib/session";

/**
 * Diagnostic endpoint to test all 4 approved WhatsApp templates on a candidate.
 * 
 * Usage:
 * - By phone: GET /api/public/test-whatsapp?phone=+919876543210&name=Milan
 * - By email: GET /api/public/test-whatsapp?email=candidate@example.com
 */
export const Route = createFileRoute("/api/public/test-whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let phone = (url.searchParams.get("phone") || "").trim();
        let name = (url.searchParams.get("name") || "").trim();
        const email = (url.searchParams.get("email") || "").trim().toLowerCase();
        const customId = (
          url.searchParams.get("id") ||
          url.searchParams.get("phoneNumberId") ||
          ""
        ).trim() || undefined;
        const customToken = (
          url.searchParams.get("token") ||
          url.searchParams.get("accessToken") ||
          ""
        ).trim() || undefined;

        // If email provided, look up candidate from database
        if (email) {
          try {
            const db = createPublicServerClient();
            const { data: details } = await db.rpc(
              "lookup_registration_details_for_room" as never,
              {
                p_email: email,
                p_session_date: sessionDateISO(),
              } as never,
            );
            const record = (details ?? null) as { full_name?: string; phone_e164?: string } | null;
            if (record?.phone_e164) phone = record.phone_e164;
            if (record?.full_name && !name) name = record.full_name;
          } catch (err) {
            console.error("Failed to look up registration details:", err);
          }
        }

        if (!phone) {
          return Response.json(
            {
              error: "missing_phone",
              message:
                "Please provide ?phone=+91XXXXXXXXXX or ?email=candidate@example.com in the query parameters.",
            },
            { status: 400 },
          );
        }

        const firstName = (name || "there").trim().split(/\s+/)[0] || "there";

        const templates: ApprovedSessionTemplateName[] = [
          "mrm_reg_confirmed",
          "mrm_reminder_friday",
          "mrm_reminder_1hr",
          "mrm_live_now",
        ];

        const results: Array<{
          template: string;
          status: "sent" | "failed";
          messageId?: string | undefined;
          error?: string | undefined;
        }> = [];

        for (const template of templates) {
          try {
            const res = await sendSessionWhatsAppTemplate(
              phone,
              template,
              firstName,
              customId,
              customToken,
            );
            results.push({
              template,
              status: "sent",
              messageId: res.messages?.[0]?.id,
            });
          } catch (error) {
            results.push({
              template,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return Response.json({
          recipient: phone,
          firstName,
          usedPhoneNumberIdOverride: customId ?? null,
          usedTokenOverride: Boolean(customToken),
          results,
        });
      },
    },
  },
});
