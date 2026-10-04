'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { usePathname } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { toast } from 'sonner'
import type { ConversationDto } from '@/lib/ai/ask-contract'
import type { User } from '@/types'

type ChatPart = UIMessage['parts'][number]

export function isTextPart(
  part: ChatPart
): part is Extract<ChatPart, { type: 'text' }> {
  return part.type === 'text'
}

export function messageText(message: UIMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join('\n')
}

type UseChatReturn = ReturnType<typeof useChat>
type SendMessageArgs = Parameters<UseChatReturn['sendMessage']>

export interface ChatSessionContextValue {
  conversations: ConversationDto[]
  conversationsLoading: boolean
  refreshConversations: () => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  messages: UseChatReturn['messages']
  status: UseChatReturn['status']
  error: UseChatReturn['error']
  streaming: boolean
  sendMessage: (...args: SendMessageArgs) => void
  stop: UseChatReturn['stop']
  regenerate: UseChatReturn['regenerate']
  setMessages: UseChatReturn['setMessages']
  conversationId: string | null
  title: string
  commitTitle: (next: string) => Promise<void>
  newChat: () => void
  openConversation: (id: string) => Promise<void>
  /**
   * Message components set this before switching conversations so the
   * message pane scrolls to the bottom of the new conversation.
   */
  pendingScrollRef: RefObject<boolean>
  user: User | null
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null)

export function ChatSessionProvider({
  children,
  user
}: {
  children: ReactNode
  user: User | null
}) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const persistingRef = useRef(false)
  const pendingScrollRef = useRef(false)
  const conversationIdRef = useRef<string | null>(null)
  const suppressCreateRef = useRef(false)
  // Row creation starts in the background when a message is sent; persistence
  // waits for it so the message write does not 404 on a row that does not
  // exist yet.
  const ensureRowRef = useRef<Promise<void> | null>(null)
  const pathname = usePathname()

  // The abort and finish callbacks read this copy of conversationId because
  // they can run after the state has already changed.
  const applyConversationId = useCallback((id: string | null) => {
    conversationIdRef.current = id
    setConversationId(id)
  }, [])

  const refreshConversations = useCallback(async () => {
    setConversationsLoading(true)
    try {
      const response = await fetch('/api/conversations')
      if (response.status === 401) {
        return
      }
      if (!response.ok) throw new Error('Failed to load conversations')
      const payload = (await response.json()) as {
        conversations: ConversationDto[]
      }
      setConversations(payload.conversations ?? [])
    } catch {
      toast.error('Failed to load conversations')
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void refreshConversations()
  }, [refreshConversations, user])

  const persistConversation = async (finishedMessages: UIMessage[]) => {
    if (!user) return
    if (persistingRef.current) return
    persistingRef.current = true
    try {
      let id = conversationIdRef.current
      if (!id && suppressCreateRef.current) {
        suppressCreateRef.current = false
        return
      }
      if (!id) {
        const firstUser = finishedMessages.find(
          (message) => message.role === 'user'
        )
        const firstText = firstUser
          ? messageText(firstUser).trim().slice(0, 60)
          : ''
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: firstText || 'New chat' })
        })
        if (response.status === 401) {
          return
        }
        if (!response.ok) return
        const payload = (await response.json()) as {
          conversation: ConversationDto
        }
        id = payload.conversation.id
        applyConversationId(id)
        setTitle(payload.conversation.title)
        window.history.replaceState(null, '', `/ask/${id}`)
      } else {
        const pending = ensureRowRef.current
        if (pending) {
          try {
            await pending
          } catch {
            // Creation failed; the retry below recreates the row.
          }
        }
      }
      const putMessages = () =>
        fetch(`/api/conversations/${id}/messages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: finishedMessages })
        })
      let saved = await putMessages()
      if (saved.status === 404) {
        // The background creation did not finish; recreate the row with the
        // same client-generated id so the URL and the data match.
        const firstUser = finishedMessages.find(
          (message) => message.role === 'user'
        )
        const firstText = firstUser
          ? messageText(firstUser).trim().slice(0, 60)
          : ''
        const created = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, title: firstText || 'New chat' })
        })
        if (created.ok) {
          saved = await putMessages()
        }
      }
      if (saved.status === 401) {
        return
      }
      void refreshConversations()
    } catch (error) {
      console.error(
        '[ask] conversation persistence failed:',
        error instanceof Error ? error.message : error
      )
    } finally {
      persistingRef.current = false
    }
  }

  const {
    messages,
    sendMessage,
    regenerate,
    setMessages,
    status,
    stop,
    error
  } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ask' }),
    onFinish: ({ messages: finishedMessages }) => {
      persistConversation(finishedMessages)
    }
  })

  const streaming = status === 'streaming' || status === 'submitted'

  // When a stream is aborted, the SDK writes its final state only after
  // stop() returns, which puts the partial aborted message back. Clearing
  // again in a setTimeout removes it, so resetting during streaming does not
  // bring the old conversation back.
  const clearSession = useCallback(() => {
    stop()
    suppressCreateRef.current = true
    applyConversationId(null)
    setTitle('')
    setMessages([])
    window.setTimeout(() => setMessages([]), 0)
  }, [applyConversationId, setMessages, stop])

  // This session generates its own id and starts row creation in the
  // background with it. If creation fails, persistence recreates the row with
  // the same id so the URL and the stored data match.
  const ensureConversationForSend = useCallback(
    (text: string) => {
      if (!user) return
      if (conversationIdRef.current) return
      const id = crypto.randomUUID()
      const title = text.slice(0, 60) || 'New chat'
      applyConversationId(id)
      setTitle(title)
      window.history.replaceState(null, '', `/ask/${id}`)
      const creation = (async () => {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, title })
        })
        if (!response.ok) return
        // Persist the user's message immediately so an aborted first exchange
        // still leaves the conversation with content instead of an empty row.
        await fetch(`/api/conversations/${id}/messages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                id: `local-${Date.now()}`,
                role: 'user',
                parts: [{ type: 'text', text }]
              }
            ]
          })
        })
        void refreshConversations()
      })()
      ensureRowRef.current = creation
    },
    [applyConversationId, refreshConversations, user]
  )

  const send = useCallback(
    (...args: SendMessageArgs) => {
      const first = args[0]
      const text = first && 'text' in first ? (first.text ?? '') : ''
      if (text.trim()) {
        ensureConversationForSend(text.trim())
      }
      sendMessage(...args)
    },
    [ensureConversationForSend, sendMessage]
  )

  const commitTitle = useCallback(
    async (next: string) => {
      if (!next || next === title) return
      const previous = title
      setTitle(next)
      if (!conversationId) return
      try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: next })
        })
        if (response.status === 401) return
        if (!response.ok) throw new Error('Failed to rename conversation')
        void refreshConversations()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to rename conversation'
        )
        setTitle(previous)
      }
    },
    [conversationId, refreshConversations, title]
  )

  const newChat = useCallback(() => {
    clearSession()
    // Push, not replace: back should return to the conversation you left.
    if (window.location.pathname !== '/ask') {
      window.history.pushState(null, '', '/ask')
    }
  }, [clearSession])

  const loadConversation = useCallback(
    async (id: string) => {
      // Switching conversations must not leave a stream writing into the
      // loaded one.
      stop()
      try {
        const response = await fetch(`/api/conversations/${id}`)
        if (response.status === 401) {
          return
        }
        if (!response.ok) throw new Error('Failed to load conversation')
        const payload = (await response.json()) as {
          conversation: ConversationDto
          messages: UIMessage[]
        }
        setMessages((payload.messages ?? []) as UIMessage[])
        applyConversationId(payload.conversation.id)
        setTitle(payload.conversation.title)
        pendingScrollRef.current = true
      } catch (loadError) {
        toast.error(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load conversation'
        )
      }
    },
    [applyConversationId, setMessages, stop]
  )

  const openConversation = useCallback(async (id: string) => {
    window.history.pushState(null, '', `/ask/${id}`)
  }, [])

  const renameConversation = useCallback(
    async (id: string, next: string) => {
      const current = conversations.find(
        (conversation) => conversation.id === id
      )
      if (!current || next === current.title) return
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: next })
        })
        if (response.status === 401) return
        if (!response.ok) throw new Error('Failed to rename conversation')
        if (id === conversationId) setTitle(next)
        void refreshConversations()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to rename conversation'
        )
      }
    },
    [conversationId, conversations, refreshConversations]
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: 'DELETE'
        })
        if (response.status === 401) {
          return
        }
        if (!response.ok) throw new Error('Failed to delete conversation')
        if (conversationId === id) {
          clearSession()
          window.history.replaceState(null, '', '/ask')
        }
        void refreshConversations()
        toast.success('Conversation deleted')
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to delete conversation'
        )
      }
    },
    [clearSession, conversationId, refreshConversations]
  )

  // This effect is the only place conversations get loaded: it covers direct
  // visits, browser back/forward, and switching from the menu (which only
  // calls pushState). Next.js updates usePathname during a transition, so
  // right after a programmatic history change pathname can be one commit
  // behind, while window.location is already correct when the effect runs.
  // Whatever changed the URL has updated its own state as well, so when the
  // two disagree we leave the current state alone.
  useEffect(() => {
    const routeId = pathname.match(/^\/ask\/([^/]+)$/)?.[1] ?? null
    const currentId =
      window.location.pathname.match(/^\/ask\/([^/]+)$/)?.[1] ?? null
    if (currentId !== routeId) return
    if (routeId && routeId !== conversationId) {
      pendingScrollRef.current = true
      void loadConversation(routeId)
      return
    }
    if (!routeId && conversationId) {
      clearSession()
    }
  }, [pathname, clearSession, conversationId, loadConversation])

  const value = useMemo<ChatSessionContextValue>(
    () => ({
      conversations,
      conversationsLoading,
      refreshConversations,
      renameConversation,
      deleteConversation,
      messages,
      status,
      error,
      streaming,
      sendMessage: send,
      stop,
      regenerate,
      setMessages,
      conversationId,
      title,
      commitTitle,
      newChat,
      openConversation,
      pendingScrollRef,
      user
    }),
    [
      conversations,
      conversationsLoading,
      refreshConversations,
      renameConversation,
      deleteConversation,
      messages,
      status,
      error,
      streaming,
      send,
      stop,
      regenerate,
      setMessages,
      conversationId,
      title,
      commitTitle,
      newChat,
      openConversation,
      user
    ]
  )

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  )
}

export function useChatSession() {
  const context = useContext(ChatSessionContext)
  if (!context) {
    throw new Error('useChatSession must be used within a ChatSessionProvider.')
  }
  return context
}

/**
 * Null outside the ask layouts (the dashboard sidebar renders without the
 * provider); lets shared UI react to the ask session when it is available.
 */
export function useChatSessionOptional(): ChatSessionContextValue | null {
  return useContext(ChatSessionContext)
}
