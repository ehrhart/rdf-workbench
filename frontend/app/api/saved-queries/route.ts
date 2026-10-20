import { NextResponse } from 'next/server'
import { getAccessFlags } from '@/lib/access/access-flags'
import { requirePrincipal, resolveOptionalViewer } from '@/lib/api-auth'
import { AuthError, ConnectionError, QueryError } from '@/lib/errors'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { Principal } from '@/lib/runtime/contracts'
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

async function listSavedQueries(
  principal: Principal | null
): Promise<NextResponse> {
  try {
    const runtime = await getWorkbenchRuntime()
    const viewerId = principal ? principal.id : null
    const items = await runtime.savedQueries.list(viewerId)
    const seesOwners = principal?.role === 'admin'
    const visibleItems = seesOwners
      ? items
      : items.map((item) =>
          item.ownerId === viewerId ? item : { ...item, ownerUsername: '' }
        )
    return NextResponse.json({ items: visibleItems })
  } catch (error) {
    return errorResponse(error, Boolean(principal))
  }
}

export async function GET() {
  const { allowAnonymousRead } = await getAccessFlags()
  if (!allowAnonymousRead) {
    const auth = await requirePrincipal()
    if (auth.response) return auth.response
    return listSavedQueries(auth.principal)
  }

  const viewer = await resolveOptionalViewer()
  if (viewer.response) return viewer.response
  return listSavedQueries(null)
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
