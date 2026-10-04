'use client'

import { SquarePenIcon } from 'lucide-react'
import { ChatHistoryMenu } from '@/components/ask/chat-history-menu'
import { useChatSession } from '@/components/ask/chat-session'
import { HeaderPortal } from '@/components/ask/header-portal'
import { Button } from '@/components/ui/button'

export function ChatHeader() {
  const { user, newChat } = useChatSession()

  return (
    <HeaderPortal>
      {user ? (
        <ChatHistoryMenu />
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={newChat}
          className="h-8 gap-1.5 rounded-md px-2.5"
        >
          <SquarePenIcon className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">New chat</span>
        </Button>
      )}
    </HeaderPortal>
  )
}
