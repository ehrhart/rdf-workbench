import { NextResponse } from 'next/server'
import { AuthError, ConnectionError, QueryError } from '@/lib/errors'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { executeIsqlCommandDetailed } from '@/providers/virtuoso/odbc-connection'
import {
  deleteSession,
  getAuthTokenFromCookie
} from '@/providers/virtuoso/session'

interface IsqlRequestBody {
  query?: string
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  try {
    const token = await getAuthTokenFromCookie()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as IsqlRequestBody
    const query = typeof body.query === 'string' ? body.query : ''

    if (!query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const { results, statements, hasErrors, errorMessage } =
      await executeIsqlCommandDetailed<Record<string, unknown>>(query, {
        authToken: token,
        onAuthError: async () => {
          await deleteSession()
        }
      })

    return NextResponse.json(
      { results, statements, hasErrors, errorMessage },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      await deleteSession()
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof ConnectionError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    if (error instanceof QueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Unexpected ISQL API error:', error)
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
