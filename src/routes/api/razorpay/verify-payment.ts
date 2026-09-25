import { createFileRoute } from "@tanstack/react-router";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay.server";

/**
 * Verifies Razorpay payment signature, records payment in Supabase,
 * grants course access, and triggers onboarding email and WhatsApp notifications.
 * Endpoint: POST /api/razorpay/verify-payment
 */
export const Route = createFileRoute("/api/razorpay/verify-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            orderId?: string;
            paymentId?: string;
            signature?: string;
            email?: string;
            name?: string;
            phone?: string;
          };

          const orderId = body.orderId?.trim();
          const paymentId = body.paymentId?.trim();
          const signature = body.signature?.trim();
          const email = body.email?.trim().toLowerCase();

          if (!orderId || !paymentId || !signature || !email) {
            return Response.json({ error: "missing_required_fields" }, { status: 400 });
          }

          // 1. Verify HMAC-SHA256 signature
          const isValid = verifyRazorpayPaymentSignature({
            orderId,
            paymentId,
            signature,
          });

          if (!isValid) {
            console.warn("[Razorpay] Invalid payment signature rejected:", { orderId, paymentId });
            return Response.json({ error: "invalid_signature" }, { status: 400 });
          }

          // 2. Persist in database via record_successful_payment RPC
          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const db = createPublicServerClient();

          const { data: dbResult, error: dbError } = await (db.rpc as any)("record_successful_payment", {
            p_email: email,
            p_amount: 6000,
            p_order_id: orderId,
            p_payment_id: paymentId,
            p_signature: signature,
            p_notes: {
              name: body.name || "",
              phone: body.phone || "",
            },
          });

          if (dbError) {
            console.error("[Razorpay] Database error recording payment:", dbError);
          }

          // 3. Trigger S3 Buyer Onboarding Welcome Email via ZeptoMail
          try {
            const { sendZeptoEmail } = await import("@/lib/zeptomail.server");
            const firstName = body.name?.trim().split(/\s+/)[0] || "there";
            const loginUrl = "https://onepageplan.in/course";

            await sendZeptoEmail({
              to: email,
              toName: body.name,
              subject: "You are in. Here is exactly what happens now.",
              htmlBody: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; color: #222; line-height: 1.6;">
                  <h2 style="color: #4A5A3A;">You are in. Here is exactly what happens now.</h2>
                  <p>Hello ${firstName},</p>
                  <p>Your payment for <strong>The Calm Money System</strong> is confirmed. You now have full lifetime access to the recorded curriculum and template pack.</p>
                  <p>You can access your course materials and video lessons at any time by entering your email at:</p>
                  <p style="margin: 24px 0;">
                    <a href="${loginUrl}" style="background-color: #4A5A3A; color: #FAF7F0; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      Open The Calm Money System →
                    </a>
                  </p>
                  <p>Save this link. We will be checking in with the weekly structured milestones as outlined in your onboarding schedule.</p>
                  <p>Warmly,<br><strong>Milan Dodhia</strong><br>The One Page Plan</p>
                </div>
              `,
              textBody: `Hello ${firstName},\n\nYour payment for The Calm Money System is confirmed. Access your course lessons at: ${loginUrl}\n\nWarmly,\nMilan Dodhia`,
            });
          } catch (emailErr) {
            console.error("[Razorpay] Error dispatching welcome email:", emailErr);
          }

          // 4. Trigger WhatsApp confirmation via direct Meta Cloud API
          if (body.phone) {
            try {
              const { sendWhatsAppTemplate } = await import("@/services/whatsapp/whatsapp.server");
              const firstName = body.name?.trim().split(/\s+/)[0] || "there";
              await sendWhatsAppTemplate({
                to: body.phone,
                templateName: process.env["WHATSAPP_TEMPLATE_PURCHASE"] || "course_purchase_confirmation",
                bodyParameters: [firstName, "https://onepageplan.in/course"],
                buttonUrlParam: "course",
              });
            } catch (waErr) {
              console.error("[Razorpay] Error dispatching purchase WhatsApp:", waErr);
            }
          }

          return Response.json({
            ok: true,
            verified: true,
            accessGranted: true,
            redirectUrl: "/course",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[Razorpay] Verification error:", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
