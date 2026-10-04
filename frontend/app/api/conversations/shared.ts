import { NextResponse } from 'next/server'
import { QueryError } from '@/lib/errors'

export const notFound = () =>
  NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

/** QueryError answers 400; anything else logs and answers a 500. */
export function errorResponse(scope: string, error: unknown): NextResponse {
  if (error instanceof QueryError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  console.error(`Unexpected ${scope} API error:`, error)
  return NextResponse.json(
    { error: `Unexpected server error while handling ${scope}` },
    { status: 500 }
  )
}
