// Server-side Supabase client.
// Uses SERVICE_ROLE_KEY if available (bypasses RLS), otherwise falls back to
// PUBLISHABLE_KEY (respects RLS — works fine when RLS policies are public).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !key) {
    throw new Error(
      'Missing Supabase environment variables (SUPABASE_URL and a key). Connect Supabase in Lovable Cloud.'
    );
  }

  return createClient<Database>(SUPABASE_URL, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
