import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import pLimit from 'p-limit';

/**
 * Helper: Paginated fetch from Shopify API
 */
async function fetchAllFromShopify(url: string, accessToken: string) {
  let results: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    const key = Object.keys(data)[0]; // "customers" or "orders"
    results = results.concat(data[key]);

    // Parse Shopify "Link" header for pagination
    const linkHeader = res.headers.get("link");
    const match = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = match ? match[1] : null;
  }

  return results;
}

/**
 * Helper: Upsert with batching + concurrency limit
 */
async function batchUpsert<T>(
  items: T[],
  upsertFn: (item: T) => Promise<any>,
  batchSize = 100,
  concurrency = 10
) {
  const limit = pLimit(concurrency);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => limit(() => upsertFn(item))));
  }
}

async function syncHistoricalData(store: { id: string; shop: string; accessToken: string }) {
  console.log(`[SYNC] Starting historical data sync for ${store.shop}...`);

  try {
    /** ---------------- Customers ---------------- */
    const customersApiUrl = `https://${store.shop}/admin/api/2024-07/customers.json?limit=250`;
    const customers = await fetchAllFromShopify(customersApiUrl, store.accessToken);
    console.log(`[SYNC] Fetched ${customers.length} customers from Shopify.`);

    await batchUpsert(customers, (customerData) =>
      prisma.customer.upsert({
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
      })
    );

    console.log(`[SYNC] Successfully upserted ${customers.length} customers.`);

    /** ---------------- Orders ---------------- */
    const ordersApiUrl = `https://${store.shop}/admin/api/2024-07/orders.json?status=any&limit=250`;
    const orders = await fetchAllFromShopify(ordersApiUrl, store.accessToken);
    console.log(`[SYNC] Fetched ${orders.length} orders from Shopify.`);

    await batchUpsert(orders, async (orderData) => {
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

      return prisma.order.upsert({
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
          customerId: customer?.id ?? null,
        },
      });
    });

    console.log(`[SYNC] Successfully upserted ${orders.length} orders.`);
  } catch (error) {
    console.error(`[SYNC] Error during historical sync for ${store.shop}:`, error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
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
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      if (store.userId !== user.id) {
        return NextResponse.json({ error: 'You do not have access to this store.' }, { status: 403 });
      }
    } else {
      store = await prisma.store.findFirst({ where: { userId: user.id } });
      if (!store) {
        return NextResponse.json({ error: 'No store connected.' }, { status: 404 });
      }
    }

    console.log(`[SYNC] Found store: ${store.shop} for user ${user.id}`);

    const wait = searchParams.get('wait') === 'true';

    if (wait) {
      await syncHistoricalData(store);
      return NextResponse.json({ ok: true, message: 'Sync completed' }, { status: 200 });
    }

    // Run in background
    syncHistoricalData(store).catch((e) => console.error('Background sync failed:', e));
    return NextResponse.json({ ok: true, message: 'Sync started' }, { status: 202 });
  } catch (error) {
    console.error('[API/sync] Failed to start sync:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
