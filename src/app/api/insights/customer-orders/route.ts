import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const where: {
      customerId: string;
      processedAt?: { gte: Date; lt: Date };
    } = { customerId };
    if (startDate && endDate) {
      where.processedAt = {
        gte: new Date(startDate),
        lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        processedAt: true,
        totalPrice: true,
        currency: true,
      },
    });

    const data = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.processedAt ? o.processedAt.toISOString() : null,
      total: Number(o.totalPrice || 0),
      currency: o.currency,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/customer-orders] Failed:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
  }
}


