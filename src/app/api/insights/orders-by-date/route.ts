// FILE 2: /api/insights/orders-by-date/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { PrismaClient } from '@prisma/client';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/lib/auth';

// const prisma = new PrismaClient();

// export async function GET(request: NextRequest) {
//   try {
//     console.log('[API/orders-by-date] Starting request...');
    
//     // FIXED: Authentication with proper context
//     const session = await getServerSession(authOptions);
//     console.log('[API/orders-by-date] Session:', session ? 'Found' : 'Not found');
    
//     if (!session?.user?.id) {
//       console.log('[API/orders-by-date] Authentication failed');
//       return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
//     }

//     // Parse date parameters from the request URL
//     const { searchParams } = new URL(request.url);
//     const startDate = searchParams.get('startDate');
//     const endDate = searchParams.get('endDate');

//     console.log('[API/orders-by-date] Date range:', { startDate, endDate });

//     if (!startDate || !endDate) {
//       return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
//     }
    
//     // Find the store that belongs to the authenticated user
//     const store = await prisma.store.findFirst({
//       where: { userId: session.user.id },
//     });
    
//     console.log('[API/orders-by-date] Store found:', store ? store.shop : 'None');
    
//     if (!store) {
//       return NextResponse.json({ error: 'No store connected for this user.' }, { status: 404 });
//     }

//     // FIXED: Use Prisma query instead of raw SQL for better compatibility
//     const orders = await prisma.order.findMany({
//       where: {
//         storeId: store.id,
//         processedAt: {
//           gte: new Date(startDate),
//           lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000), // Add 1 day
//         },
//       },
//       select: {
//         processedAt: true,
//       },
//     });

//     // Group orders by date
//     const dateMap = new Map<string, number>();
    
//     orders.forEach(order => {
//       if (order.processedAt) {
//         const dateStr = order.processedAt.toISOString().split('T')[0];
//         dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
//       }
//     });

//     // Format the data for the frontend charting library
//     const formattedData = Array.from(dateMap.entries())
//       .map(([date, count]) => ({
//         date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
//         Orders: count,
//       }))
//       .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

//     console.log('[API/orders-by-date] Formatted data length:', formattedData.length);
//     return NextResponse.json(formattedData);

//   } catch (error) {
//     console.error("[API/orders-by-date] Failed to fetch orders by date:", error);
//     const message = error instanceof Error ? error.message : 'An unexpected error occurred';
//     return NextResponse.json({ error: message }, { status: 500 });
//   } finally {
//     await prisma.$disconnect();
//   }
// }

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Using shared Prisma client

export async function GET(request: NextRequest) {
  try {
    console.log('[API/orders-by-date] Starting request...');
    
    // TEMPORARILY COMMENTED OUT FOR TESTING
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    // }

    // Parse parameters from the request URL
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const storeIdParam = searchParams.get('storeId');

    console.log('[API/orders-by-date] Date range:', { startDate, endDate });

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }
    
    // Resolve storeId if not provided
    let storeId = storeIdParam || undefined;
    if (!storeId) {
      const store = await prisma.store.findFirst();
      storeId = store?.id;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'No store found in database.' }, { status: 404 });
    }

    // Use Prisma query instead of raw SQL
    const orders = await prisma.order.findMany({
      where: {
        storeId,
        processedAt: {
          gte: new Date(startDate),
          lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: {
        processedAt: true,
      },
    });

    // Group orders by date
    const dateMap = new Map<string, number>();
    
    orders.forEach(order => {
      if (order.processedAt) {
        const dateStr = order.processedAt.toISOString().split('T')[0];
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
      }
    });

    // Format the data
    const formattedData = Array.from(dateMap.entries())
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Orders: count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('[API/orders-by-date] Formatted data length:', formattedData.length);
    return NextResponse.json(formattedData);

  } catch (error) {
    console.error("[API/orders-by-date] Failed to fetch orders by date:", error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
  }
}