import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const storeIdParam = searchParams.get('storeId');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Resolve storeId
    let storeId = storeIdParam || undefined;
    if (!storeId) {
      const store = await prisma.store.findFirst();
      storeId = store?.id;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'No store found in database.' }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: {
        storeId,
        processedAt: {
          gte: new Date(startDate),
          lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { processedAt: true, totalPrice: true },
    });

    const dateMap = new Map<string, { sum: number; count: number }>();
    for (const order of orders) {
      if (!order.processedAt) continue;
      const dateStr = order.processedAt.toISOString().split('T')[0];
      const current = dateMap.get(dateStr) || { sum: 0, count: 0 };
      current.sum += Number(order.totalPrice || 0);
      current.count += 1;
      dateMap.set(dateStr, current);
    }

    const formatted = Array.from(dateMap.entries())
      .map(([date, agg]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avgRevenue: agg.count > 0 ? agg.sum / agg.count : 0,
        orderCount: agg.count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[API/avg-revenue-by-date] Failed:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
  }
}


