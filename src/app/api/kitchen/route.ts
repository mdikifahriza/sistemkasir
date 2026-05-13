import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ACTIVE_ORDER_STATUSES,
  KDS_VISIBLE_STATUSES,
  getTransition,
  validateTransition,
} from '@/lib/orderStateMachine';
import { requireRole, requireSession } from '@/lib/serverAuth';


export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const orders = await prisma.order.findMany({
      where: {
        status: { in: [...KDS_VISIBLE_STATUSES] },
      },
      include: {
        table: true,
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat antrean dapur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager', 'cashier', 'kitchen']);
    if (roleError) {
      return roleError;
    }

    const body = await req.json();
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    const targetStatus = typeof body.status === 'string' ? body.status : '';

    if (!orderId || !targetStatus) {
      return NextResponse.json({ error: 'Order ID dan status wajib diisi' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        tableId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const validationError = validateTransition(order.status, targetStatus, session.role);
    if (validationError) {
      console.warn('[kitchen] Transition rejected', {
        orderId,
        from: order.status,
        to: targetStatus,
        role: session.role,
        reason: validationError,
      });
      return NextResponse.json({ error: validationError }, { status: 403 });
    }

    if (order.status === targetStatus) {
      return NextResponse.json({ data: order });
    }

    const transition = getTransition(order.status, targetStatus);
    const previousStatus = order.status;
    const actorName = session.fullName || session.role;

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: targetStatus },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          tableId: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.userId,
          action: 'order_status_change',
          tableName: 'orders',
          recordId: orderId,
          description: `${actorName} mengubah pesanan ${order.orderNumber}: ${previousStatus} -> ${targetStatus}`,
          oldValue: { status: previousStatus },
          newValue: {
            status: targetStatus,
            changedBy: session.userId,
            changedByName: actorName,
            changedByRole: session.role,
            transitionLabel: transition?.label ?? null,
          },
        },
      });

      if ((targetStatus === 'completed' || targetStatus === 'cancelled') && updatedOrder.tableId) {
        const otherActiveOrders = await tx.order.count({
          where: {
            tableId: updatedOrder.tableId,
            id: { not: updatedOrder.id },
            status: { in: [...ACTIVE_ORDER_STATUSES] },
          },
        });

        if (otherActiveOrders === 0) {
          await tx.table.update({
            where: { id: updatedOrder.tableId },
            data: { status: 'available' },
          });
        }
      }

      return updatedOrder;
    });

    console.info('[kitchen] Order status updated', {
      orderId,
      orderNumber: order.orderNumber,
      from: previousStatus,
      to: targetStatus,
      actor: actorName,
      role: session.role,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[kitchen] Error updating order status', error);
    const message = error instanceof Error ? error.message : 'Gagal memperbarui status dapur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
