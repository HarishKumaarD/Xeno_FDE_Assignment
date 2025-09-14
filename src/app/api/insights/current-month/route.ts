import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let storeId = storeIdParam || undefined;
    if (!storeId) {
      const store = await prisma.store.findFirst();
      storeId = store?.id;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'No store found' }, { status: 404 });
    }

    const [sumAgg, orderCount] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: {
          storeId,
          processedAt: {
            gte: startOfMonth,
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
      }),
      prisma.order.count({
        where: {
          storeId,
          processedAt: {
            gte: startOfMonth,
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
      }),
    ]);

    const revenue = Number(sumAgg._sum.totalPrice || 0);
    return NextResponse.json({ revenue, orders: orderCount, month: now.getMonth() + 1, year: now.getFullYear() });
  } catch (error) {
    console.error('[API/current-month] Failed:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
  }
}


