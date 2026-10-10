import { createFileRoute } from "@tanstack/react-router";

/**
 * Server endpoint to save reward claims (Certificate name, T-shirt size, Shipping address).
 * Endpoint: POST /api/course/submit-reward
 * SECURITY: Requires verified authenticated Supabase session and active course completion entitlement.
 */
export const Route = createFileRoute("/api/course/submit-reward")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { getAuthenticatedUser } = await import("@/lib/auth/server-auth");
          const { user, error: authErr } = await getAuthenticatedUser(request);

          if (authErr || !user) {
            return Response.json(
              { ok: false, error: "Authentication required to claim rewards. Please log in." },
              { status: 401 },
            );
          }

          // Verify member has active entitlement to silver or higher
          const { getMemberEntitledTiers } = await import("@/lib/commerce/video-access.server");
          const tiers = await getMemberEntitledTiers(user.email, user.id);
          if (!tiers.canViewSilver && !user.isAdmin) {
            return Response.json(
              { ok: false, error: "Only members with active course access qualify to submit completion rewards." },
              { status: 403 },
            );
          }

          const body = (await request.json().catch(() => ({}))) as {
            certificateName?: string;
            tshirtSize?: string;
            shippingAddress?: string;
          };

          const certificateName = (body.certificateName || "").trim();
          const tshirtSize = (body.tshirtSize || "").trim();
          const shippingAddress = (body.shippingAddress || "").trim();

          if (!certificateName || !tshirtSize || !shippingAddress) {
            return Response.json(
              { ok: false, error: "Please complete all required fields (name, t-shirt size, address)." },
              { status: 400 },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Check or upsert completion record for verified user
          const { data: existing } = await supabaseAdmin
            .from("course_completions" as never)
            .select("id")
            .eq("email" as never, user.email as never)
            .maybeSingle();

          const now = new Date().toISOString();

          if (existing) {
            await supabaseAdmin
              .from("course_completions" as never)
              .update({
                user_id: user.id,
                certificate_name: certificateName,
                tshirt_size: tshirtSize,
                shipping_address: shippingAddress,
                reward_submitted_at: now,
              } as never)
              .eq("email" as never, user.email as never);
          } else {
            await supabaseAdmin.from("course_completions" as never).insert({
              email: user.email,
              user_id: user.id,
              completed_at: now,
              certificate_name: certificateName,
              tshirt_size: tshirtSize,
              shipping_address: shippingAddress,
              reward_submitted_at: now,
            } as never);
          }

          // Emit reward claimed event
          await supabaseAdmin.from("commerce_events" as never).insert({
            event_name: "course_reward_claimed",
            email: user.email,
            payload: {
              user_id: user.id,
              certificate_name: certificateName,
              tshirt_size: tshirtSize,
              shipping_address: shippingAddress,
              submitted_at: now,
            },
          } as never);

          // Trigger Gold Completer notifications
          try {
            const { handleGoldCompleterEligibleEvent } = await import("@/lib/messaging/scheduler.server");
            const { data: settings } = await supabaseAdmin
              .from("commerce_settings" as never)
              .select("gold_completer_price")
              .eq("id" as never, 1)
              .maybeSingle();
            const goldPrice = (settings as any)?.gold_completer_price || 18001;
            const deadlineIso = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
            await handleGoldCompleterEligibleEvent({
              email: user.email,
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
