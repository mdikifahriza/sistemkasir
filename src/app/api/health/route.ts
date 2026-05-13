import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Quick DB ping to ensure connection is healthy
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      version: '1.0.0', // Update this based on your release versioning
    });
  } catch (error) {
    console.error('[Health Check] Database connection failed:', error);
    return NextResponse.json({
      status: 'error',
      db: 'disconnected',
      message: 'Failed to connect to the database.',
    }, { status: 503 }); // 503 Service Unavailable
  }
}
