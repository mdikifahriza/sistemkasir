import { NextRequest, NextResponse } from 'next/server';

import { getSessionFromRequest } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({ error: 'Sesi login tidak valid. Silakan login kembali.' }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      userId: session.userId,
      role: session.role,
      fullName: session.fullName,
      loginId: session.loginId,
      expiresAt: session.expiresAt,
    },
  });
}
