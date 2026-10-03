import { NextResponse } from 'next/server'
import {
  createConversation,
  listConversations
} from '@/lib/ai/conversation-store'
import { requirePrincipal } from '@/lib/api-auth'
import { QueryError } from '@/lib/errors'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

const errorResponse = (error: unknown) => {
  if (error instanceof QueryError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  console.error('Unexpected conversations API error:', error)
  return NextResponse.json(
    { error: 'Unexpected server error while handling conversations' },
    { status: 500 }
  )
}

export async function GET() {
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const conversations = await listConversations(principal.id)
    return NextResponse.json({ conversations })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const payload = (await request.json().catch(() => null)) as {
      title?: unknown
    } | null
    const title = typeof payload?.title === 'string' ? payload.title : undefined
    const conversation = await createConversation(principal.id, title)
    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
