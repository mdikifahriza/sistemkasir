import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'pos-pro-session';

export function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const publicPaths = [
    '/api/auth/login',
    '/api/public/',
    '/api/internal/gateway/',
    '/api/health',
  ];
  if (publicPaths.some((path) => req.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME);
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized: Session required' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
