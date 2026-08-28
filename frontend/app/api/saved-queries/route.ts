import { NextResponse } from 'next/server'
import { AuthError, ConnectionError, QueryError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

const errorResponse = (error: unknown, hasSession: boolean) => {
  if (error instanceof ConnectionError) {
    return NextResponse.json(
      { error: 'Saved queries service is temporarily unavailable' },
      { status: 503 }
    )
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: hasSession ? 403 : 401 }
    )
  }

  if (error instanceof QueryError) {
    const status = /not found/i.test(error.message) ? 404 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  console.error('Unexpected saved queries API error:', error)
  return NextResponse.json(
    { error: 'Unexpected server error while handling saved queries' },
    { status: 500 }
  )
}

export async function GET() {
  try {
    const runtime = await getWorkbenchRuntime()
    const session = await runtime.auth.getPrincipal()
    const items = await runtime.savedQueries.list(session?.id ?? null)
    return NextResponse.json({ items })
  } catch (error) {
    return errorResponse(error, false)
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const runtime = await getWorkbenchRuntime()
  const session = await runtime.auth.getPrincipal()

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required to save queries' },
      { status: 401 }
    )
  }

  try {
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.toString?.() ?? ''
    const query = payload?.query?.toString?.() ?? ''

    const saved = await runtime.savedQueries.create({ name, query }, session)

    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    return errorResponse(error, true)
  }
}
