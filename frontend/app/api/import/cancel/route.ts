import { type NextRequest, NextResponse } from 'next/server'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ jobId?: string }> }
): Promise<NextResponse> {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const params = await props.params
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    // Get jobId from URL path or body
    let jobId: string | undefined = params.jobId

    if (!jobId) {
      const body = await request.json().catch(() => ({}))
      jobId = body.jobId
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Forward the request to the Virtuoso adapter
    const response = await fetch(
      `${getVirtuosoConfig().VIRTUOSO_ADAPTER_URL}/api/import/cancel/${jobId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Failed to cancel job' }))
      return NextResponse.json(
        { error: errorData.error || 'Failed to cancel job' },
        { status: response.status }
      )
    }

    const data = await response
      .json()
      .catch(() => ({ message: 'Job cancelled successfully' }))
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error in cancel API route:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    )
  }
}
