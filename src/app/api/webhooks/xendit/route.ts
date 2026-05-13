import { NextResponse } from 'next/server';

// DEPRECATED: Semua webhook Xendit harus melalui payment-gateway.
// Endpoint ini dipertahankan untuk backward compatibility dan hanya mengembalikan 200.
// Silakan arahkan webhook Xendit ke: https://[payment-gateway-domain]/api/v1/webhooks/xendit
export async function POST() {
  console.warn('[webhook/xendit] DEPRECATED — webhook harus diarahkan ke payment-gateway');
  return NextResponse.json({ success: true, deprecated: true });
}
