// FILE 1: /api/insights/totals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/lib/auth';

// Using shared Prisma client

export async function GET(request: NextRequest) {
  try {
    console.log('[API/totals] Starting request...');

    // Get storeId from query parameter or use first available store
    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    let storeId = storeIdParam || undefined;
    if (!storeId) {
      const s = await prisma.store.findFirst();
      storeId = s?.id;
    }
    console.log('[API/totals] Store resolved:', storeId || 'None');

    if (!storeId) {
      return NextResponse.json({ 
        error: 'No store found. Please provide a storeId parameter or ensure stores exist in the database.',
        availableStores: await getAvailableStores() 
      }, { status: 404 });
    }

    // Calculate the totals for the specific store
    const totalRevenueResult = await prisma.order.aggregate({
      _sum: { totalPrice: true },
      where: { storeId },
    });
    
    const totalOrders = await prisma.order.count({
      where: { storeId },
    });
    
    const totalCustomers = await prisma.customer.count({
      where: { storeId },
    });

    const response = {
      totalSpent: Number(totalRevenueResult._sum.totalPrice || 0),
      totalOrders: totalOrders,
      totalCustomers: totalCustomers,
    };

    console.log('[API/totals] Response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("[API/totals] Failed to fetch dashboard totals:", error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
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