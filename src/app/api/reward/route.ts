import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { claimRewardForSession } from '@/lib/reward';

export async function POST() {
  const sessionId = await requireSession();
  if (!sessionId) {
    return NextResponse.json({ status: 'error', reason: 'no_session' }, { status: 400 });
  }

  const result = await claimRewardForSession(sessionId);
  return NextResponse.json(result, {
    status: result.status === 'error' ? 400 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
