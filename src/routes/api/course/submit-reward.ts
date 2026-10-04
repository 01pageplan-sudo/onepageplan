import { createFileRoute } from "@tanstack/react-router";
import { createPublicServerClient } from "@/lib/supabase-public.server";

/**
 * Server endpoint to save reward claims (Certificate name, T-shirt size, Shipping address).
 * Endpoint: POST /api/course/submit-reward
 */
export const Route = createFileRoute("/api/course/submit-reward")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            email?: string;
            certificateName?: string;
            tshirtSize?: string;
            shippingAddress?: string;
          };

          const email = (body.email || "").trim().toLowerCase();
          const certificateName = (body.certificateName || "").trim();
          const tshirtSize = (body.tshirtSize || "").trim();
          const shippingAddress = (body.shippingAddress || "").trim();

          if (!email || !certificateName || !tshirtSize || !shippingAddress) {
            return Response.json(
              { ok: false, error: "Please complete all required fields (name, t-shirt size, address)." },
              { status: 400 }
            );
          }

          const db = createPublicServerClient();

          // Check or upsert completion record
          const { data: existing } = await db
            .from("course_completions" as never)
            .select("id")
            .eq("email" as never, email)
            .maybeSingle();

          const now = new Date().toISOString();

          if (existing) {
            await db
              .from("course_completions" as never)
              .update({
                certificate_name: certificateName,
                tshirt_size: tshirtSize,
                shipping_address: shippingAddress,
                reward_submitted_at: now,
              } as never)
              .eq("email" as never, email);
          } else {
            await db.from("course_completions" as never).insert({
              email,
              completed_at: now,
              certificate_name: certificateName,
              tshirt_size: tshirtSize,
              shipping_address: shippingAddress,
              reward_submitted_at: now,
            } as never);
          }

          // Emit reward claimed event
          await db.from("commerce_events" as never).insert({
            event_name: "course_reward_claimed",
            email,
            payload: {
              certificate_name: certificateName,
              tshirt_size: tshirtSize,
              shipping_address: shippingAddress,
              submitted_at: now,
            },
          } as never);

          // Prompt 4: Trigger Gold Completer notifications (initial + 3 reminders)
          try {
            const { handleGoldCompleterEligibleEvent } = await import("@/lib/messaging/scheduler.server");
            const { data: settings } = await db.from("commerce_settings" as never).select("gold_completer_price").eq("id" as never, 1).maybeSingle();
            const goldPrice = (settings as any)?.gold_completer_price || 18001;
            const deadlineIso = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(); // 15 days window
            await handleGoldCompleterEligibleEvent({
              email,
              name: certificateName,
              deadlineDate: deadlineIso,
              goldPrice,
            });
          } catch (goldErr) {
            console.warn("[Course Complete] Error triggering Gold completer messaging:", goldErr);
          }

          return Response.json({ ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
