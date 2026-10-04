import { NextResponse } from 'next/server'
import {
  createConversation,
  listConversations
} from '@/lib/ai/conversation-store'
import { requirePrincipal } from '@/lib/api-auth'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { errorResponse } from './shared'

export async function GET() {
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const conversations = await listConversations(principal.id)
    return NextResponse.json({ conversations })
  } catch (error) {
    return errorResponse('conversations', error)
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return sameOriginError()
  const auth = await requirePrincipal()
  if (auth.response) return auth.response
  const principal = auth.principal

  try {
    const payload = (await request.json().catch(() => null)) as {
      id?: unknown
      title?: unknown
    } | null
    const title = typeof payload?.title === 'string' ? payload.title : undefined
    const requestedId = typeof payload?.id === 'string' ? payload.id : undefined
    const conversation = await createConversation(principal.id, title, {
      id: requestedId
    })
    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    return errorResponse('conversations', error)
  }
}
