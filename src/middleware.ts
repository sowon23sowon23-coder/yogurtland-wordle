import { NextResponse, type NextRequest } from 'next/server';

// Just bootstraps an anonymous session cookie. No DB access here on purpose —
// middleware runs on the Edge runtime for every request, so it stays cheap.
// The actual `sessions` row is upserted server-side the first time an API
// route needs it (see src/lib/session.ts).
const SESSION_COOKIE = 'yl_session';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
