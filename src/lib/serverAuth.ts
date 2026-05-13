import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'pos-pro-session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
let cachedSessionSecret: string | null = null;
let warnedMissingSessionSecret = false;

export interface AuthSession {
  userId: string;
  role: string;
  fullName: string | null;
  loginId: string;
  issuedAt: number;
  expiresAt: number;
}

type SessionUser = {
  id: string;
  role: string | null;
  fullName: string | null;
};

function getSessionSecret(): string {
  if (cachedSessionSecret) {
    return cachedSessionSecret;
  }

  const sessionSecret = process.env.AUTH_SESSION_SECRET;
  if (sessionSecret) {
    cachedSessionSecret = sessionSecret;
    return cachedSessionSecret;
  }

  if (!warnedMissingSessionSecret) {
    console.warn('AUTH_SESSION_SECRET is not set. Falling back to DATABASE_URL. This is insecure for production.');
    warnedMissingSessionSecret = true;
  }

  cachedSessionSecret = process.env.DATABASE_URL || 'pos-pro-local-secret';
  return cachedSessionSecret;
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function encodeSession(session: AuthSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

function decodeSession(token: string | null | undefined): AuthSession | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthSession;
    if (!session.userId || !session.role || !session.expiresAt) {
      return null;
    }

    if (Date.now() >= session.expiresAt) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function buildAuthSession(user: SessionUser): AuthSession {
  if (!user.role) {
    throw new Error('User is missing required role');
  }

  const issuedAt = Date.now();
  return {
    userId: user.id,
    role: user.role,
    fullName: user.fullName ?? null,
    loginId: `${user.id}-${issuedAt}`,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS * 1000,
  };
}

export function getSessionFromRequest(req: NextRequest): AuthSession | null {
  return decodeSession(req.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export function requireSession(req: NextRequest): AuthSession | NextResponse {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sesi login tidak valid. Silakan login kembali.' }, { status: 401 });
  }

  return session;
}

export function requireRole(session: AuthSession, allowedRoles: string[]): NextResponse | null {
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki izin untuk aksi ini.' }, { status: 403 });
  }

  return null;
}

export function setAuthCookie(response: NextResponse, session: AuthSession): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: encodeSession(session),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}