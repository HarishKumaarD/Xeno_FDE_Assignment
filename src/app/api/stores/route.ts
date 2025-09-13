import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Return only the first store from the database (no auth filtering)
export async function GET(_request: NextRequest) {
  try {
    // Get only the first store from the database
    const firstStore = await prisma.store.findFirst({ 
      select: { id: true, shop: true }
    });
    
    // Return as an array to maintain compatibility with existing frontend code
    const stores = firstStore ? [firstStore] : [];
    
    return NextResponse.json({ stores });
  } catch (error) {
    console.error('[API/stores] Failed:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}