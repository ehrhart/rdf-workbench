import { NextResponse } from 'next/server'
import { getAccessFlags } from '@/lib/access/access-flags'
import { requirePrincipal } from '@/lib/api-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'

export async function GET() {
  const { allowAnonymousRead } = await getAccessFlags()
  if (!allowAnonymousRead) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
  }

  try {
    const prefixes = await (await getWorkbenchRuntime()).prefixes.list()
    return NextResponse.json(prefixes)
  } catch (error) {
    console.error('Error fetching prefixes:', error)
    return NextResponse.json(
      { error: "Couldn't load prefixes." },
      { status: 500 }
    )
  }
}
