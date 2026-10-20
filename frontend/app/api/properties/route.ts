import { NextResponse } from 'next/server'
import { getAccessFlags } from '@/lib/access/access-flags'
import { requirePrincipal } from '@/lib/api-auth'
import { getProperties } from '@/lib/triplestore'

export async function GET() {
  const { allowAnonymousRead } = await getAccessFlags()
  if (!allowAnonymousRead) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
  }

  try {
    const properties = await getProperties()
    return NextResponse.json(properties)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: "Couldn't load properties." },
      { status: 500 }
    )
  }
}
