import { NextResponse } from 'next/server'
import {
  MAX_CONVERSATION_MESSAGES,
  replaceMessages
} from '@/lib/ai/conversation-store'
import { ANONYMOUS_OWNER_ID, requireConversationOwner } from '@/lib/api-auth'
import { isClientRateLimited } from '@/lib/rate-limit'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { errorResponse, notFound } from '../../shared'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const owner = await requireConversationOwner()
  if (owner.response) return owner.response
  const ownerId = owner.ownerId

  if (
    ownerId === ANONYMOUS_OWNER_ID &&
    isClientRateLimited(request, 'conversation-messages', 30, 60_000)
  ) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    )
  }

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
    const messageCount = await replaceMessages(id, ownerId, messages)
    if (messageCount === null) return notFound()
    return NextResponse.json({ ok: true, messageCount })
  } catch (error) {
    return errorResponse('conversation messages', error)
  }
}
