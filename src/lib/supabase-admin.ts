import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Service-role Supabase client. Import this ONLY from route handlers
// (src/app/api/**/route.ts) or server-only lib modules those handlers call.
// It must never end up in a Client Component bundle.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
