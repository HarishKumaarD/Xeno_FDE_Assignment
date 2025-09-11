import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [sumAgg, orderCount] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: {
          processedAt: {
            gte: startOfMonth,
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
      }),
      prisma.order.count({
        where: {
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


