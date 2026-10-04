import type { Metadata } from 'next'
import { AskChatPage } from './ask-chat-page'

export const metadata: Metadata = {
  title: 'Ask',
  description: 'Ask questions about the dataset in natural language'
}

export default function AskPage() {
  return <AskChatPage />
}
