import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { userId, email, name, image } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { email, name, image },
      create: { id: userId, email, name, image },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error('User Upsert Error:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
