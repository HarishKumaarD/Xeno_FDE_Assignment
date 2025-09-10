import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    let store = null as null | { id: string; shop: string; accessToken: string; userId: string };

    if (storeIdParam) {
      store = await prisma.store.findUnique({ where: { id: storeIdParam } }) as any;
      if (!store) {
        return NextResponse.json({ error: 'Store not found for provided storeId.' }, { status: 404 });
      }
      if (store.userId !== session.user.id) {
        return NextResponse.json({ error: 'You do not have access to this store.' }, { status: 403 });
      }
    } else {
      store = await prisma.store.findFirst({ where: { userId: session.user.id } }) as any;
      if (!store) {
        // Fallback for testing/dev: use the first available store
        store = await prisma.store.findFirst() as any;
      }
      if (!store) {
        return NextResponse.json({ error: 'No store connected and no stores found.' }, { status: 404 });
      }
    }

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
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}


