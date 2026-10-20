import type { Metadata } from 'next'
import { AskChatPage } from './ask-chat-page'

export const metadata: Metadata = {
  title: 'Ask',
  description: 'Ask questions about this dataset in plain language.'
}

export default function AskPage() {
  return <AskChatPage />
}
