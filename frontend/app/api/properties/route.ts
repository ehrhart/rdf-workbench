import { NextResponse } from 'next/server'
import { anonymousReadEnabled } from '@/config/access'
import { requirePrincipal } from '@/lib/api-auth'
import { getProperties } from '@/lib/triplestore'

export async function GET() {
  if (!anonymousReadEnabled()) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
  }

  try {
    const properties = await getProperties()
    return NextResponse.json(properties)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}
