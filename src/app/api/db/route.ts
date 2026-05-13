import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { requireRole, requireSession } from '@/lib/serverAuth';

type PlainObject = Record<string, unknown>;

const tableToModel: Record<string, any> = {
  stores: prisma.store,
  users: prisma.user,
  categories: prisma.category,
  products: prisma.product,
  shifts: prisma.shift,
  shift_sessions: prisma.shiftSession,
  shift_employees: prisma.shiftEmployee,
  shift_cash_transfers: prisma.shiftCashTransfer,
  transactions: prisma.transaction,
  transaction_details: prisma.transactionDetail,
  expenses: prisma.expense,
  expense_categories: prisma.expenseCategory,
  activity_logs: prisma.activityLog,
  tables: prisma.table,
  orders: prisma.order,
};

const OWNER_MANAGER_ONLY_TABLES = new Set([
  'stores',
  'users',
  'categories',
  'products',
  'shifts',
  'tables',
]);

const BLOCKED_WRITE_TABLES = new Set(['orders', 'tables']);
const CATEGORY_SELECT = {
  id: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toCamelCase(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => toCamelCase(item));
  }

  if (input && typeof input === 'object' && !(input instanceof Date)) {
    return Object.entries(input as PlainObject).reduce<PlainObject>((result, [key, value]) => {
      const camelKey = key.replace(/(_\w)/g, (match) => match[1].toUpperCase());
      result[camelKey] = toCamelCase(value);
      return result;
    }, {});
  }

  return input;
}

async function hashUserPassword(data: unknown): Promise<void> {
  const normalize = async (item: PlainObject) => {
    const password = item.password;
    if (typeof password === 'string' && !password.startsWith('$2')) {
      item.password = await bcrypt.hash(password, 10);
    }
  };

  if (Array.isArray(data)) {
    await Promise.all(data.map(async (item) => normalize(item as PlainObject)));
    return;
  }

  if (data && typeof data === 'object') {
    await normalize(data as PlainObject);
  }
}

async function getProductUsage(productId: string) {
  const [transactionUsageCount, orderUsageCount] = await Promise.all([
    prisma.transactionDetail.count({
      where: { productId },
    }),
    prisma.orderItem.count({
      where: { productId },
    }),
  ]);

  return {
    hasTransactionHistory: transactionUsageCount > 0,
    hasOperationalHistory: transactionUsageCount > 0 || orderUsageCount > 0,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const limitResult = rateLimit(`db_${session.userId}`, 100, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Batas permintaan API terlampaui. Tunggu beberapa saat.' },
        { status: 429, headers: limitResult.headers }
      );
    }

    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';
    const table = typeof body.table === 'string' ? body.table : '';
    const match = body.match ? (toCamelCase(body.match) as PlainObject) : {};
    const sortOrder = body.order;
    const single = Boolean(body.single);

    const model = tableToModel[table];
    if (!model) {
      return NextResponse.json({ error: `Table '${table}' tidak diizinkan atau tidak ditemukan` }, { status: 400 });
    }

    const writeAction = action === 'insert' || action === 'update' || action === 'delete';
    if (writeAction && OWNER_MANAGER_ONLY_TABLES.has(table)) {
      const roleError = requireRole(session, ['owner', 'manager']);
      if (roleError) {
        return roleError;
      }
    }

    if (writeAction && BLOCKED_WRITE_TABLES.has(table)) {
      return NextResponse.json(
        { error: `Perubahan ${table} harus lewat endpoint khusus operasional.` },
        { status: 403 }
      );
    }

    if (writeAction && table === 'stores' && action !== 'update') {
      return NextResponse.json({ error: 'Aksi ini tidak diizinkan untuk data toko.' }, { status: 403 });
    }

    const prismaData = body.data ? toCamelCase(body.data) : null;

    if (table === 'users' && prismaData) {
      await hashUserPassword(prismaData);
    }

    if (action === 'select') {
      const options: PlainObject = { where: match };

      if (sortOrder && typeof sortOrder.column === 'string') {
        const camelOrderColumn = sortOrder.column.replace(/(_\w)/g, (value: string) => value[1].toUpperCase());
        options.orderBy = { [camelOrderColumn]: sortOrder.ascending ? 'asc' : 'desc' };
      }

      if (table === 'categories') {
        options.select = CATEGORY_SELECT;
      }

      const rows = single ? await model.findFirst(options) : await model.findMany(options);
      return NextResponse.json({ data: rows });
    }

    if (action === 'insert') {
      if (!prismaData) {
        return NextResponse.json({ error: 'Data wajib diisi' }, { status: 400 });
      }

      const rows = Array.isArray(prismaData)
        ? await Promise.all(prismaData.map((item) => model.create({ data: item })))
        : await model.create({ data: prismaData });

      return NextResponse.json({ data: rows });
    }

    if (action === 'update') {
      if (!body.match) {
        return NextResponse.json({ error: 'Match wajib diisi' }, { status: 400 });
      }

      if (!prismaData) {
        return NextResponse.json({ error: 'Data update wajib diisi' }, { status: 400 });
      }

      if (typeof match.id === 'string') {
        if (table === 'products') {
          const existingProduct = await prisma.product.findUnique({
            where: { id: match.id },
            select: {
              id: true,
              sellingPrice: true,
            },
          });

          if (!existingProduct) {
            return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
          }

          const usage = await getProductUsage(match.id);
          const nextSellingPrice =
            prismaData && typeof (prismaData as PlainObject).sellingPrice !== 'undefined'
              ? Number((prismaData as PlainObject).sellingPrice)
              : null;

          if (
            usage.hasTransactionHistory &&
            nextSellingPrice !== null &&
            Number(existingProduct.sellingPrice) !== nextSellingPrice
          ) {
            return NextResponse.json(
              {
                error:
                  'Harga produk yang sudah pernah dipakai transaksi tidak boleh diubah. Buat produk baru jika ingin harga baru.',
              },
              { status: 409 }
            );
          }
        }

        const row = await model.update({
          where: { id: match.id },
          data: prismaData,
        });
        return NextResponse.json({ data: row });
      }

      const result = await model.updateMany({ where: match, data: prismaData });
      return NextResponse.json({ data: result });
    }

    if (action === 'delete') {
      if (!body.match) {
        return NextResponse.json({ error: 'Match wajib diisi' }, { status: 400 });
      }

      if (typeof match.id === 'string') {
        if (table === 'categories') {
          const productCount = await prisma.product.count({
            where: { categoryId: match.id },
          });

          if (productCount > 0) {
            return NextResponse.json(
              {
                error:
                  'Kategori yang sudah dipakai produk tidak bisa dihapus. Pindahkan atau ubah kategori produk terlebih dahulu.',
              },
              { status: 409 }
            );
          }
        }

        if (table === 'products') {
          const usage = await getProductUsage(match.id);
          if (usage.hasOperationalHistory) {
            return NextResponse.json(
              {
                error:
                  'Produk yang sudah pernah dipakai order atau transaksi tidak bisa dihapus. Ubah status ke Diarsipkan.',
              },
              { status: 409 }
            );
          }
        }

        const row = await model.delete({ where: { id: match.id } });
        return NextResponse.json({ data: row });
      }

      const result = await model.deleteMany({ where: match });
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error) {
    console.error('[db/route] API Error:', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Terjadi kesalahan pada server database'
        : error instanceof Error
          ? error.message
          : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
