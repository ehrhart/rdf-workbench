import { type NextRequest, NextResponse } from 'next/server'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { filename, graphIri } = body

    if (!filename || !graphIri) {
      return NextResponse.json(
        { error: 'Filename and graphIri are required' },
        { status: 400 }
      )
    }

    // Forward the request to the Virtuoso adapter
    const response = await fetch(
      `${getVirtuosoConfig().VIRTUOSO_ADAPTER_URL}/api/import/bulk-load`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ filename, graphIri })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || 'Failed to start bulk load process' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in bulk-load API route:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    )
  }
}
