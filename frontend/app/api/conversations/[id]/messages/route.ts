import { NextResponse } from 'next/server'
import {
  MAX_CONVERSATION_MESSAGES,
  replaceMessages
} from '@/lib/ai/conversation-store'
import { requirePrincipal } from '@/lib/api-auth'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { errorResponse, notFound } from '../../shared'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const payload = (await request.json().catch(() => null)) as {
      messages?: unknown
    } | null
    const { messages } = payload ?? {}
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages must be an array' },
        { status: 400 }
      )
    }
    if (messages.length > MAX_CONVERSATION_MESSAGES) {
      return NextResponse.json(
        {
          error: `messages must contain at most ${MAX_CONVERSATION_MESSAGES} items`
        },
        { status: 400 }
      )
    }

    const { id } = await params
    const messageCount = await replaceMessages(id, principal.id, messages)
    if (messageCount === null) return notFound()
    return NextResponse.json({ ok: true, messageCount })
  } catch (error) {
    return errorResponse('conversation messages', error)
  }
}
