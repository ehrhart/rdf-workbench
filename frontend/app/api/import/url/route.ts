import { type NextRequest, NextResponse } from 'next/server'
import { requirePrincipal } from '@/lib/api-auth'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return sameOriginError()

  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  const apiBaseUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL

  try {
    const body = await request.json()

    const response = await fetch(`${apiBaseUrl}/api/import/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Adapter-Token': getVirtuosoConfig().VIRTUOSO_ADAPTER_TOKEN
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error || 'Failed to import from URL' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json(
      { error: err.message || 'An unknown error occurred' },
      { status: 500 }
    )
  }
}
