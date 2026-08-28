import { NextResponse } from 'next/server'
import { getProperties } from '@/lib/triplestore'

export async function GET() {
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
