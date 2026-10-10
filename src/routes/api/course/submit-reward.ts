import { createFileRoute } from "@tanstack/react-router";
import type { AuthenticatedUser } from "@/lib/auth/server-auth";

export interface SubmitRewardDependencies {
  getAuthenticatedUser?: (req?: Request) => Promise<{
    user: AuthenticatedUser | null;
    error: string | null;
  }>;
  getMemberEntitledTiers?: (
    email: string,
    userId?: string,
  ) => Promise<{
    canViewMrc: boolean;
    canViewSilver: boolean;
    canViewGold: boolean;
    canViewDiamond: boolean;
  }>;
  supabaseAdmin?: any;
  handleGoldCompleterEligibleEvent?: (params: {
    email: string;
    name: string;
    deadlineDate: string;
    goldPrice: number;
  }) => Promise<void>;
}

/**
 * Core handler logic for POST /api/course/submit-reward.
 * Enforces:
 * 1. Cryptographically verified Supabase session
 * 2. Active Silver (or higher) course entitlement
 * 3. Server-verified course completion record in `course_completions`
 * 4. Strict error checking on all database reads and writes
 */
export async function handleSubmitRewardRequest(
  request: Request,
  deps: SubmitRewardDependencies = {},
): Promise<Response> {
  try {
    const resolveAuth =
      deps.getAuthenticatedUser ??
      (await import("@/lib/auth/server-auth")).getAuthenticatedUser;

    const { user, error: authErr } = await resolveAuth(request);

    if (authErr || !user) {
      return Response.json(
        { ok: false, error: "Authentication required to claim rewards. Please log in." },
        { status: 401 },
      );
    }

    // 1. Verify member has active entitlement to Silver or higher
    const resolveTiers =
      deps.getMemberEntitledTiers ??
      (await import("@/lib/commerce/video-access.server")).getMemberEntitledTiers;

    const tiers = await resolveTiers(user.email, user.id);
    if (!tiers.canViewSilver && !user.isAdmin) {
      return Response.json(
        {
          ok: false,
          error: "Only members with active course access qualify to submit completion rewards.",
        },
        { status: 403 },
      );
    }

    // 2. Validate request body
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
        {
          ok: false,
          error: "Please complete all required fields (name, t-shirt size, address).",
        },
        { status: 400 },
      );
    }

    const db =
      deps.supabaseAdmin ??
      (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    // 3. Verify genuine server-recorded course completion before allowing reward claim
    const { data: existing, error: fetchError } = await db
      .from("course_completions" as never)
      .select("*")
      .eq("email" as never, user.email as never)
      .maybeSingle();

    if (fetchError) {
      console.error("[Submit Reward] Failed to query course_completions:", fetchError.message);
      return Response.json(
        { ok: false, error: "Database error while verifying course completion status." },
        { status: 500 },
      );
    }

    const completionRecord = existing as {
      id?: string;
      email?: string;
      user_id?: string | null;
      completed_at?: string | null;
      is_completed?: boolean | null;
      reward_submitted_at?: string | null;
    } | null;

    if (completionRecord?.user_id && completionRecord.user_id !== user.id) {
      return Response.json(
        { ok: false, error: "Unauthorized access to course completion record." },
        { status: 403 },
      );
    }

    const isVerifiedComplete = Boolean(
      completionRecord &&
        completionRecord.id &&
        completionRecord.completed_at &&
        completionRecord.is_completed !== false,
    );

    if (!isVerifiedComplete) {
      return Response.json(
        {
          ok: false,
          error:
            "Course completion has not been verified for your account. Please complete all required course modules before claiming rewards.",
        },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();

    // 4. Update verified completion record and check for write errors
    const { data: updatedRows, error: updateError } = await db
      .from("course_completions" as never)
      .update({
        user_id: user.id,
        certificate_name: certificateName,
        tshirt_size: tshirtSize,
        shipping_address: shippingAddress,
        reward_submitted_at: now,
      } as never)
      .eq("id" as never, completionRecord!.id as never)
      .select("id");

    if (
      updateError ||
      !updatedRows ||
      (Array.isArray(updatedRows) && updatedRows.length === 0)
    ) {
      console.error(
        "[Submit Reward] Failed to update course_completions:",
        updateError?.message || "No rows updated",
      );
      return Response.json(
        { ok: false, error: "Failed to save reward claim to database. Please try again." },
        { status: 500 },
      );
    }

    // 5. Emit reward claimed event and check for write errors
    const { error: eventError } = await db.from("commerce_events" as never).insert({
      event_name: "course_reward_claimed",
      email: user.email,
      payload: {
        user_id: user.id,
        completion_id: completionRecord!.id,
        certificate_name: certificateName,
        tshirt_size: tshirtSize,
        shipping_address: shippingAddress,
        submitted_at: now,
      },
    } as never);

    if (eventError) {
      console.error("[Submit Reward] Failed to insert commerce_events:", eventError.message);
      return Response.json(
        { ok: false, error: "Failed to record reward claim event. Please try again." },
        { status: 500 },
      );
    }

    // 6. Trigger Gold Completer notifications (non-blocking)
    try {
      const notifyGoldEligible =
        deps.handleGoldCompleterEligibleEvent ??
        (await import("@/lib/messaging/scheduler.server")).handleGoldCompleterEligibleEvent;

      const { data: settings, error: settingsError } = await db
        .from("commerce_settings" as never)
        .select("gold_completer_price")
        .eq("id" as never, 1)
        .maybeSingle();

      if (settingsError) {
        console.warn("[Course Complete] Could not load commerce_settings:", settingsError.message);
      }

      const goldPrice = (settings as any)?.gold_completer_price || 18001;
      const deadlineIso = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      await notifyGoldEligible({
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
}

/**
 * Server endpoint to save reward claims (Certificate name, T-shirt size, Shipping address).
 * Endpoint: POST /api/course/submit-reward
 * SECURITY: Requires verified authenticated Supabase session, active Silver+ entitlement,
 * and server-verified course completion record.
 */
export const Route = createFileRoute("/api/course/submit-reward")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSubmitRewardRequest(request),
    },
  },
});
