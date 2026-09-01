import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

/** 10 requests per IP per 10 minutes. */
const roomBuckets = new Map<string, number[]>();

function isRoomRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hits = (roomBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  roomBuckets.set(ip, hits);
  if (roomBuckets.size > 5000) roomBuckets.clear();
  return hits.length > 10;
}

function safeRequestIP(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Writes one row into the admin-visible webinar call log. Never throws. */
async function logWebinarCall(entry: {
  email: string | null;
  full_name: string | null;
  webinar_id: string | null;
  request_url: string | null;
  request_body: Record<string, string> | null;
  response_status: number | null;
  response_body: string | null;
  outcome: string;
  error: string | null;
}) {
  try {
    // Goes through a security-definer RPC with the publishable key, so the log
    // works on any host without the private service-role key.
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error } = await createPublicServerClient().rpc("log_webinar_call", {
      p_email: entry.email,
      p_full_name: entry.full_name,
      p_webinar_id: entry.webinar_id,
      p_request_url: entry.request_url,
      p_request_body: entry.request_body,
      p_response_status: entry.response_status,
      p_response_body: entry.response_body,
      p_outcome: entry.outcome,
      p_error: entry.error,
    });
    if (error) console.error("logWebinarCall rpc failed:", error.message);
  } catch (error) {
    console.error("logWebinarCall failed:", error instanceof Error ? error.message : error);
  }
}

export type JoinTokenResult =
  | { ok: true; token: string; webinarId: string }
  | { ok: false; reason: "not_registered" | "token_failed" | "rate_limited" };

export const getJoinToken = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<JoinTokenResult> => {
    console.log("getJoinToken called", data?.email);
    try {
      if (isRoomRateLimited(safeRequestIP())) {
        return { ok: false as const, reason: "rate_limited" as const };
      }

      const apiToken =
        process.env["WEBINAR_GG_API_TOKEN"] || process.env["WEBINAR_GG_API_KEY"] || "";
      // Same id in the join-token request and in the iframe src, always.
      const webinarId =
        (process.env["WEBINAR_GG_WEBINAR_ID"] || "").trim() || "cmthk6y4001kos60ybxfkbc67";
      if (!apiToken || !webinarId) {
        console.error("getJoinToken: WEBINAR_GG_API_TOKEN / WEBINAR_GG_WEBINAR_ID not set");
        await logWebinarCall({
          email: (data.email ?? "").trim().toLowerCase() || null,
          full_name: null,
          webinar_id: webinarId || null,
          request_url: null,
          request_body: null,
          response_status: null,
          response_body: null,
          outcome: "config_missing",
          error: "WEBINAR_GG_API_TOKEN or WEBINAR_GG_WEBINAR_ID is not set on the server.",
        });
        return { ok: false as const, reason: "token_failed" as const };
      }

      const testMode =
        (process.env["VITE_ROOM_TEST_MODE"] ?? process.env["ROOM_TEST_MODE"] ?? "false").trim() ===
        "true";

      let fullName = "Test Attendee";
      let email = "test@onepageplan.in";

      const preflightLog = (outcome: string, error: string | null) =>
        logWebinarCall({
          email: email || null,
          full_name: null,
          webinar_id: webinarId,
          request_url: null,
          request_body: null,
          response_status: null,
          response_body: null,
          outcome,
          error,
        });

      if (!testMode) {
        email = (data.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
          await preflightLog("invalid_email", "The email entered is not a valid address.");
          return { ok: false as const, reason: "not_registered" as const };
        }

        const { sessionDateISO } = await import("./session");
        const { createPublicServerClient } = await import("./supabase-public.server");
        const { data: name, error } = await createPublicServerClient().rpc(
          "lookup_registration_for_room",
          { p_email: email, p_session_date: sessionDateISO() },
        );
        if (error) {
          console.error("getJoinToken lookup failed:", error.message);
          await preflightLog("lookup_failed", error.message);
          return { ok: false as const, reason: "token_failed" as const };
        }
        if (!name) {
          await preflightLog(
            "not_registered",
            `No registration found for this email on ${sessionDateISO()}.`,
          );
          return { ok: false as const, reason: "not_registered" as const };
        }
        fullName = String(name);
      }


      const requestUrl = "https://webinar-api.webinar.gg/api/v1/webinar/join-token";
      const requestBody = { webinarId, name: fullName, email };
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const body = await response.text();
      const logBase = {
        email,
        full_name: fullName,
        webinar_id: webinarId,
        request_url: requestUrl,
        request_body: requestBody,
        response_status: response.status,
        response_body: body.slice(0, 8000),
      };
      if (!response.ok) {
        // Logged in full on purpose: the upstream field names are read from here.
        console.error("webinar.gg join-token failed", response.status, body);
        await logWebinarCall({
          ...logBase,
          outcome: "http_error",
          error: `webinar.gg replied ${response.status}`,
        });
        return { ok: false as const, reason: "token_failed" as const };
      }

      let token = "";
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const nested = (parsed["data"] ?? {}) as Record<string, unknown>;
        const candidate =
          parsed["token"] ?? parsed["joinToken"] ?? nested["token"] ?? nested["joinToken"];
        if (typeof candidate === "string") token = candidate;
      } catch {
        token = body.trim();
      }

      if (!token) {
        console.error("webinar.gg join-token: no token in response", response.status, body);
        await logWebinarCall({
          ...logBase,
          outcome: "no_token",
          error: "The reply contained no token field.",
        });
        return { ok: false as const, reason: "token_failed" as const };
      }

      await logWebinarCall({ ...logBase, outcome: "ok", error: null });
      return { ok: true as const, token, webinarId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("getJoinToken failed:", message);
      await logWebinarCall({
        email: (data.email ?? "").trim().toLowerCase() || null,
        full_name: null,
        webinar_id: null,
        request_url: null,
        request_body: null,
        response_status: null,
        response_body: null,
        outcome: "exception",
        error: message,
      });
      return { ok: false as const, reason: "token_failed" as const };
    }
  });
