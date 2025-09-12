// FILE: /api/insights/top-customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[API/top-customers] Starting request...');
    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    
    // Get authenticated user
    const user = await currentUser();
    if (!user?.id) {
      console.log('[API/top-customers] No authenticated user found');
      // Fallback: try to get first available store if no auth
      const store = await prisma.store.findFirst();
      if (!store) {
        return NextResponse.json({ 
          error: 'No store found and no authenticated user',
          availableStores: await getAvailableStores() 
        }, { status: 404 });
      }
      
      // Get data for first available store
      const result = await getCombinedDataForStore(store.id);
      return result;
    }

    // Resolve store for authenticated user
    let storeId = storeIdParam || undefined;
    if (!storeId) {
      const s = await prisma.store.findFirst({ where: { userId: user.id } });
      storeId = s?.id;
    }

    // Fallback: if no store for user, get first available store
    if (!storeId) {
      console.log('[API/top-customers] No store for user, trying first available store');
      const s = await prisma.store.findFirst();
      storeId = s?.id;
    }

    console.log('[API/top-customers] Store resolved:', storeId || 'None');

    if (!storeId) {
      return NextResponse.json({ 
        error: 'No store found. Please ensure stores exist in the database.',
        availableStores: await getAvailableStores() 
      }, { status: 404 });
    }

    // Get combined data (customers and orders)
    const result = await getCombinedDataForStore(storeId);
    return result;

  } catch (error) {
    console.error("[API/top-customers] Failed to fetch data:", error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getCombinedDataForStore(storeId: string) {
  try {
    console.log('[API/top-customers] Querying combined data for store:', storeId);
    
    // Fetch top customers and top orders in parallel
    const [topCustomersData, topOrdersData] = await Promise.all([
      getTopCustomersData(storeId),
      getTopOrdersData(storeId)
    ]);

    const result = {
      topCustomers: topCustomersData,
      topOrders: topOrdersData
    };

    console.log('[API/top-customers] Combined result:', {
      customersCount: result.topCustomers.length,
      ordersCount: result.topOrders.length
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[API/top-customers] Error in getCombinedDataForStore:', error);
    throw error;
  }
}

async function getTopCustomersData(storeId: string) {
  try {
    const topCustomersSpend = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        storeId: storeId,
        customerId: { not: null },
      },
      _sum: {
        totalPrice: true,
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc',
        },
      },
      take: 5,
    });

    if (topCustomersSpend.length === 0) {
      return [];
    }
    
    const customerIds = topCustomersSpend.map(c => c.customerId as string);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
    });

    const customerMap = new Map(customers.map(c => [c.id, c]));
    const result = topCustomersSpend.map(spend => {
      const details = customerMap.get(spend.customerId as string);
      return {
        customerId: details?.id,
        name: `${details?.firstName || ''} ${details?.lastName || ''}`.trim() || 'Unknown Customer',
        email: details?.email || 'No email',
        totalSpend: Number(spend._sum.totalPrice || 0),
      };
    });

    return result;
  } catch (error) {
    console.error('[API/top-customers] Error getting top customers:', error);
    return [];
  }
}

async function getTopOrdersData(storeId: string) {
  try {
    const orders = await prisma.order.findMany({
      where: { storeId: storeId },
      orderBy: { totalPrice: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalPrice: true,
        currency: true,
        processedAt: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
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

    return mapped;
  } catch (error) {
    console.error('[API/top-customers] Error getting top orders:', error);
    return [];
  }
}

// Helper function to get available stores for error message
async function getAvailableStores() {
  try {
    const stores = await prisma.store.findMany({
      select: { id: true, shop: true },
      take: 10 // Limit to first 10 stores
    });
    return stores;
  } catch (error) {
    console.error('Error fetching available stores:', error);
    return [];
  }
}