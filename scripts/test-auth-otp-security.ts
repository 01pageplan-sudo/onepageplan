/**
 * Security & Regression Test Suite for Supabase Email OTP Authentication,
 * RPC Hardening, and Course Completion Reward Verification.
 *
 * Run with: npx tsx scripts/test-auth-otp-security.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getAuthenticatedUser } from "../src/lib/auth/server-auth";
import { handleSubmitRewardRequest } from "../src/routes/api/course/submit-reward";

function createRewardRequest(body: Record<string, unknown>, token?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return new Request("http://localhost:3000/api/course/submit-reward", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

interface MockDbOptions {
  completionRow?: Record<string, unknown> | null;
  fetchError?: { message: string } | null;
  rpcUnavailable?: boolean;
  rpcError?: { message: string; code?: string } | null;
  rpcResult?: Record<string, unknown> | null;
}

function createMockSupabaseAdmin(opts: MockDbOptions) {
  const operations: string[] = [];

  const mockDb: Record<string, any> = {
    operations,
    from(table: string) {
      if (table === "course_completions") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    operations.push("select:course_completions");
                    return {
                      data: opts.completionRow ?? null,
                      error: opts.fetchError ?? null,
                    };
                  },
                };
              },
            };
          },
          update() {
            operations.push("non_atomic_update:course_completions");
            throw new Error("Non-atomic direct update on course_completions must not be called");
          },
          async insert() {
            operations.push("insert:course_completions");
            throw new Error("Direct insert on course_completions must not be called");
          },
        };
      }

      if (table === "commerce_events") {
        return {
          async insert() {
            operations.push("non_atomic_insert:commerce_events");
            throw new Error("Non-atomic direct insert on commerce_events must not be called");
          },
        };
      }

      if (table === "commerce_settings") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    operations.push("select:commerce_settings");
                    return {
                      data: { gold_completer_price: 18001 },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    },
  };

  if (!opts.rpcUnavailable) {
    mockDb["rpc"] = async (fnName: string, args: Record<string, unknown>) => {
      operations.push(`rpc:${fnName}:${String(args["p_user_id"])}`);
      if (opts.rpcError) {
        return { data: null, error: opts.rpcError };
      }
      if (opts.rpcResult !== undefined) {
        return { data: opts.rpcResult, error: null };
      }
      return {
        data: {
          ok: true,
          status: 200,
          already_claimed: false,
          completion_id: (opts.completionRow as any)?.id ?? "comp-verified-1",
          submitted_at: "2026-10-10T12:00:00Z",
        },
        error: null,
      };
    };
  }

  return mockDb;
}

async function runSecurityTests() {
  console.log("=================================================================");
  console.log("RUNNING AUTH OTP & RPC SECURITY REGRESSION SUITE");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Database Migration Security Verification (Static SQL Policy & Logic Audit)
  // ---------------------------------------------------------------------------
  const correctiveMigrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261010150000_fix_auth_rpc_and_reward_security.sql",
  );
  const originalMigrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261010100000_auth_user_link_and_security.sql",
  );
  const v2CorrectiveMigrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261010160000_fix_completion_verification_and_reward_idempotency.sql",
  );

  await test("Corrective security migration files exist and are non-empty", () => {
    assert.equal(fs.existsSync(correctiveMigrationPath), true, "20261010150000 migration must exist");
    assert.equal(
      fs.existsSync(v2CorrectiveMigrationPath),
      true,
      "20261010160000 corrective migration must exist",
    );
    const sql = fs.readFileSync(v2CorrectiveMigrationPath, "utf8");
    assert(sql.length > 2000, "20261010160000 migration should contain full SQL definitions");
  });

  await test("Critical Fix 1: link_user_entitlements revokes PUBLIC/anon/authenticated and validates auth.users ownership", () => {
    for (const filePath of [
      correctiveMigrationPath,
      originalMigrationPath,
      v2CorrectiveMigrationPath,
    ]) {
      const sql = fs.readFileSync(filePath, "utf8");

      assert(
        sql.includes(
          "REVOKE ALL ON FUNCTION public.link_user_entitlements(UUID, TEXT) FROM PUBLIC, anon, authenticated;",
        ),
        `${path.basename(filePath)} must revoke EXECUTE on link_user_entitlements from PUBLIC, anon, authenticated`,
      );
      assert(
        sql.includes(
          "GRANT EXECUTE ON FUNCTION public.link_user_entitlements(UUID, TEXT) TO service_role;",
        ),
        `${path.basename(filePath)} must grant EXECUTE on link_user_entitlements only to service_role`,
      );
      assert(
        !sql.includes("GRANT EXECUTE ON FUNCTION public.link_user_entitlements(UUID, TEXT) TO authenticated"),
        `${path.basename(filePath)} must not grant link_user_entitlements to authenticated`,
      );
      assert(
        sql.includes("FROM auth.users") && sql.includes("WHERE id = v_target_user_id"),
        `${path.basename(filePath)} must verify v_target_user_id against auth.users`,
      );
      assert(
        sql.includes("IF v_clean_email <> '' AND v_clean_email <> v_verified_email THEN"),
        `${path.basename(filePath)} must reject mismatched p_email vs auth.users email`,
      );
      assert(
        sql.includes("AND user_id IS NULL;"),
        `${path.basename(filePath)} must only link records where user_id IS NULL`,
      );
    }
  });

  await test("High Fix 2: has_active_access_for_user & has_active_access revoke PUBLIC/anon/authenticated and prevent identity spoofing", () => {
    for (const filePath of [correctiveMigrationPath, originalMigrationPath]) {
      const sql = fs.readFileSync(filePath, "utf8");

      assert(
        sql.includes(
          "REVOKE ALL ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;",
        ),
        `${path.basename(filePath)} must revoke EXECUTE on has_active_access_for_user from PUBLIC, anon, authenticated`,
      );
      assert(
        sql.includes(
          "GRANT EXECUTE ON FUNCTION public.has_active_access_for_user(UUID, TEXT, TEXT) TO service_role;",
        ),
        `${path.basename(filePath)} must grant EXECUTE on has_active_access_for_user to service_role`,
      );
      assert(
        sql.includes(
          "REVOKE ALL ON FUNCTION public.has_active_access(TEXT, TEXT) FROM PUBLIC, anon, authenticated;",
        ),
        `${path.basename(filePath)} must revoke EXECUTE on has_active_access from PUBLIC, anon, authenticated`,
      );
      assert(
        sql.includes("IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid THEN"),
        `${path.basename(filePath)} must enforce p_user_id = auth.uid() for authenticated JWT callers`,
      );
      assert(
        sql.includes("AND (user_id IS NULL OR v_effective_user_id IS NULL OR user_id = v_effective_user_id)"),
        `${path.basename(filePath)} must prevent email match on grants owned by another user_id`,
      );
    }
  });

  await test("Email Verification Fix: auth.users trigger, auto_link_user_on_grant, and RPCs require email_confirmed_at IS NOT NULL", () => {
    const sql = fs.readFileSync(v2CorrectiveMigrationPath, "utf8");

    // 1. Trigger on auth.users must check NEW.email_confirmed_at IS NOT NULL
    assert(
      sql.includes("IF NEW.id IS NOT NULL AND v_clean_email <> '' AND NEW.email_confirmed_at IS NOT NULL THEN"),
      "handle_auth_user_entitlement_link must require NEW.email_confirmed_at IS NOT NULL before linking purchases",
    );

    // 2. Grant/Order trigger must check email_confirmed_at IS NOT NULL
    assert(
      sql.includes("WHERE lower(trim(email)) = lower(trim(v_target_email))\n      AND email_confirmed_at IS NOT NULL"),
      "auto_link_user_on_grant must only match verified auth.users records",
    );

    // 3. link_user_entitlements & has_active_access_for_user must check email_confirmed_at IS NOT NULL
    assert(
      sql.includes("WHERE id = v_target_user_id\n    AND email_confirmed_at IS NOT NULL"),
      "link_user_entitlements must require email_confirmed_at IS NOT NULL",
    );

    // 4. server-auth.ts must check email_confirmed_at
    const serverAuthCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth/server-auth.ts"),
      "utf8",
    );
    assert(
      serverAuthCode.includes("if (!data.user.email_confirmed_at)"),
      "getAuthenticatedUser must reject unconfirmed email users",
    );
    assert(
      serverAuthCode.includes("!userLookup?.user?.email_confirmed_at"),
      "fallbackDirectSync must reject unconfirmed email users",
    );
  });

  await test("Course Completion Schema Fix: Drops permissive defaults and enforces chk_course_completions_verified_state", () => {
    const sql = fs.readFileSync(v2CorrectiveMigrationPath, "utf8");

    assert(
      sql.includes("ALTER COLUMN is_completed SET DEFAULT false;"),
      "Migration must set is_completed DEFAULT false",
    );
    assert(
      sql.includes("ALTER COLUMN completed_at DROP NOT NULL") &&
        sql.includes("ALTER COLUMN completed_at DROP DEFAULT;"),
      "Migration must drop NOT NULL and DEFAULT now() from completed_at",
    );
    assert(
      sql.includes("ADD CONSTRAINT chk_course_completions_verified_state") &&
        sql.includes("completed_lessons ?& ARRAY['core-1', 'core-2', 'core-3', 'core-4']"),
      "Migration must enforce CHECK constraint requiring core-1..core-4 before is_completed = true",
    );
    assert(
      sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_events_unique_reward_claimed_email"),
      "Migration must enforce unique partial index on course_reward_claimed events per email",
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Server Auth Helper Tests
  // ---------------------------------------------------------------------------
  await test("getAuthenticatedUser rejects requests without valid Authorization Bearer token", async () => {
    const reqNoHeader = new Request("http://localhost:3000/api/course/submit-reward", {
      method: "POST",
    });
    const res1 = await getAuthenticatedUser(reqNoHeader);
    assert.equal(res1.user, null);
    assert.equal(res1.error, "unauthenticated");

    const reqEmptyBearer = new Request("http://localhost:3000/api/course/submit-reward", {
      method: "POST",
      headers: { Authorization: "Bearer    " },
    });
    const res2 = await getAuthenticatedUser(reqEmptyBearer);
    assert.equal(res2.user, null);
    assert(
      res2.error === "unauthenticated" || res2.error === "empty_token",
      "Must reject empty Bearer header",
    );
  });

  // ---------------------------------------------------------------------------
  // 3. Priority Fix 3 — Reward Eligibility & Genuine Course Completion Tests
  // ---------------------------------------------------------------------------
  await test("Submit Reward: Rejects unauthenticated requests with 401", async () => {
    const req = createRewardRequest({
      certificateName: "Asha Patel",
      tshirtSize: "L",
      shippingAddress: "12 MG Road, Pune",
    });

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({ user: null, error: "unauthenticated" }),
    });

    assert.equal(response.status, 401);
    const body = (await response.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
  });

  await test("Submit Reward: Rejects authenticated user without Silver entitlement with 403", async () => {
    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-123", email: "mrc@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: false,
        canViewGold: false,
        canViewDiamond: false,
      }),
    });

    assert.equal(response.status, 403);
    const body = (await response.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert(body.error.includes("active course access"));
  });

  await test("High Fix 3a: Rejects Silver member who has NOT completed the course (no course_completions record) with 403 and never inserts completion", async () => {
    const mockDb = createMockSupabaseAdmin({ completionRow: null });
    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDb,
    });

    assert.equal(response.status, 403, "Must return 403 when course_completions row is absent");
    const body = (await response.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert(body.error.includes("Course completion has not been verified"));
    assert(
      !mockDb.operations.includes("insert:course_completions"),
      "Must NEVER insert a fabricated course_completions record",
    );
    assert(
      !mockDb.operations.includes("insert:commerce_events"),
      "Must NOT emit course_reward_claimed when completion is unverified",
    );
  });

  await test("High Fix 3b: Rejects Silver member when course_completions has is_completed = false, null, or undefined", async () => {
    for (const badIsCompleted of [false, null, undefined]) {
      const mockDbIncomplete = createMockSupabaseAdmin({
        completionRow: {
          id: "comp-1",
          email: "silver@example.com",
          user_id: "user-silver-1",
          completed_at: "2026-10-10T00:00:00Z",
          is_completed: badIsCompleted,
          completed_lessons: ["core-1", "core-2", "core-3", "core-4"],
        },
      });

      const req = createRewardRequest(
        {
          certificateName: "Asha Patel",
          tshirtSize: "L",
          shippingAddress: "12 MG Road, Pune",
        },
        "valid-jwt",
      );

      const response = await handleSubmitRewardRequest(req, {
        getAuthenticatedUser: async () => ({
          user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
          error: null,
        }),
        getMemberEntitledTiers: async () => ({
          canViewMrc: true,
          canViewSilver: true,
          canViewGold: false,
          canViewDiamond: false,
        }),
        supabaseAdmin: mockDbIncomplete,
      });

      assert.equal(
        response.status,
        403,
        `Must reject with 403 when is_completed is ${String(badIsCompleted)}`,
      );
    }
  });

  await test("High Fix 3c: Rejects Silver member when row has is_completed = true (e.g. default) but required core modules are not completed", async () => {
    const mockDbPartialModules = createMockSupabaseAdmin({
      completionRow: {
        id: "comp-partial-1",
        email: "silver@example.com",
        user_id: "user-silver-1",
        completed_at: "2026-10-10T00:00:00Z",
        is_completed: true,
        completed_lessons: ["core-1", "core-2"], // missing core-3 and core-4
      },
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDbPartialModules,
    });

    assert.equal(
      response.status,
      403,
      "Must reject with 403 when required core lessons (core-1..core-4) are missing",
    );
    const body = (await response.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert(!mockDbPartialModules.operations.includes("insert:commerce_events"));
  });

  await test("High Fix 3d: Rejects reward claim if completion record belongs to a different user_id", async () => {
    const mockDbOtherUser = createMockSupabaseAdmin({
      completionRow: {
        id: "comp-1",
        email: "silver@example.com",
        user_id: "different-user-uuid",
        completed_at: "2026-10-10T00:00:00Z",
        is_completed: true,
        completed_lessons: ["core-1", "core-2", "core-3", "core-4"],
      },
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDbOtherUser,
    });

    assert.equal(response.status, 403);
    const body = (await response.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert(body.error.includes("Unauthorized"));
  });

  // ---------------------------------------------------------------------------
  // 4. Priority Fix 4 & Idempotency / Atomic Consistency Tests
  // ---------------------------------------------------------------------------
  await test("Medium Fix 4a: Returns 500 when querying course_completions fails", async () => {
    const mockDb = createMockSupabaseAdmin({
      fetchError: { message: "connection timeout" },
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDb,
    });

    assert.equal(response.status, 500);
    const body = (await response.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
  });

  await test("Exclusive Transactional RPC: Returns retryable error (503/500) without partial updates when claim_course_reward RPC is unavailable", async () => {
    let goldNotified = false;
    const mockDbUnavailable = createMockSupabaseAdmin({
      completionRow: {
        id: "comp-verified-1",
        email: "silver@example.com",
        user_id: "user-silver-1",
        completed_at: "2026-10-10T00:00:00Z",
        is_completed: true,
        completed_lessons: ["core-1", "core-2", "core-3", "core-4"],
      },
      rpcUnavailable: true,
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDbUnavailable,
      handleGoldCompleterEligibleEvent: async () => {
        goldNotified = true;
      },
    });

    assert.equal(response.status, 503, "Must return 503 when RPC client is unavailable");
    const body = (await response.json()) as {
      ok: boolean;
      retryable?: boolean;
      error: string;
    };
    assert.equal(body.ok, false);
    assert.equal(body.retryable, true);
    assert(
      !mockDbUnavailable.operations.includes("non_atomic_update:course_completions"),
      "Must NEVER fall back to non-atomic course_completions update",
    );
    assert(
      !mockDbUnavailable.operations.includes("non_atomic_insert:commerce_events"),
      "Must NEVER fall back to non-atomic commerce_events insert",
    );
    assert.equal(goldNotified, false);
  });

  await test("Exclusive Transactional RPC: Returns retryable 500 error without partial updates or notifications when claim_course_reward RPC fails", async () => {
    let goldNotified = false;
    const mockDb = createMockSupabaseAdmin({
      completionRow: {
        id: "comp-verified-1",
        email: "silver@example.com",
        user_id: "user-silver-1",
        completed_at: "2026-10-10T00:00:00Z",
        is_completed: true,
        completed_lessons: ["core-1", "core-2", "core-3", "core-4"],
      },
      rpcError: { message: "transaction aborted in PostgreSQL" },
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDb,
      handleGoldCompleterEligibleEvent: async () => {
        goldNotified = true;
      },
    });

    assert.equal(response.status, 500, "Must return 500 when transactional RPC fails");
    const body = (await response.json()) as {
      ok: boolean;
      retryable?: boolean;
      error: string;
    };
    assert.equal(body.ok, false);
    assert.equal(body.retryable, true, "Must mark error as retryable");
    assert(
      mockDb.operations.includes("rpc:claim_course_reward:user-silver-1"),
      "Must invoke claim_course_reward RPC",
    );
    assert(
      !mockDb.operations.includes("non_atomic_update:course_completions") &&
        !mockDb.operations.includes("non_atomic_insert:commerce_events"),
      "Must NOT execute any non-atomic table writes",
    );
    assert.equal(goldNotified, false, "Must NOT send Gold Completer notification when RPC fails");
  });

  await test("Reward Idempotency: Rejects duplicate reward claims (409 Conflict) and prevents duplicate RPC calls & notifications", async () => {
    let goldNotified = false;
    const mockDbAlreadyClaimed = createMockSupabaseAdmin({
      completionRow: {
        id: "comp-verified-1",
        email: "silver@example.com",
        user_id: "user-silver-1",
        completed_at: "2026-10-10T00:00:00Z",
        is_completed: true,
        completed_lessons: ["core-1", "core-2", "core-3", "core-4"],
        reward_submitted_at: "2026-10-10T01:00:00Z",
      },
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDbAlreadyClaimed,
      handleGoldCompleterEligibleEvent: async () => {
        goldNotified = true;
      },
    });

    assert.equal(response.status, 409, "Duplicate reward claim must return 409 Conflict");
    const body = (await response.json()) as {
      ok: boolean;
      alreadyClaimed?: boolean;
      error: string;
    };
    assert.equal(body.ok, false);
    assert.equal(body.alreadyClaimed, true);
    assert(
      !mockDbAlreadyClaimed.operations.some((op: string) => op.startsWith("rpc:claim_course_reward")),
      "Must short-circuit before RPC when reward_submitted_at is already set",
    );
    assert.equal(
      goldNotified,
      false,
      "Must NOT trigger duplicate Gold Completer notification on duplicate submission",
    );
  });

  await test("Legitimate Completer: Succeeds (200 OK) via transactional claim_course_reward RPC when authenticated, entitled to Silver, and all core modules are verified", async () => {
    let goldNotified = false;
    const mockDb = createMockSupabaseAdmin({
      completionRow: {
        id: "comp-verified-1",
        email: "silver@example.com",
        user_id: null, // historical unlinked completion record for this email
        completed_at: "2026-10-10T00:00:00Z",
        is_completed: true,
        completed_lessons: ["core-1", "core-2", "core-3", "core-4"],
        reward_submitted_at: null,
      },
    });

    const req = createRewardRequest(
      {
        certificateName: "Asha Patel",
        tshirtSize: "L",
        shippingAddress: "12 MG Road, Pune",
      },
      "valid-jwt",
    );

    const response = await handleSubmitRewardRequest(req, {
      getAuthenticatedUser: async () => ({
        user: { id: "user-silver-1", email: "silver@example.com", isAdmin: false },
        error: null,
      }),
      getMemberEntitledTiers: async () => ({
        canViewMrc: true,
        canViewSilver: true,
        canViewGold: false,
        canViewDiamond: false,
      }),
      supabaseAdmin: mockDb,
      handleGoldCompleterEligibleEvent: async () => {
        goldNotified = true;
      },
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
    assert(
      mockDb.operations.includes("rpc:claim_course_reward:user-silver-1"),
      "Must execute atomic claim_course_reward RPC",
    );
    assert(
      !mockDb.operations.includes("non_atomic_update:course_completions") &&
        !mockDb.operations.includes("non_atomic_insert:commerce_events"),
      "Must NOT perform separate non-atomic table writes",
    );
    assert.equal(goldNotified, true, "Must trigger Gold Completer notification");
  });

  await test("Audit Fix 1: All client serverFn calls in course.tsx and course.complete.tsx forward Authorization Bearer token headers", async () => {
    const courseTsx = fs.readFileSync(path.resolve(process.cwd(), "src/routes/course.tsx"), "utf-8");
    const courseCompleteTsx = fs.readFileSync(
      path.resolve(process.cwd(), "src/routes/course.complete.tsx"),
      "utf-8",
    );

    assert(
      courseTsx.includes("const getSupabaseAuthHeaders = async ()"),
      "course.tsx must define getSupabaseAuthHeaders helper",
    );
    assert(
      courseTsx.includes("recordLessonCompletionFn({ data: { lessonId }, headers })"),
      "recordLessonCompletionFn must pass auth headers",
    );
    assert(
      courseTsx.includes("checkAccessFn({\n          headers: { Authorization: `Bearer ${sessionData.session.access_token}` }"),
      "initSession checkAccessFn must pass Authorization Bearer header",
    );
    assert(
      courseTsx.includes("return await checkAccessFn({ headers });"),
      "onCheckAccess callback must pass auth headers to checkAccessFn",
    );
    assert(
      courseTsx.includes("getLessonVideoFn({ data: { lessonId: activeLesson.id }, headers })"),
      "getLessonVideoFn must pass auth headers",
    );
    assert(
      courseTsx.includes("getLessonCommentsFn({ data: { lessonId: activeLesson.id }, headers })"),
      "getLessonCommentsFn must pass auth headers",
    );
    assert(
      courseCompleteTsx.includes(
        "getCompleterDataFn({\n          headers: { Authorization: `Bearer ${sessionData.session.access_token}` }",
      ),
      "course.complete.tsx getCompleterDataFn must pass Authorization Bearer header",
    );
  });

  await test("Audit Fix 2 & 3: Server Supabase client prioritizes SUPABASE_SERVICE_ROLE_KEY and migration 20261010170000 aligns commerce_events + locks down admin RPCs", async () => {
    const publicServerTs = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/supabase-public.server.ts"),
      "utf-8",
    );
    assert(
      publicServerTs.indexOf('process.env["SUPABASE_SERVICE_ROLE_KEY"]') <
        publicServerTs.indexOf('process.env["SUPABASE_PUBLISHABLE_KEY"]'),
      "createPublicServerClient must prefer SUPABASE_SERVICE_ROLE_KEY before publishable/anon key",
    );

    const mig170000 = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20261010170000_fix_commerce_events_and_rpc_security.sql",
      ),
      "utf-8",
    );
    assert(
      mig170000.includes("CREATE TRIGGER trg_sync_commerce_events_name_type"),
      "Migration must sync commerce_events event_name and event_type columns",
    );
    assert(
      mig170000.includes(
        "REVOKE ALL ON FUNCTION public.record_manual_grant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;",
      ),
      "Migration must revoke anon/authenticated from record_manual_grant",
    );
    assert(
      mig170000.includes(
        "REVOKE ALL ON FUNCTION public.bulk_upload_members(JSONB, TEXT) FROM PUBLIC, anon, authenticated;",
      ),
      "Migration must revoke anon/authenticated from bulk_upload_members",
    );
    assert(
      mig170000.includes(
        "REVOKE ALL ON FUNCTION public.grant_entitlement_on_capture(UUID, TEXT) FROM PUBLIC, anon, authenticated;",
      ),
      "Migration must revoke anon/authenticated from grant_entitlement_on_capture",
    );
    assert(
      mig170000.includes(
        "REVOKE ALL ON FUNCTION public.revoke_entitlement_on_refund(UUID) FROM PUBLIC, anon, authenticated;",
      ),
      "Migration must revoke anon/authenticated from revoke_entitlement_on_refund",
    );
  });

  await test("Audit Fix 4: submit-reward does not claim no database changes occurred on empty/malformed RPC response", async () => {
    const submitRewardTs = fs.readFileSync(
      path.resolve(process.cwd(), "src/routes/api/course/submit-reward.ts"),
      "utf-8",
    );
    assert(
      submitRewardTs.includes(
        "Unable to confirm reward claim status from server. Please refresh or try again.",
      ),
      "Empty RPC response must state that status could not be confirmed rather than claiming no changes were saved",
    );
    assert(
      !submitRewardTs.includes(
        "Failed to confirm reward claim transaction. No changes were saved",
      ),
      "Must not claim no changes were saved when rpcError is null",
    );
  });

  await test("Audit Fix 5: poll-order-status requires valid HMAC token and never mints tokens for unauthorized requests", async () => {
    const pollOrderTs = fs.readFileSync(
      path.resolve(process.cwd(), "src/routes/api/commerce/poll-order-status.ts"),
      "utf-8",
    );
    assert(
      !pollOrderTs.includes("signOrderId("),
      "poll-order-status must NEVER call signOrderId to mint tokens for unauthorized callers",
    );
    assert(
      pollOrderTs.includes("Missing order verification token") &&
        pollOrderTs.includes("Invalid order verification token"),
      "poll-order-status must reject missing (401) and invalid (403) verification tokens",
    );
  });

  await test("Audit Fix 6: Completion pages and getRenderedCompletionPage do not authorize via unverified URL email query params", async () => {
    const completionServerTs = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/commerce/completion.server.ts"),
      "utf-8",
    );
    assert(
      !completionServerTs.includes("userEmail.trim().toLowerCase() === order.buyer_email") &&
        !completionServerTs.includes("isOwnerEmail"),
      "getRenderedCompletionPage must not authorize based on an unverified userEmail parameter",
    );
    assert(
      completionServerTs.includes("if (!isTokenValid)"),
      "getRenderedCompletionPage must strictly require a valid HMAC signature token",
    );

    const completionRoutes = [
      "src/routes/complete.silver.tsx",
      "src/routes/complete.gold.tsx",
      "src/routes/complete.diamond.tsx",
      "src/routes/complete.money-reality-check.tsx",
      "src/routes/complete.silver-upgrade.tsx",
    ];
    for (const relPath of completionRoutes) {
      const code = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
      assert(
        !code.includes("deps.email"),
        `${relPath} must not forward unverified search.email to getRenderedCompletionPage`,
      );
    }
  });

  console.log("\n=================================================================");
  console.log(`SECURITY TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("=================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error("Security test execution failed:", err);
  process.exit(1);
});
