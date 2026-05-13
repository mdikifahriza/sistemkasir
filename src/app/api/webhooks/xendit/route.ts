import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toPrismaJson } from '@/lib/paymentStatus';

// Xendit Webhook Secret (Set this in .env)
const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN;

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Webhook Token
    const callbackToken = req.headers.get('x-callback-token');
    if (XENDIT_WEBHOOK_TOKEN && callbackToken !== XENDIT_WEBHOOK_TOKEN) {
      console.warn('[webhook/xendit] Unauthorized webhook attempt', { callbackToken });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[webhook/xendit] Received payload:', body);

    const externalId = body.external_id;
    const status = body.status; // 'PAID', 'EXPIRED', etc.
    const amount = body.amount;
    const paidAt = body.paid_at;

    if (!externalId) {
      return NextResponse.json({ error: 'External ID missing' }, { status: 400 });
    }

    // 2. Find Transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: externalId }, // If external_id is the transaction UUID
          { gatewayPaymentId: externalId },
          { invoiceNumber: externalId }
        ]
      },
      include: {
        shiftSession: true,
        orders: true
      }
    });

    if (!transaction) {
      console.warn('[webhook/xendit] Transaction not found for externalId:', externalId);
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // 3. Handle Payment Status
    if (status === 'PAID' || status === 'SETTLED') {
      if (transaction.status === 'completed') {
        return NextResponse.json({ message: 'Already processed' });
      }

      await prisma.$transaction(async (tx) => {
        // Update Transaction
        const updatedTrx = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'completed',
            amountPaid: amount,
            changeAmount: 0,
            paidAt: paidAt ? new Date(paidAt) : new Date()
          }
        });

        // Update Linked Orders
        if (transaction.orders.length > 0) {
          await tx.order.updateMany({
            where: { transactionId: transaction.id },
            data: {
              status: 'paid',
              paidAt: paidAt ? new Date(paidAt) : new Date()
            }
          });
        }

        // Update Shift Session (Real-time Digital Balance)
        if (transaction.shiftSessionId) {
          await tx.shiftSession.update({
            where: { id: transaction.shiftSessionId },
            data: {
              totalDigitalSales: { increment: amount },
              totalTransactions: { increment: 1 },
              xenditTotalIn: { increment: amount },
              xenditTransactionCount: { increment: 1 }
            }
          });
        }

        // Log Activity
        await tx.activityLog.create({
          data: {
            action: 'payment_webhook_received',
            tableName: 'transactions',
            recordId: transaction.id,
            description: `Pembayaran digital diterima via Xendit: ${amount}`,
            newValue: toPrismaJson(body)
          }
        });
      });

      console.info('[webhook/xendit] Payment successful and synced:', {
        transactionId: transaction.id,
        invoiceNumber: transaction.invoiceNumber,
        amount
      });
    } else if (status === 'EXPIRED' || status === 'FAILED') {
       await prisma.transaction.update({
         where: { id: transaction.id },
         data: { status: 'void', notes: (transaction.notes || '') + ` [Xendit: ${status}]` }
       });
       
       if (transaction.orders.length > 0) {
          await prisma.order.updateMany({
            where: { transactionId: transaction.id },
            data: { status: 'cancelled' }
          });
       }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[webhook/xendit] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
