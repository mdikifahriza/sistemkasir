import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/serverAuth';

export async function POST() {
  return clearAuthCookie(NextResponse.json({ success: true }));
}
