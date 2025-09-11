// src/app/api/webhooks/orders-create/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// This function remains the same, it securely verifies the webhook
async function verifyWebhook(request: Request) {
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  if (!hmac) {
    return { valid: false, message: 'No HMAC header present.' };
  }

  const body = await request.text();
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    return { valid: false, message: 'Shopify API secret is not configured.' };
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  const valid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
  
  return { valid, body: JSON.parse(body) };
}


export async function POST(request: Request) {
  const { valid, message, body } = await verifyWebhook(request);

  // Allow internal calls (no HMAC) for testing/sync purposes
  const isInternalCall = !request.headers.get('x-shopify-hmac-sha256');
  
  if (!valid && !isInternalCall) {
    console.error(`Webhook verification failed: ${message}`);
    return new NextResponse(JSON.stringify({ error: `Webhook verification failed: ${message}` }), { status: 401 });
  }

  const shop = request.headers.get('x-shopify-shop-domain');
  if (!shop) {
    return new NextResponse(JSON.stringify({ error: 'No shop header present.' }), { status: 400 });
  }

  const orderData = isInternalCall ? await request.json() : body;

  try {
    const store = await prisma.store.findUnique({
      where: { shop: shop },
    });

    if (!store) {
      console.warn(`Webhook received for an unknown store: ${shop}`);
      return new NextResponse(JSON.stringify({ error: 'Store not found' }), { status: 404 });
    }

    let internalCustomerId: string | undefined = undefined;

    // Step 1: Create or update the customer record first
    if (orderData.customer) {
      const customer = await prisma.customer.upsert({
        where: { 
          shopifyId_storeId: {
            shopifyId: orderData.customer.id.toString(),
            storeId: store.id,
          }
        },
        update: {
          email: orderData.customer.email,
          firstName: orderData.customer.first_name,
          lastName: orderData.customer.last_name,
        },
        create: {
          shopifyId: orderData.customer.id.toString(),
          email: orderData.customer.email,
          firstName: orderData.customer.first_name,
          lastName: orderData.customer.last_name,
          storeId: store.id,
        },
      });
      internalCustomerId = customer.id; // Get our internal DB id for the customer
    }

    // Step 2: Create or update the order, linking it to the customer
    await prisma.order.upsert({
      where: { 
        shopifyId_storeId: {
          shopifyId: orderData.id.toString(),
          storeId: store.id,
        }
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
        customerId: internalCustomerId, // Use the internal customer ID
      },
    });

    return new NextResponse('Webhook processed successfully.', { status: 200 });

  } catch (error) {
    console.error('Error processing webhook:', error);
    if (error instanceof Error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new NextResponse('An internal server error occurred.', { status: 500 });
  }
}
