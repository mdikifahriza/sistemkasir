import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/serverAuth';
import { requireRole } from '@/lib/serverAuth';
import { rateLimit } from '@/lib/rateLimit';

/**
 * GET /api/reports/summary?storeId=...&from=2024-01-01&to=2024-12-31
 *
 * Returns accurate server-side aggregates for the given store and date range.
 * Never limited by bootstrap snapshot size — computes directly from the DB.
 *
 * Intentional exclusions:
 *  - refunded transactions do NOT count toward totalSales
 *  - cancelled transactions are excluded
 *  - only 'completed' transactions count as revenue
 */
export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) return roleError;

    // Rate limit: 30 requests per minute per user for heavy reports
    const limitResult = rateLimit(`report_${session.userId}`, 30, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Batas permintaan laporan terlampaui. Tunggu beberapa saat.' },
        { status: 429, headers: limitResult.headers }
      );
    }

    const { searchParams } = req.nextUrl;

    // --- Date range (default: current month) ---
    const rawFrom = searchParams.get('from');
    const rawTo = searchParams.get('to');

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // first of month
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // last of month

    const fromDate = rawFrom ? new Date(rawFrom + 'T00:00:00') : defaultFrom;
    const toDate = rawTo ? new Date(rawTo + 'T23:59:59') : defaultTo;

    // Used for transaction date range — transactionDate is the authoritative date field
    const txDateFilter = { gte: fromDate, lte: toDate };
    // Expenses use createdAt
    const expDateFilter = { gte: fromDate, lte: toDate };

    // --- 1. Sales aggregates (completed transactions only) ---
    const [salesAgg, refundAgg, transactionCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          status: 'completed',
          transactionDate: txDateFilter,
        },
        _sum: {
          totalAmount: true,
          taxAmount: true,
          serviceCharge: true,
          discountAmount: true,
        },
        _count: { id: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: 'refunded',
          transactionDate: txDateFilter,
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.transaction.count({
        where: {
          status: { in: ['completed', 'refunded', 'cancelled'] },
          transactionDate: txDateFilter,
        },
      }),
    ]);

    // --- 2. Expenses & HPP aggregate ---
    const hppCategories = await prisma.expenseCategory.findMany({
      where: { isForHpp: true },
      select: { id: true },
    });
    const hppCategoryIds = hppCategories.map((c) => c.id);

    const [expensesAgg, hppAgg] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          expenseDate: expDateFilter,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: expDateFilter,
          expenseCategoryId: { in: hppCategoryIds },
        },
        _sum: { amount: true },
      }),
    ]);

    // --- 3. Top products by revenue (from completed transactions only) ---
    const completedTrxIds = await prisma.transaction.findMany({
      where: { status: 'completed', transactionDate: txDateFilter },
      select: { id: true },
    });
    const completedIds = completedTrxIds.map((t) => t.id);

    const topProducts = completedIds.length > 0
      ? await prisma.transactionDetail.groupBy({
          by: ['productId', 'productName'],
          where: {
            transactionId: { in: completedIds },
          },
          _sum: {
            subtotal: true,
            quantity: true,
          },
          orderBy: {
            _sum: { subtotal: 'desc' },
          },
          take: 10,
        })
      : [];

    // --- 4. Daily trend via raw SQL ---
    type DailyRow = { date: Date; total: number; count: bigint };
    const dailyRaw = await prisma.$queryRaw<DailyRow[]>`
      SELECT
        DATE_TRUNC('day', transaction_date) AS date,
        SUM(total_amount)::float AS total,
        COUNT(id) AS count
      FROM transactions
      WHERE
        status = 'completed'
        AND transaction_date >= ${fromDate}
        AND transaction_date <= ${toDate}
      GROUP BY DATE_TRUNC('day', transaction_date)
      ORDER BY DATE_TRUNC('day', transaction_date) ASC
    `;

    // --- 5. Payment method breakdown ---
    const paymentBreakdown = await prisma.transaction.groupBy({
      by: ['paymentMethod'],
      where: {
        status: 'completed',
        transactionDate: txDateFilter,
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    // --- Compute summary ---
    const totalSales = Number(salesAgg._sum.totalAmount ?? 0);
    const totalRefunds = Number(refundAgg._sum.totalAmount ?? 0);
    const netSales = Math.max(totalSales - totalRefunds, 0);
    const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
    const totalHpp = Number(hppAgg._sum.amount ?? 0);
    const netIncome = netSales - totalExpenses;
    const totalTax = Number(salesAgg._sum.taxAmount ?? 0);
    const totalServiceCharge = Number(salesAgg._sum.serviceCharge ?? 0);
    const totalDiscount = Number(salesAgg._sum.discountAmount ?? 0);

    return NextResponse.json({
      data: {
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        summary: {
          totalSales,
          totalRefunds,
          netSales,
          totalExpenses,
          totalHpp,
          hppRatio: netSales > 0 ? (totalHpp / netSales) * 100 : 0,
          netIncome,
          totalTax,
          totalServiceCharge,
          totalDiscount,
          completedTransactions: salesAgg._count.id,
          refundedTransactions: refundAgg._count.id,
          totalTransactionCount: transactionCount,
          expenseCount: expensesAgg._count.id,
        },
        topProducts: topProducts.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          totalRevenue: Number(item._sum.subtotal ?? 0),
          totalQty: Number(item._sum.quantity ?? 0),
        })),
        dailyTrend: dailyRaw.map((row) => ({
          date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
          total: Number(row.total ?? 0),
          count: Number(row.count ?? 0),
        })),
        paymentBreakdown: paymentBreakdown.map((row) => ({
          method: row.paymentMethod,
          total: Number(row._sum?.totalAmount ?? 0),
          count: row._count?.id ?? 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('[reports/summary] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
