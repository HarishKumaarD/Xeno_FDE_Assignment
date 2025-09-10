// FILE 3: /api/insights/top-customers/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { PrismaClient } from '@prisma/client';
// // import { getServerSession } from 'next-auth/next';
// // import { authOptions } from '@/lib/auth';

// const prisma = new PrismaClient();

// export async function GET(request: NextRequest) {
//   try {
//     console.log('[API/top-customers] Starting request...');
    
//     // FIXED: Authentication with proper context
//     const session = await getServerSession(authOptions);
//     console.log('[API/top-customers] Session:', session ? 'Found' : 'Not found');
    
//     if (!session?.user?.id) {
//       console.log('[API/top-customers] Authentication failed');
//       return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
//     }

//     const userId = session.user.id;
//     console.log('[API/top-customers] User ID:', userId);

//     // Find the store connected to the currently logged-in user
//     const store = await prisma.store.findFirst({
//       where: { userId: userId },
//     });

//     console.log('[API/top-customers] Store found:', store ? store.shop : 'None');

//     if (!store) {
//       return NextResponse.json({ error: 'No store connected for this user.' }, { status: 404 });
//     }

//     // Perform the database query to get top customers
//     const result = await getTopCustomersForStore(store.id);
//     return result;

//   } catch (error) {
//     console.error("[API/top-customers] Failed to fetch top customers:", error);
//     const message = error instanceof Error ? error.message : 'An unexpected error occurred';
//     return NextResponse.json({ error: message }, { status: 500 });
//   } finally {
//     await prisma.$disconnect();
//   }
// }

// async function getTopCustomersForStore(storeId: string) {
//   try {
//     console.log('[API/top-customers] Querying top customers for store:', storeId);
    
//     // This advanced Prisma query groups orders by customer, sums their spending,
//     // orders by that sum, and takes the top 5.
//     const topCustomersSpend = await prisma.order.groupBy({
//       by: ['customerId'],
//       where: {
//         storeId: storeId,
//         customerId: { not: null }, // Exclude orders without a linked customer
//       },
//       _sum: {
//         totalPrice: true,
//       },
//       orderBy: {
//         _sum: {
//           totalPrice: 'desc',
//         },
//       },
//       take: 5,
//     });

//     console.log('[API/top-customers] Found top customers:', topCustomersSpend.length);

//     // If there are no orders with customers, return an empty array.
//     if (topCustomersSpend.length === 0) {
//       return NextResponse.json([]);
//     }
    
//     // Extract the customer IDs from the aggregation result.
//     const customerIds = topCustomersSpend.map(c => c.customerId as string);

//     // Fetch the full details (name, email) for those top customer IDs.
//     const customers = await prisma.customer.findMany({
//       where: { id: { in: customerIds } },
//     });

//     console.log('[API/top-customers] Found customer details for:', customers.length, 'customers');

//     // Create a lookup map for easy access to customer details.
//     const customerMap = new Map(customers.map(c => [c.id, c]));

//     // Combine the spending data with the customer details into a final response object.
//     const result = topCustomersSpend.map(spend => {
//       const details = customerMap.get(spend.customerId as string);
//       return {
//         name: `${details?.firstName || ''} ${details?.lastName || ''}`.trim() || 'Unknown Customer',
//         email: details?.email || 'No email',
//         totalSpend: Number(spend._sum.totalPrice || 0),
//       };
//     });

//     console.log('[API/top-customers] Final result:', result);
//     return NextResponse.json(result);
    
//   } catch (error) {
//     console.error('[API/top-customers] Error in getTopCustomersForStore:', error);
//     throw error;
//   }
// }

// FILE 3: /api/insights/top-customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('[API/top-customers] Starting request...');
    
    // Get all stores or a specific store if provided
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    
    let store;
    
    if (storeId) {
      // If storeId is provided, use that specific store
      console.log('[API/top-customers] Using provided store ID:', storeId);
      store = await prisma.store.findUnique({
        where: { id: storeId },
      });
    } else {
      // If no storeId provided, get the first available store
      console.log('[API/top-customers] No store ID provided, fetching first available store');
      store = await prisma.store.findFirst();
    }

    console.log('[API/top-customers] Store found:', store ? store.shop : 'None');

    if (!store) {
      return NextResponse.json({ 
        error: 'No store found. Please provide a storeId parameter or ensure stores exist in the database.',
        availableStores: await getAvailableStores() 
      }, { status: 404 });
    }

    // Perform the database query to get top customers
    const result = await getTopCustomersForStore(store.id);
    return result;

  } catch (error) {
    console.error("[API/top-customers] Failed to fetch top customers:", error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

async function getTopCustomersForStore(storeId: string) {
  try {
    console.log('[API/top-customers] Querying top customers for store:', storeId);
    
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

    console.log('[API/top-customers] Found top customers:', topCustomersSpend.length);

    if (topCustomersSpend.length === 0) {
      return NextResponse.json([]);
    }
    
    const customerIds = topCustomersSpend.map(c => c.customerId as string);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
    });

    console.log('[API/top-customers] Found customer details for:', customers.length, 'customers');

    const customerMap = new Map(customers.map(c => [c.id, c]));
    const result = topCustomersSpend.map(spend => {
      const details = customerMap.get(spend.customerId as string);
      return {
        name: `${details?.firstName || ''} ${details?.lastName || ''}`.trim() || 'Unknown Customer',
        email: details?.email || 'No email',
        totalSpend: Number(spend._sum.totalPrice || 0),
      };
    });

    console.log('[API/top-customers] Final result:', result);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[API/top-customers] Error in getTopCustomersForStore:', error);
    throw error;
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