import { type NextRequest, NextResponse } from 'next/server'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

/**
 * NOTE: File uploads now use chunked upload via /api/import/complete
 * This route only handles GET (list jobs) and DELETE (delete file)
 */

export async function GET(req: NextRequest) {
  const apiBaseUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')

    let url = `${apiBaseUrl}/api/import/jobs`
    if (jobId) {
      url = `${apiBaseUrl}/api/import/status/${jobId}`
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch import jobs' },
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

export async function DELETE(req: NextRequest) {
  if (!isSameOriginMutation(req)) return sameOriginError()
  const apiBaseUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${apiBaseUrl}/api/import/file/${encodeURIComponent(filename)}`,
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
        { error: errorData.error || 'Failed to delete file' },
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
