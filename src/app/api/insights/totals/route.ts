// FILE 1: /api/insights/totals/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { PrismaClient } from '@prisma/client';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/lib/auth';

// const prisma = new PrismaClient();

// async function syncHistoricalData(store: { id: string; shop: string; accessToken: string; }) {
//   console.log(`[SYNC] Starting historical data sync for ${store.shop}...`);
//   try {
//     // --- Sync Customers ---
//     const customersApiUrl = `https://${store.shop}/admin/api/2024-07/customers.json?limit=250`;
//     const customersResponse = await fetch(customersApiUrl, {
//       headers: { 'X-Shopify-Access-Token': store.accessToken },
//     });
//     
//     if (customersResponse.ok) {
//       const { customers } = await customersResponse.json();
//       console.log(`[SYNC] Fetched ${customers.length} customers from Shopify.`);
//       
//       for (const customerData of customers) {
//         await prisma.customer.upsert({
//           where: { 
//             shopifyId_storeId: { 
//               shopifyId: customerData.id.toString(), 
//               storeId: store.id 
//             } 
//           },
//           update: { 
//             email: customerData.email, 
//             firstName: customerData.first_name, 
//             lastName: customerData.last_name 
//           },
//           create: { 
//             shopifyId: customerData.id.toString(), 
//             email: customerData.email, 
//             firstName: customerData.first_name, 
//             lastName: customerData.last_name, 
//             storeId: store.id 
//           },
//         });
//       }
//       console.log(`[SYNC] Successfully upserted ${customers.length} customers.`);
//     } else {
//       console.error(`[SYNC] Failed to fetch customers: ${await customersResponse.text()}`);
//     }

//     // --- Sync Orders ---
//     const ordersApiUrl = `https://${store.shop}/admin/api/2024-07/orders.json?status=any&limit=250`;
//     const ordersResponse = await fetch(ordersApiUrl, {
//       headers: { 'X-Shopify-Access-Token': store.accessToken },
//     });
//     
//     if (ordersResponse.ok) {
//       const { orders } = await ordersResponse.json();
//       console.log(`[SYNC] Fetched ${orders.length} orders from Shopify.`);
//       
//       for (const orderData of orders) {
//         const customer = orderData.customer 
//           ? await prisma.customer.findUnique({ 
//               where: { 
//                 shopifyId_storeId: { 
//                   shopifyId: orderData.customer.id.toString(), 
//                   storeId: store.id 
//                 } 
//               } 
//             }) 
//           : null;
//           
//         await prisma.order.upsert({
//           where: { 
//             shopifyId_storeId: { 
//               shopifyId: orderData.id.toString(), 
//               storeId: store.id 
//             } 
//           },
//           update: { 
//             financialStatus: orderData.financial_status, 
//             fulfillmentStatus: orderData.fulfillment_status 
//           },
//           create: { 
//             shopifyId: orderData.id.toString(), 
//             orderNumber: orderData.name, 
//             totalPrice: parseFloat(orderData.total_price), 
//             currency: orderData.currency, 
//             financialStatus: orderData.financial_status, 
//             fulfillmentStatus: orderData.fulfillment_status, 
//             processedAt: orderData.processed_at ? new Date(orderData.processed_at) : null, 
//             storeId: store.id, 
//             customerId: customer?.id 
//           },
//         });
//       }
//       console.log(`[SYNC] Successfully upserted ${orders.length} orders.`);
//     } else {
//       console.error(`[SYNC] Failed to fetch orders: ${await ordersResponse.text()}`);
//     }
//   } catch (error) {
//     console.error(`[SYNC] Error during historical sync for ${store.shop}:`, error);
//   }
// }

// export async function GET(request: NextRequest) {
//   try {
//     console.log('[API/totals] Starting request...');
//     
//     // FIXED: Pass request context to getServerSession
//     const session = await getServerSession(authOptions);
//     console.log('[API/totals] Session:', session ? 'Found' : 'Not found');
//     
//     if (!session?.user?.id) {
//       console.log('[API/totals] Authentication failed');
//       return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
//     }

//     console.log('[API/totals] User ID:', session.user.id);

//     // Find the store that belongs to the authenticated user
//     const store = await prisma.store.findFirst({
//       where: { userId: session.user.id },
//     });

//     console.log('[API/totals] Store found:', store ? store.shop : 'None');

//     if (!store) {
//       return NextResponse.json({ error: 'No store connected for this user.' }, { status: 404 });
//     }

//     // Check if a historical sync is needed
//     const orderCount = await prisma.order.count({ where: { storeId: store.id } });
//     console.log('[API/totals] Order count:', orderCount);
//     
//     if (orderCount === 0) {
//       console.log(`[API/totals] No orders found in DB for store ${store.shop}. Triggering historical sync.`);
//       await syncHistoricalData(store);
//     }

//     // Calculate the totals for the user's specific store
//     const totalRevenueResult = await prisma.order.aggregate({
//       _sum: { totalPrice: true },
//       where: { storeId: store.id },
//     });
//     
//     const totalOrders = await prisma.order.count({
//       where: { storeId: store.id },
//     });
//     
//     const totalCustomers = await prisma.customer.count({
//       where: { storeId: store.id },
//     });

//     const response = {
//       totalSpent: Number(totalRevenueResult._sum.totalPrice || 0),
//       totalOrders: totalOrders,
//       totalCustomers: totalCustomers,
//     };

//     console.log('[API/totals] Response:', response);
//     return NextResponse.json(response);

//   } catch (error) {
//     console.error("[API/totals] Failed to fetch dashboard totals:", error);
//     const message = error instanceof Error ? error.message : 'An unexpected error occurred';
//     return NextResponse.json({ error: message }, { status: 500 });
//   } finally {
//     await prisma.$disconnect();
//   }
// }

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