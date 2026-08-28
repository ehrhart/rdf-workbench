import { type NextRequest, NextResponse } from 'next/server'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const apiBaseUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const response = await fetch(`${apiBaseUrl}/api/import/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
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
