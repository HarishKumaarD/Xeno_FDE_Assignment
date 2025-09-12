import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Publicly list stores from the database (no auth filtering)

export async function GET(_request: NextRequest) {
  try {
    const stores = await prisma.store.findMany({ select: { id: true, shop: true }, take: 50 });
    return NextResponse.json({ stores });
  } catch (error) {
    console.error('[API/stores] Failed:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
  }
}
