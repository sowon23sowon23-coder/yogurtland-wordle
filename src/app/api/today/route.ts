import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getTodayState } from '@/lib/game';

export async function GET() {
  const sessionId = await requireSession();
  if (!sessionId) {
    return NextResponse.json({ error: 'no_session' }, { status: 400 });
  }

  const today = await getTodayState(sessionId);
  return NextResponse.json(today, { headers: { 'Cache-Control': 'no-store' } });
}
