import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const categorySelect = {
  id: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: categorySelect,
    });

    const products = await prisma.product.findMany({
      where: {
        status: 'available',
      },
      include: {
        category: {
          select: categorySelect,
        },
      },
      orderBy: { name: 'asc' },
    });

    const store = await prisma.store.findFirst({
      select: {
        name: true,
        logoUrl: true,
        currency: true,
        taxPercentage: true,
        serviceChargePercentage: true,
      },
    });

    return NextResponse.json({
      data: {
        store,
        categories,
        products,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
