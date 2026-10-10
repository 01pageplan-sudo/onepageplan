import { getRequest } from "@tanstack/react-start/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Extracts and securely verifies the authenticated user from the current request.
 * Does NOT trust any client-supplied email or user ID.
 * Uses Supabase Auth's getUser(token) to cryptographically verify the JWT against the auth server.
 */
export async function getAuthenticatedUser(customRequest?: Request): Promise<{
  user: AuthenticatedUser | null;
  error: string | null;
}> {
  try {
    let request: Request | undefined = customRequest;

    if (!request) {
      try {
        request = getRequest();
      } catch {
        // Not in an active request context
      }
    }

    if (!request?.headers) {
      return { user: null, error: "no_request_context" };
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null, error: "unauthenticated" };
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return { user: null, error: "empty_token" };
    }

    // Load server-side admin client with service role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cryptographically verify token with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return { user: null, error: error?.message || "invalid_token" };
    }

    const verifiedEmail = (data.user.email || "").trim().toLowerCase();
    if (!verifiedEmail) {
      return { user: null, error: "no_email_in_user" };
    }

    // Check admin authorization
    const adminEmails = (process.env["COURSE_ADMIN_EMAILS"] || "dodhia.milan@gmail.com")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim());

    const isAdmin = adminEmails.includes(verifiedEmail);

    return {
      user: {
        id: data.user.id,
        email: verifiedEmail,
        isAdmin,
      },
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { user: null, error: msg };
  }
}

/**
 * Idempotently associates existing historical purchases and grants (stored against email)
 * with the newly verified Supabase user ID.
 */
export async function syncUserEntitlements(userId: string, email: string): Promise<void> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!userId || !cleanEmail) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: rpcError } = await (supabaseAdmin.rpc as any)("link_user_entitlements", {
      p_user_id: userId,
      p_email: cleanEmail,
    });

    if (rpcError) {
      // Never fallback on authorization / privilege violations
      if (rpcError.code === "42501" || String(rpcError.message || "").includes("Unauthorized")) {
        throw new Error(rpcError.message || "Unauthorized entitlement link attempt");
      }
      // Fallback: direct table updates only if RPC is not yet loaded in DB schema cache
      await fallbackDirectSync(supabaseAdmin, userId, cleanEmail);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unauthorized")) {
      throw err;
    }
    console.warn("[Auth Sync] link_user_entitlements RPC notice:", err);
  }
}

async function fallbackDirectSync(
  adminClient: any,
  userId: string,
  email: string,
): Promise<void> {
  // Authoritatively verify userId owns email in auth.users before any direct update
  const { data: userLookup, error: lookupError } = await adminClient.auth.admin.getUserById(userId);
  const verifiedEmail = (userLookup?.user?.email || "").trim().toLowerCase();

  if (lookupError || !verifiedEmail || verifiedEmail !== email) {
    throw new Error("Unauthorized: userId and email do not match in Supabase Auth");
  }

  await Promise.allSettled([
    adminClient
      .from("member_access_grants")
      .update({ user_id: userId })
      .eq("email", verifiedEmail)
      .is("user_id", null),
    adminClient
      .from("orders")
      .update({ user_id: userId })
      .eq("buyer_email", verifiedEmail)
      .is("user_id", null),
    adminClient
      .from("course_completions")
      .update({ user_id: userId })
      .eq("email", verifiedEmail)
      .is("user_id", null),
    adminClient
      .from("course_comments")
      .update({ user_id: userId })
      .eq("author_email", verifiedEmail)
      .is("user_id", null),
  ]);
}

