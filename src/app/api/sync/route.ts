import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


type Store = { id: string; shop: string; accessToken: string };

type ShopifyCustomer = {
  id: number | string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type ShopifyOrder = {
  id: number | string;
  name?: string | null;
  total_price?: string | number | null;
  currency?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  processed_at?: string | null;
  customer?: { id: number | string } | null;
};

async function fetchCustomers(store: Store) {
  const customersApiUrl = `https://${store.shop}/admin/api/2024-07/customers.json?limit=100`;
  const response = await fetch(customersApiUrl, {
    headers: { 'X-Shopify-Access-Token': store.accessToken },
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch customers: ${text}`);
  }
  const { customers } = (await response.json()) as { customers: ShopifyCustomer[] };
  return customers ?? [];
}

async function fetchOrders(store: Store) {
  const ordersApiUrl = `https://${store.shop}/admin/api/2024-07/orders.json?status=any&limit=250`;
  const response = await fetch(ordersApiUrl, {
    headers: { 'X-Shopify-Access-Token': store.accessToken },
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch orders: ${text}`);
  }
  const { orders } = (await response.json()) as { orders: ShopifyOrder[] };
  return orders ?? [];
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3, baseDelayMs = 200) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const message = err instanceof Error ? err.message : String(err);
      const isPoolTimeout = message.includes('connection pool') || message.includes('P2024') || message.includes('Timed out fetching a new connection');
      if (attempt > retries || !isPoolTimeout) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[SYNC] ${label} failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function syncHistoricalData(store: Store) {
  console.log(`[SYNC] Starting historical data sync for ${store.shop}...`);
  try {
    // Fetch both datasets concurrently
    const [customers, orders] = await Promise.all([
      fetchCustomers(store),
      fetchOrders(store),
    ]);

    console.log(`[SYNC] Fetched ${customers.length} customers, ${orders.length} orders from Shopify.`);

    // Batch insert customers (skip duplicates)
    if (customers.length > 0) {
      const customerRows = customers.map((c) => ({
        shopifyId: String(c.id),
        email: c.email ?? undefined,
        firstName: c.first_name ?? undefined,
        lastName: c.last_name ?? undefined,
        storeId: store.id,
      }));
      // createMany max batch size varies per DB; chunk to be safe
      const chunkSize = 1000;
      for (let i = 0; i < customerRows.length; i += chunkSize) {
        const chunk = customerRows.slice(i, i + chunkSize);
        await prisma.customer.createMany({ data: chunk, skipDuplicates: true });
      }
      console.log(`[SYNC] Inserted/Skipped ${customerRows.length} customers.`);
    }

    // Build customer map for linking orders
    const existingCustomers = await prisma.customer.findMany({
      where: { storeId: store.id },
      select: { id: true, shopifyId: true },
    });
    const shopifyIdToCustomerId = new Map<string, string>();
    for (const c of existingCustomers) shopifyIdToCustomerId.set(c.shopifyId, c.id);

    // Batch insert orders (skip duplicates)
    if (orders.length > 0) {
      const orderRows = orders.map((o) => {
        const rawTotal = typeof o.total_price === 'string' ? o.total_price : (o.total_price != null ? String(o.total_price) : '0');
        // Ensure string format for Decimal columns
        const totalPrice = rawTotal;
        return {
          shopifyId: String(o.id),
          orderNumber: o.name ?? undefined,
          totalPrice, // string is accepted for Decimal
          currency: o.currency ?? undefined, // omit to use default when undefined
          financialStatus: o.financial_status ?? undefined,
          fulfillmentStatus: o.fulfillment_status ?? undefined,
          processedAt: o.processed_at ? new Date(o.processed_at) : undefined,
          storeId: store.id,
          customerId: o.customer ? shopifyIdToCustomerId.get(String(o.customer.id)) ?? undefined : undefined,
        };
      });
      const chunkSize = 1000;
      for (let i = 0; i < orderRows.length; i += chunkSize) {
        const chunk = orderRows.slice(i, i + chunkSize);
        await prisma.order.createMany({ data: chunk, skipDuplicates: true });
      }
      console.log(`[SYNC] Inserted/Skipped ${orderRows.length} orders.`);
    }

    console.log(`[SYNC] Sync completed for ${store.shop}`);
  } catch (error) {
    console.error(`[SYNC] Error during historical sync for ${store.shop}:`, error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    console.log(`[SYNC] Sync request received`);

    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    let store = null as null | { id: string; shop: string; accessToken: string; userId: string };

    if (storeIdParam) {
      store = await withRetry(
        () => prisma.store.findUnique({ where: { id: storeIdParam } }),
        'store.findUnique'
      );
      if (!store) {
        return NextResponse.json({ error: 'Store not found for provided storeId.' }, { status: 404 });
      }
    } else {
      // Use the first available store from database if none provided
      store = await withRetry(
        () => prisma.store.findFirst(),
        'store.findFirst(any)'
      );
      if (!store) {
        console.log(`[SYNC] No stores found in database`);
        return NextResponse.json({ error: 'No store connected and no stores found.' }, { status: 404 });
      }
    }

    console.log(`[SYNC] Found store: ${store.shop}`);

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


