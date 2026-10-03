import { NextResponse } from 'next/server'
import { anonymousReadEnabled } from '@/config/access'
import { requirePrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'

export async function GET() {
  if (!anonymousReadEnabled()) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
  }

  try {
    const prefixes = await (await getWorkbenchRuntime()).prefixes.list()
    return NextResponse.json(prefixes)
  } catch (error) {
    console.error('Error fetching prefixes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prefixes' },
      { status: 500 }
    )
  }
}
