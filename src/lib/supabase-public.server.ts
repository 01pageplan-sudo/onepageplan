import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side Supabase client that uses only the publishable (public) key.
 *
 * The site is hosted on Vercel, where the private service-role key is not
 * available. Every write and the admin read therefore go through
 * SECURITY DEFINER database functions that this key is allowed to call.
 */
export function createPublicServerClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_ANON_KEY"];

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) in the server environment.",
    );
  }

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // New-style sb_ keys are opaque strings, not JWTs.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export type PublicServerClient = ReturnType<typeof createPublicServerClient>;
