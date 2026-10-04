import { NextResponse } from 'next/server'
import { anonymousReadEnabled } from '@/config/access'
import { requirePrincipal } from '@/lib/api-auth'
import { getClasses } from '@/lib/triplestore'

export async function GET() {
  if (!anonymousReadEnabled()) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
  }

  try {
    const classes = await getClasses()
    return NextResponse.json(classes)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch classes' },
      { status: 500 }
    )
  }
}
