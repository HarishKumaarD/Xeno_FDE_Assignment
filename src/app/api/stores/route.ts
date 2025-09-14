import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // 1. Get the authenticated user's ID from Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    // 2. Fetch ONLY the stores that belong to the authenticated user
    const stores = await prisma.store.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        shop: true,
      },
    });

    return NextResponse.json({ stores });

  } catch (error) {
    console.error('[API/stores] Failed:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

