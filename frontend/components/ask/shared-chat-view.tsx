'use client'

import type { UIMessage } from 'ai'
import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import {
  AssistantMessageView,
  UserMessageView
} from '@/components/ask/ask-console'
import { Button } from '@/components/ui/button'

export function SharedChatView({
  title,
  messages
}: {
  title: string
  messages: UIMessage[]
}) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
    useStickToBottom()

  const lastMessage = messages[messages.length - 1]

  const lastUserId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') return messages[index].id
    }
    return null
  }, [messages])

  useEffect(() => {
    void scrollToBottom({ animation: 'auto' })
  }, [scrollToBottom])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          ref={contentRef}
          className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6"
        >
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {messages.map((message) => {
            if (message.role === 'user') {
              return (
                <UserMessageView
                  key={message.id}
                  message={message}
                  isLast={message.id === lastUserId}
                  streaming={false}
                  onRegenerate={() => {}}
                  onEditSubmit={() => {}}
                  readOnly
                />
              )
            }
            return (
              <AssistantMessageView
                key={message.id}
                message={message}
                isLast={message.id === lastMessage?.id}
                lastUserText=""
                streaming={false}
                onRegenerate={() => {}}
                readOnly
              />
            )
          })}
        </div>
      </div>
      {!isAtBottom && (
        <Button
          variant="outline"
          size="sm"
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
          onClick={() => {
            void scrollToBottom()
          }}
        >
          <ChevronDownIcon /> Jump to latest
        </Button>
      )}
    </div>
  )
}
