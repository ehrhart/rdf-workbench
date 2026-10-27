import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const runtime = await getWorkbenchRuntime()
    const base = getRuntimeConfig().RESOURCE_BASE_URI.replace(/\/$/, '')
    const { path } = await params
    const resourcePath = path.join('/')

    if (/[<>]/.test(resourcePath)) {
      return jsonError("This path can't be used to describe a resource.", 400)
    }

    const entity = path[0]
    const configured = await runtime.dereference.list().catch(() => [])
    if (!configured.some((entry) => entry.path === entity)) {
      return new Response('Not Found', { status: 404 })
    }

    const accept =
      request.nextUrl.searchParams.get('format')?.trim() ||
      request.headers.get('accept') ||
      'text/turtle'
    const upstream = await runtime.sparql.download(
      `DESCRIBE <${base}/${resourcePath}>`,
      accept,
      { signal: request.signal }
    )
    const contentType = upstream.headers.get('content-type') ?? accept

    if (!upstream.ok || !upstream.body) {
      return new Response(
        (await upstream.text()) || "Couldn't describe the resource.",
        {
          status: upstream.status,
          headers: { 'Content-Type': contentType, Vary: 'Accept' }
        }
      )
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType, Vary: 'Accept' }
    })
  } catch (error) {
    console.error('Error describing resource:', error)
    return jsonError("Couldn't describe the resource.", 502)
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
