import { createFileRoute } from "@tanstack/react-router";
import type { AuthenticatedUser } from "@/lib/auth/server-auth";
import {
  isCourseCompletionVerified,
  type CourseCompletionRecordShape,
} from "@/lib/commerce/completion.server";

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
 * 1. Cryptographically verified Supabase session (with confirmed email)
 * 2. Active Silver (or higher) course entitlement
 * 3. Server-verified course completion record (is_completed === true, completed_at, and required core modules)
 * 4. Idempotent reward claiming (prevents duplicate claims, duplicate events, and duplicate notifications)
 * 5. Atomic consistency between course_completions and commerce_events (via transactional RPC or compensating rollback)
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

    const completionRecord = existing as CourseCompletionRecordShape | null;

    if (completionRecord?.user_id && completionRecord.user_id !== user.id) {
      return Response.json(
        { ok: false, error: "Unauthorized access to course completion record." },
        { status: 403 },
      );
    }

    if (!isCourseCompletionVerified(completionRecord)) {
      return Response.json(
        {
          ok: false,
          error:
            "Course completion has not been verified for your account. Please complete all required course modules before claiming rewards.",
        },
        { status: 403 },
      );
    }

    // 4. Idempotency check: reject duplicate claims before mutating DB or firing notifications
    if (completionRecord?.reward_submitted_at) {
      return Response.json(
        {
          ok: false,
          alreadyClaimed: true,
          error: "Completion reward has already been claimed for this account.",
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    let handledViaAtomicRpc = false;

    // 5a. Prefer single-transaction PostgreSQL RPC if available
    if (typeof db.rpc === "function") {
      const { data: rpcResult, error: rpcError } = await db.rpc("claim_course_reward", {
        p_user_id: user.id,
        p_email: user.email,
        p_certificate_name: certificateName,
        p_tshirt_size: tshirtSize,
        p_shipping_address: shippingAddress,
      });

      if (!rpcError && rpcResult && typeof rpcResult === "object") {
        handledViaAtomicRpc = true;
        const resObj = rpcResult as {
          ok?: boolean;
          status?: number;
          already_claimed?: boolean;
          error?: string;
        };

        if (resObj.already_claimed || resObj.status === 409) {
          return Response.json(
            {
              ok: false,
              alreadyClaimed: true,
              error:
                resObj.error || "Completion reward has already been claimed for this account.",
            },
            { status: 409 },
          );
        }

        if (!resObj.ok) {
          return Response.json(
            {
              ok: false,
              error: resObj.error || "Unable to verify course completion for reward claim.",
            },
            { status: resObj.status || 403 },
          );
        }
      } else if (
        rpcError &&
        (rpcError.code === "23505" || String(rpcError.message || "").includes("idx_commerce_events_unique_reward_claimed_email"))
      ) {
        return Response.json(
          {
            ok: false,
            alreadyClaimed: true,
            error: "Completion reward has already been claimed for this account.",
          },
          { status: 409 },
        );
      } else if (
        rpcError &&
        rpcError.code !== "PGRST202" &&
        !String(rpcError.message || "").includes("Could not find the function")
      ) {
        console.error("[Submit Reward] Atomic RPC claim_course_reward failed:", rpcError.message);
        return Response.json(
          { ok: false, error: "Failed to save reward claim to database. Please try again." },
          { status: 500 },
        );
      }
    }

    // 5b. Fallback table operations with optimistic lock (.is("reward_submitted_at", null)) and compensating rollback
    if (!handledViaAtomicRpc) {
      const updateQuery = db
        .from("course_completions" as never)
        .update({
          user_id: user.id,
          certificate_name: certificateName,
          tshirt_size: tshirtSize,
          shipping_address: shippingAddress,
          reward_submitted_at: now,
        } as never)
        .eq("id" as never, completionRecord!.id as never);

      const guardedQuery =
        typeof (updateQuery as any).is === "function"
          ? (updateQuery as any).is("reward_submitted_at", null)
          : updateQuery;

      const { data: updatedRows, error: updateError } = await guardedQuery.select("id");

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

      // Emit reward claimed event and roll back course_completions if event insert fails
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

        // Compensating rollback so course_completions and commerce_events stay consistent on midway failure
        try {
          await db
            .from("course_completions" as never)
            .update({
              certificate_name: completionRecord!.certificate_name ?? null,
              tshirt_size: completionRecord!.tshirt_size ?? null,
              shipping_address: completionRecord!.shipping_address ?? null,
              reward_submitted_at: null,
            } as never)
            .eq("id" as never, completionRecord!.id as never)
            .select("id");
        } catch (rollbackErr) {
          console.error("[Submit Reward] Compensating rollback failed:", rollbackErr);
        }

        if (
          (eventError as any).code === "23505" ||
          String(eventError.message || "").includes("idx_commerce_events_unique_reward_claimed_email")
        ) {
          return Response.json(
            {
              ok: false,
              alreadyClaimed: true,
              error: "Completion reward has already been claimed for this account.",
            },
            { status: 409 },
          );
        }

        return Response.json(
          { ok: false, error: "Failed to record reward claim event. Please try again." },
          { status: 500 },
        );
      }
    }

    // 6. Trigger Gold Completer notifications once per unique claim (non-blocking)
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
