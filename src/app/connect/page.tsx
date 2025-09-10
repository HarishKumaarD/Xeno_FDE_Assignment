// src/app/connect/page.tsx
'use client';
import { useState } from 'react';

export default function ConnectPage() {
  const [shop, setShop] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    if (!shop) {
      alert('Please enter your shop domain');
      return;
    }

    // Ensure the shop domain is formatted correctly
    let shopDomain = shop.trim();
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain += '.myshopify.com';
    }

    setIsConnecting(true);
    
    // Redirect to our OAuth route
    window.location.href = `/api/auth/shopify?shop=${shopDomain}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Connect Your Shopify Store
        </h1>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="shop" className="block text-sm font-medium text-gray-700 mb-2">
              Shop Domain
            </label>
            <div className="relative">
              <input
                type="text"
                id="shop"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                placeholder="your-store"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isConnecting}
              />
              <span className="absolute right-3 top-2 text-gray-500 text-sm">
                .myshopify.com
              </span>
            </div>
          </div>
          
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Connect Store'}
          </button>
        </div>
        
        <div className="mt-6 text-sm text-gray-600">
          <p className="text-center">
            Enter your Shopify store domain to connect and start analyzing your data.
          </p>
        </div>
      </div>
    </div>
  );
}