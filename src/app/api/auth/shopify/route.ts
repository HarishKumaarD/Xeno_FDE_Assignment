import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  // First, ensure the user is logged into our app before allowing them to connect a store.
  const { userId } = getAuth(request);
  if (!userId) {
    // If the user isn't logged in, redirect them to the login page.
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');

  if (!shop) {
    return NextResponse.json({ error: 'Shop domain is a required parameter.' }, { status: 400 });
  }

  // These are the permissions our app needs to read store data.
  const scopes = process.env.SCOPES || 'read_products,read_customers,read_orders';
  
  // This is the URL that Shopify will redirect the user back to after they approve.
  // It MUST match the URL in your Shopify Partner App settings.
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/auth/callback/shopify`;
  
  // Construct the final authorization URL.
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}`;

  // Redirect the user to the Shopify authorization page.
  return NextResponse.redirect(authUrl);
}

