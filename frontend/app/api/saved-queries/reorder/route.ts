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

  console.error('Unexpected saved query reorder API error:', error)
  return NextResponse.json(
    { error: 'Unexpected server error while reordering saved queries' },
    { status: 500 }
  )
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const runtime = await getWorkbenchRuntime()
  const session = await runtime.auth.getPrincipal()

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required to reorder saved queries' },
      { status: 401 }
    )
  }

  if (session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can reorder saved queries' },
      { status: 403 }
    )
  }

  try {
    const payload = await request.json().catch(() => null)
    const raw = Array.isArray(payload?.order) ? payload.order : []

    const order = raw
      .filter(
        (item: unknown): item is { id: string; position: number } =>
          Boolean(item) &&
          typeof (item as { id?: unknown }).id === 'string' &&
          typeof (item as { position?: unknown }).position === 'number'
      )
      .map((item: { id: string; position: number }) => ({
        id: item.id,
        position: Math.trunc(item.position)
      }))

    if (order.length === 0) {
      return NextResponse.json(
        { error: 'A non-empty order is required' },
        { status: 400 }
      )
    }

    await runtime.savedQueries.reorder(order, session)

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, true)
  }
}
