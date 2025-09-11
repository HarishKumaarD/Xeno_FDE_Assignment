import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { currentUser } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const user = await currentUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Resolve store for this user. If multiple stores, pick the first for now.
    const store = await prisma.store.findFirst({ where: { userId: user.id } })
    if (!store) {
      return NextResponse.json({ error: 'No connected store found' }, { status: 404 })
    }

    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { totalPrice: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalPrice: true,
        currency: true,
        processedAt: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    })

    const mapped = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: Number(o.totalPrice),
      currency: o.currency,
      date: o.processedAt ? o.processedAt.toISOString() : null,
      customerName: [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || 'Guest',
      customerEmail: o.customer?.email || undefined,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('[INSIGHTS/top-orders] Error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}


