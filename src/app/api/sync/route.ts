import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// --- Type Definitions ---
type Store = { id: string; shop: string; accessToken: string };
type ShopifyCustomer = { id: string | number; email?: string; first_name?: string; last_name?: string };
type ShopifyOrder = { id: string | number; name?: string; total_price?: string; currency?: string; financial_status?: string; fulfillment_status?: string; processed_at?: string; customer?: { id: string | number } };

// --- Advanced Retry Logic (From your version) ---
async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3, baseDelayMs = 200) {
  let attempt = 0;
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
      console.warn(`[SYNC] DB call for ${label} failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// --- Shopify Fetch Functions (with smaller, more reliable limit) ---
async function fetchCustomers(store: Store): Promise<ShopifyCustomer[]> {
  const customersApiUrl = `https://${store.shop}/admin/api/2024-07/customers.json?limit=100`;
  const response = await fetch(customersApiUrl, { headers: { 'X-Shopify-Access-Token': store.accessToken } });
  if (!response.ok) throw new Error(`Failed to fetch customers from Shopify: ${await response.text()}`);
  const { customers } = await response.json();
  return customers || [];
}

async function fetchOrders(store: Store): Promise<ShopifyOrder[]> {
  const ordersApiUrl = `https://${store.shop}/admin/api/2024-07/orders.json?status=any&limit=100`;
  const response = await fetch(ordersApiUrl, { headers: { 'X-Shopify-Access-Token': store.accessToken } });
  if (!response.ok) throw new Error(`Failed to fetch orders from Shopify: ${await response.text()}`);
  const { orders } = await response.json();
  return orders || [];
}

// --- Main Sync Logic ---
async function syncHistoricalData(store: Store) {
  console.log(`[SYNC] Starting historical data sync for ${store.shop}...`);
  try {
    const [customers, orders] = await Promise.all([fetchCustomers(store), fetchOrders(store)]);
    console.log(`[SYNC] Fetched ${customers.length} customers, ${orders.length} orders.`);

    if (customers.length > 0) {
      const customerData = customers.map((c) => ({
        shopifyId: String(c.id),
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        storeId: store.id,
      }));
      await prisma.customer.createMany({ data: customerData, skipDuplicates: true });
    }

    const existingCustomers = await prisma.customer.findMany({ where: { storeId: store.id }, select: { id: true, shopifyId: true } });
    const customerIdMap = new Map(existingCustomers.map(c => [c.shopifyId, c.id]));

    if (orders.length > 0) {
      const orderData = orders.map((o) => ({
        shopifyId: String(o.id),
        orderNumber: o.name,
        totalPrice: String(o.total_price || '0'),
        currency: o.currency || 'USD',
        financialStatus: o.financial_status,
        fulfillmentStatus: o.fulfillment_status,
        processedAt: o.processed_at ? new Date(o.processed_at) : undefined,
        storeId: store.id,
        customerId: o.customer ? customerIdMap.get(String(o.customer.id)) : undefined,
      }));
      await prisma.order.createMany({ data: orderData, skipDuplicates: true });
    }
    console.log(`[SYNC] Sync completed for ${store.shop}`);
  } catch (error) {
    console.error(`[SYNC] Error during historical sync for ${store.shop}:`, error);
    throw error;
  }
}

// --- Final, Secure API Route Handler ---
export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is a required parameter' }, { status: 400 });
    }

    // SECURITY CHECK: Verify the user owns the store before syncing, using your retry logic
    const store = await withRetry(
      () => prisma.store.findFirst({
        where: { id: storeId, userId: userId },
      }),
      'store.findFirst'
    );

    if (!store) {
      return NextResponse.json({ error: 'Store not found or access denied' }, { status: 404 });
    }

    // Trigger sync in the background and return immediately
    syncHistoricalData(store).catch(e => console.error('Background sync failed:', e));

    return NextResponse.json({ ok: true, message: 'Sync started' }, { status: 202 });
  } catch (error) {
    console.error('[API/sync] Failed to start sync:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

