import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { serializeResults } from '@/lib/sparql/serialize'
import type { SparqlQueryResult } from '@/types'

interface DownloadPayload {
  query?: string
  format?: string
  filename?: string
  results?: SparqlQueryResult | null
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as DownloadPayload
    const query = payload.query?.trim()
    const format = payload.format?.trim()

    if (!format) {
      return NextResponse.json({ error: 'Format is required' }, { status: 400 })
    }

    const filename = sanitizeFilename(payload.filename)

    if (payload.results) {
      const serialized = serializeResults(payload.results, format)
      if (serialized) {
        const headers = new Headers()
        headers.set('Content-Type', serialized.contentType)
        if (filename) {
          headers.set(
            'Content-Disposition',
            `attachment; filename="${filename}"`
          )
        }
        return new Response(serialized.body, { status: 200, headers })
      }
    }

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const runtime = await getWorkbenchRuntime()

    const upstream = await runtime.sparql.download(query, format)

    const upstreamContentType = upstream.headers.get('content-type')
    const upstreamDisposition = upstream.headers.get('content-disposition')

    if (!upstream.ok) {
      const errorBody = await upstream.text()
      return new Response(errorBody || 'Download failed', {
        status: upstream.status,
        headers: {
          'Content-Type': upstreamContentType || 'text/plain'
        }
      })
    }

    const headers = new Headers()
    headers.set(
      'Content-Type',
      upstreamContentType ?? format ?? 'application/octet-stream'
    )

    const upstreamFilename =
      filename || sanitizeFilename(extractFilename(upstreamDisposition))
    if (upstreamFilename) {
      headers.set(
        'Content-Disposition',
        `attachment; filename="${upstreamFilename}"`
      )
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Download failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function sanitizeFilename(filename: string | null | undefined): string | null {
  if (!filename) return null
  const value = filename
    .replace(/[\r\n"\\/]/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 160)
  return value || null
}

function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition)
  return match ? match[1] : null
}
