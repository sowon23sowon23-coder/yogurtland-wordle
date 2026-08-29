import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { submitGuess } from '@/lib/game';

export async function POST(request: Request) {
  const sessionId = await requireSession();
  if (!sessionId) {
    return NextResponse.json({ ok: false, reason: 'no_session' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_length' }, { status: 400 });
  }

  const guess = (body as { guess?: unknown } | null)?.guess;
  const result = await submitGuess(sessionId, guess);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}
