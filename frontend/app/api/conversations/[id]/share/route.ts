import { NextResponse } from 'next/server'
import {
  deleteShare,
  getShareForConversation,
  upsertShare
} from '@/lib/ai/conversation-share-store'
import { MAX_CONVERSATION_MESSAGES } from '@/lib/ai/conversation-store'
import { requirePrincipal } from '@/lib/api-auth'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { errorResponse, notFound } from '../../shared'

function sharePayload(share: {
  id: string
  messageCount: number
  createdAt: string
  updatedAt: string
}) {
  return {
    share: {
      id: share.id,
      messageCount: share.messageCount,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt
    }
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const { id } = await params
    const share = await getShareForConversation(id, principal.id)
    if (!share) return notFound()
    return NextResponse.json(sharePayload(share))
  } catch (error) {
    return errorResponse('conversation share', error)
  }
}

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
    const share = await upsertShare(id, principal.id, messages)
    if (!share) return notFound()
    return NextResponse.json(sharePayload(share))
  } catch (error) {
    return errorResponse('conversation share', error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const { id } = await params
    const deleted = await deleteShare(id, principal.id)
    if (!deleted) return notFound()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse('conversation share', error)
  }
}
