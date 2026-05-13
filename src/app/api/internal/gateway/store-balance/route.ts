import { NextRequest, NextResponse } from 'next/server';
import { fetchGatewayStoreBalance } from '@/lib/paymentGateway';
import { requireSession } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const storeId = req.nextUrl.searchParams.get('storeId')?.trim();
    if (!storeId) {
      return NextResponse.json({ error: 'storeId wajib diisi' }, { status: 400 });
    }

    const balance = await fetchGatewayStoreBalance({
      storeId,
      accountType: 'CASH',
    });

    return NextResponse.json({
      data: {
        ...balance,
        balance: Number(balance.balance || 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil saldo Xendit';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
