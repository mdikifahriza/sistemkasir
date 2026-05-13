import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { buildAuthSession, setAuthCookie } from '@/lib/serverAuth';
import { rateLimit } from '@/lib/rateLimit';

type PlainObject = Record<string, unknown>;

function toSnakeCase(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((value) => toSnakeCase(value));
  if (input !== null && typeof input === 'object' && !(input instanceof Date)) {
    return Object.keys(input as PlainObject).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
      result[snakeKey] = toSnakeCase((input as PlainObject)[key]);
      return result;
    }, {} as PlainObject);
  }
  return input;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown-ip';
    const limitResult = rateLimit(`login_${ip}`, 5, 60 * 1000);
    
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
        { status: 429, headers: limitResult.headers }
      );
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Nama pengguna dan kata sandi wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { 
        username,
        isActive: true 
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Nama pengguna atau kata sandi salah' }, { status: 401 });
    }

    const stored = user.password || '';
    const isHashed = stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');
    
    let isMatch = false;
    let needsMigration = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(password, stored);
    } else {
      isMatch = stored === password;
      if (isMatch) {
        needsMigration = true;
      }
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Nama pengguna atau kata sandi salah' }, { status: 401 });
    }

    if (needsMigration) {
      const newHash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHash },
      });
    }

    const { password: _password, ...userWithoutPassword } = user;
    void _password;

    const response = NextResponse.json({
      data: {
        user: toSnakeCase(userWithoutPassword),
      },
    });
    return setAuthCookie(response, buildAuthSession(user));
  } catch (error) {
    console.error('Login Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

