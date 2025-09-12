import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


async function syncHistoricalData(store: { id: string; shop: string; accessToken: string; }) {
  console.log(`[SYNC] Starting historical data sync for ${store.shop}...`);
  try {
    const customersApiUrl = `https://${store.shop}/admin/api/2024-07/customers.json?limit=250`;
    const customersResponse = await fetch(customersApiUrl, {
      headers: { 'X-Shopify-Access-Token': store.accessToken },
    });

    if (customersResponse.ok) {
      const { customers } = await customersResponse.json();
      console.log(`[SYNC] Fetched ${customers.length} customers from Shopify.`);
      for (const customerData of customers) {
        try {
          await prisma.customer.upsert({
            where: {
              shopifyId_storeId: {
                shopifyId: customerData.id.toString(),
                storeId: store.id,
              },
            },
            update: {
              email: customerData.email,
              firstName: customerData.first_name,
              lastName: customerData.last_name,
            },
            create: {
              shopifyId: customerData.id.toString(),
              email: customerData.email,
              firstName: customerData.first_name,
              lastName: customerData.last_name,
              storeId: store.id,
            },
          });
        } catch (error) {
          console.error(`[SYNC] Error upserting customer ${customerData.id}:`, error);
        }
      }
      console.log(`[SYNC] Successfully upserted ${customers.length} customers.`);
    } else {
      console.error(`[SYNC] Failed to fetch customers: ${await customersResponse.text()}`);
    }

    const ordersApiUrl = `https://${store.shop}/admin/api/2024-07/orders.json?status=any&limit=250`;
    const ordersResponse = await fetch(ordersApiUrl, {
      headers: { 'X-Shopify-Access-Token': store.accessToken },
    });

    if (ordersResponse.ok) {
      const { orders } = await ordersResponse.json();
      console.log(`[SYNC] Fetched ${orders.length} orders from Shopify.`);
      for (const orderData of orders) {
        try {
          const customer = orderData.customer
            ? await prisma.customer.findUnique({
                where: {
                  shopifyId_storeId: {
                    shopifyId: orderData.customer.id.toString(),
                    storeId: store.id,
                  },
                },
              })
            : null;

          await prisma.order.upsert({
            where: {
              shopifyId_storeId: {
                shopifyId: orderData.id.toString(),
                storeId: store.id,
              },
            },
            update: {
              financialStatus: orderData.financial_status,
              fulfillmentStatus: orderData.fulfillment_status,
              totalPrice: parseFloat(orderData.total_price),
            },
            create: {
              shopifyId: orderData.id.toString(),
              orderNumber: orderData.name,
              totalPrice: parseFloat(orderData.total_price),
              currency: orderData.currency,
              financialStatus: orderData.financial_status,
              fulfillmentStatus: orderData.fulfillment_status,
              processedAt: orderData.processed_at ? new Date(orderData.processed_at) : null,
              storeId: store.id,
              customerId: customer?.id,
            },
          });
        } catch (error) {
          console.error(`[SYNC] Error upserting order ${orderData.id}:`, error);
        }
      }
      console.log(`[SYNC] Successfully upserted ${orders.length} orders.`);
    } else {
      console.error(`[SYNC] Failed to fetch orders: ${await ordersResponse.text()}`);
    }
  } catch (error) {
    console.error(`[SYNC] Error during historical sync for ${store.shop}:`, error);
  }
}

export async function POST(request: Request) {
  try {
    // Ensure database connectivity early with a short timeout for better UX
    const dbOk = await Promise.race([
      prisma.$connect().then(() => true).catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);

    if (!dbOk) {
      return NextResponse.json({
        error: 'Database is unreachable. Please check DATABASE_URL and network connectivity and try again.',
        hint: 'Verify your DB server is running and accessible from this environment.'
      }, { status: 503 });
    }

    const user = await currentUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[SYNC] User ${user.id} requesting sync`);

    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    let store = null as null | { id: string; shop: string; accessToken: string; userId: string };

    if (storeIdParam) {
      store = await prisma.store.findUnique({ where: { id: storeIdParam } });
      if (!store) {
        return NextResponse.json({ error: 'Store not found for provided storeId.' }, { status: 404 });
      }
      if (store.userId !== user.id) {
        return NextResponse.json({ error: 'You do not have access to this store.' }, { status: 403 });
      }
    } else {
      store = await prisma.store.findFirst({ where: { userId: user.id } });
      if (!store) {
        // Fallback for testing/dev: use the first available store
        store = await prisma.store.findFirst();
      }
      if (!store) {
        console.log(`[SYNC] No store found for user ${user.id}`);
        return NextResponse.json({ error: 'No store connected and no stores found.' }, { status: 404 });
      }
    }

    console.log(`[SYNC] Found store: ${store.shop} for user ${user.id}`);

    const wait = searchParams.get('wait') === 'true';

    if (wait) {
      await syncHistoricalData(store);
      return NextResponse.json({ ok: true, message: 'Sync completed' }, { status: 200 });
    }

    // Trigger sync and return immediately
    syncHistoricalData(store).catch((e) => console.error('Background sync failed:', e));
    return NextResponse.json({ ok: true, message: 'Sync started' }, { status: 202 });
  } catch (error) {
    console.error('[API/sync] Failed to start sync:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isDbDown =
      message.includes("Can't reach database server") ||
      message.includes('getaddrinfo ENOTFOUND') ||
      message.includes('connect ECONNREFUSED') ||
      message.includes('PrismaClientInitializationError');
    const status = isDbDown ? 503 : 500;
    return NextResponse.json({ error: isDbDown ? 'Database is unreachable. Please try again later.' : message }, { status });
  } finally {
  }
}


