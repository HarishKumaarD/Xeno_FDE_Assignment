// FILE 3: /api/insights/top-orders/route.ts
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');

    const user = await currentUser();

    let storeId = storeIdParam || undefined;

    if (!storeId) {
      if (user?.id) {
        const store = await prisma.store.findFirst({ where: { userId: user.id } });
        storeId = store?.id;
      }
      if (!storeId) {
        const store = await prisma.store.findFirst();
        storeId = store?.id;
      }
    }

    if (!storeId) {
      return NextResponse.json({ error: 'No store found' }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { storeId },
      orderBy: { totalPrice: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalPrice: true,
        currency: true,
        processedAt: true,
        customer: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    const mapped = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: Number(o.totalPrice),
      currency: o.currency,
      date: o.processedAt ? o.processedAt.toISOString() : null,
      customerName: [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || 'Guest',
      customerEmail: o.customer?.email || undefined,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[INSIGHTS/top-orders] Error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
  }
}


