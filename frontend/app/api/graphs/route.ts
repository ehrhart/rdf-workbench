import { type NextRequest, NextResponse } from 'next/server'
import { hasFeature } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

/**
 * Deletes a graph asynchronously via the Virtuoso adapter.
 */
export async function DELETE(req: NextRequest) {
  if (!isSameOriginMutation(req)) return sameOriginError()
  if (!(await hasFeature('virtuoso-graph-mutations'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const runtimeConfig = getRuntimeConfig()
  if (runtimeConfig.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const graphUri = searchParams.get('uri')

    if (!graphUri) {
      return NextResponse.json(
        { error: 'Graph URI is required' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${runtimeConfig.VIRTUOSO_ADAPTER_URL}/api/graphs/${encodeURIComponent(graphUri)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.token}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || 'Failed to delete graph' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json(
      { error: err.message || 'An unknown error occurred' },
      { status: 500 }
    )
  }
}
