import 'server-only';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from './supabase-admin';
import { isDemoMode } from './demo-game';

// Keep in sync with middleware.ts.
export const SESSION_COOKIE = 'yl_session';

export function readSessionId(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

/** Upserts the sessions row so it exists before any game/reward write references it. */
export async function ensureSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('sessions')
    .upsert(
      { id: sessionId, last_seen_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) throw error;
}

/**
 * Reads the session cookie set by middleware.ts and makes sure a matching
 * `sessions` row exists. Returns null only if the cookie is somehow missing
 * (middleware should prevent that on any real request).
 */
export async function requireSession(): Promise<string | null> {
  const sessionId = readSessionId();
  if (!sessionId) return null;
  // Demo mode has no database, so there is no sessions row to create.
  if (!isDemoMode()) await ensureSession(sessionId);
  return sessionId;
}
