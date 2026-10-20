import { type NextRequest, NextResponse } from 'next/server'
import { requirePrincipal } from '@/lib/api-auth'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'

/**
 * NOTE: File uploads now use chunked upload via /api/import/complete
 * This route only handles GET (list jobs) and DELETE (delete file)
 */

export async function GET(req: NextRequest) {
  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  const apiBaseUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL

  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')

    let url = `${apiBaseUrl}/api/import/jobs`
    if (jobId) {
      url = `${apiBaseUrl}/api/import/status/${encodeURIComponent(jobId)}`
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        'X-Adapter-Token': getVirtuosoConfig().VIRTUOSO_ADAPTER_TOKEN
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || "Couldn't load import jobs." },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json(
      { error: err.message || "Couldn't load import jobs." },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginMutation(req)) return sameOriginError()

  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  const apiBaseUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL

  try {
    const { searchParams } = new URL(req.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required.' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${apiBaseUrl}/api/import/file/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'X-Adapter-Token': getVirtuosoConfig().VIRTUOSO_ADAPTER_TOKEN
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || "Couldn't delete the file." },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json(
      { error: err.message || "Couldn't delete the file." },
      { status: 500 }
    )
  }
}
