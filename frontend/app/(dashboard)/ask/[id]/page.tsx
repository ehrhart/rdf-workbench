import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getConversation } from '@/lib/ai/conversation-store'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { AskChatPage } from '../ask-chat-page'

export const metadata: Metadata = {
  title: 'Ask',
  description: 'Ask questions about the dataset in natural language'
}

export default async function ConversationPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  if (!principal) notFound()
  const conversation = await getConversation(id, principal.id)
  if (!conversation) notFound()

  return <AskChatPage />
}
