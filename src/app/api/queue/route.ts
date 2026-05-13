import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.order.count({
      where: {
        orderType: 'takeaway',
        createdAt: {
          gte: today,
        },
      },
    });

    const queueNumber = `T-${(count + 1).toString().padStart(3, '0')}`;

    return NextResponse.json({ 
      data: { 
        queueNumber,
        count: count + 1 
      } 
    });
  } catch (error) {
    console.error('[queue] Error generating queue number', error);
    return NextResponse.json({ error: 'Gagal membuat nomor antrian' }, { status: 500 });
  }
}
