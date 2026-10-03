import { NextResponse } from 'next/server'
import {
  deleteConversation,
  getConversation,
  getMessages,
  renameConversation
} from '@/lib/ai/conversation-store'
import { requirePrincipal } from '@/lib/api-auth'
import { QueryError } from '@/lib/errors'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'

const notFound = () =>
  NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

const errorResponse = (error: unknown) => {
  if (error instanceof QueryError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  console.error('Unexpected conversation API error:', error)
  return NextResponse.json(
    { error: 'Unexpected server error while handling the conversation' },
    { status: 500 }
  )
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
    const conversation = await getConversation(id, principal.id)
    if (!conversation) return notFound()
    const messages = await getMessages(id, principal.id)
    return NextResponse.json({ conversation, messages })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const payload = (await request.json().catch(() => null)) as {
      title?: unknown
    } | null
    const title = typeof payload?.title === 'string' ? payload.title : ''

    const { id } = await params
    const conversation = await renameConversation(id, principal.id, title)
    if (!conversation) return notFound()
    return NextResponse.json({ conversation })
  } catch (error) {
    return errorResponse(error)
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
    const deleted = await deleteConversation(id, principal.id)
    if (!deleted) return notFound()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
