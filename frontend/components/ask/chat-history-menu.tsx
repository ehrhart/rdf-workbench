'use client'

import { startOfDay, subDays } from 'date-fns'
import { ChevronDownIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useChatSession } from '@/components/ask/chat-session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import type { ConversationDto } from '@/lib/ai/ask-contract'
import { cn } from '@/lib/utils'

interface Bucket {
  label: string
  items: ConversationDto[]
}

function groupByRecency(conversations: ConversationDto[]): Bucket[] {
  const now = new Date()
  const boundaries: Array<{ label: string; from: number }> = [
    { label: 'Today', from: startOfDay(now).getTime() },
    { label: 'Yesterday', from: startOfDay(subDays(now, 1)).getTime() },
    { label: 'Previous 7 days', from: startOfDay(subDays(now, 7)).getTime() },
    { label: 'Previous 30 days', from: startOfDay(subDays(now, 30)).getTime() }
  ]
  const buckets: Bucket[] = [
    ...boundaries.map(({ label }) => ({
      label,
      items: [] as ConversationDto[]
    })),
    { label: 'Older', items: [] }
  ]
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  for (const conversation of sorted) {
    const time = new Date(conversation.updatedAt).getTime()
    const index = boundaries.findIndex((boundary) => time >= boundary.from)
    buckets[index === -1 ? buckets.length - 1 : index].items.push(conversation)
  }
  return buckets.filter((bucket) => bucket.items.length > 0)
}

function relativeAge(updatedAt: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000)
  )
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

function ConversationRow({
  conversation,
  active,
  renaming,
  draft,
  onDraftChange,
  onStartRename,
  onCommitRename,
  onOpen,
  onDelete
}: {
  conversation: ConversationDto
  active: boolean
  renaming: boolean
  draft: string
  onDraftChange: (next: string) => void
  onStartRename: () => void
  onCommitRename: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const label = conversation.title || 'Untitled chat'

  if (renaming) {
    return (
      <div className="flex items-center rounded-md pr-1">
        <Input
          autoFocus
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onCommitRename()
            }
          }}
          aria-label="Conversation name"
          className="h-7 min-w-0 flex-1 text-sm"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-0.5 rounded-md',
        active ? 'bg-accent' : 'hover:bg-muted/60'
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(conversation.id)}
        title={label}
        className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm"
      >
        {label}
      </button>
      {active ? (
        <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Current
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">
          {relativeAge(conversation.updatedAt)}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Rename ${label}`}
          onClick={onStartRename}
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Delete ${label}`}
          onClick={() => {
            if (window.confirm('Delete this conversation?')) {
              onDelete(conversation.id)
            }
          }}
        >
          <TrashIcon />
        </Button>
      </div>
    </div>
  )
}

export function ChatHistoryMenu() {
  const {
    conversations,
    conversationsLoading,
    conversationId,
    title,
    messages,
    newChat,
    openConversation,
    renameConversation,
    deleteConversation,
    pendingScrollRef
  } = useChatSession()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Rename state is kept here instead of per row, so the popover's Escape
  // handler can revert the rename instead of closing the whole popover.
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [listOverflows, setListOverflows] = useState(false)

  const query = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      query
        ? conversations.filter((conversation) =>
            conversation.title.toLowerCase().includes(query)
          )
        : conversations,
    [conversations, query]
  )
  const buckets = useMemo(() => groupByRecency(filtered), [filtered])

  // The fade is only useful when the list actually scrolls. The observer is
  // attached from the scroller's ref callback — which runs after its
  // children's refs — because Radix mounts the portal content after this
  // component's layout effects, when refs are still null. Watching both the
  // content and the scroller covers row mounts, font swaps, search
  // filtering, and window resizes.
  const attachList = useCallback((list: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!list) return
    const content = contentRef.current
    if (!content) return
    const measure = () =>
      setListOverflows(list.scrollHeight > list.clientHeight + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    observer.observe(list)
    observerRef.current = observer
    measure()
  }, [])

  const headerLabel =
    title ||
    (conversationId || messages.length > 0 ? 'Untitled chat' : 'New chat')

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSearch('')
      setRenamingId(null)
      setRenameDraft('')
    }
  }

  const commitRename = () => {
    if (!renamingId) return
    const conversation = conversations.find((item) => item.id === renamingId)
    setRenamingId(null)
    const next = renameDraft.trim()
    if (!conversation || !next || next === conversation.title) return
    void renameConversation(conversation.id, next)
  }

  const openFromMenu = (id: string) => {
    pendingScrollRef.current = true
    void openConversation(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Switch chat"
          className="h-8 max-w-[min(20rem,50vw)] gap-1.5 rounded-md px-2.5"
        >
          <span className="min-w-0 truncate text-sm font-medium">
            {headerLabel}
          </span>
          <ChevronDownIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={8}
        className="w-[22rem] overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
        onEscapeKeyDown={(event) => {
          if (renamingId) {
            event.preventDefault()
            setRenamingId(null)
            setRenameDraft('')
          }
        }}
      >
        <div className="flex max-h-[min(30rem,70vh)] flex-col">
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chat history"
            aria-label="Search chat history"
            className="h-10 shrink-0 rounded-none border-0 border-b text-sm"
          />
          <button
            type="button"
            onClick={() => {
              newChat()
              setOpen(false)
            }}
            className="flex h-9 shrink-0 items-center gap-2 px-2.5 text-sm hover:bg-accent"
          >
            <PlusIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            New chat
          </button>
          <div
            ref={attachList}
            className={cn(
              'min-h-0 flex-1 overflow-y-auto',
              listOverflows &&
                '[-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%_-_20px),transparent)] [mask-image:linear-gradient(to_bottom,black_calc(100%_-_20px),transparent)]'
            )}
          >
            <div ref={contentRef}>
              {conversationsLoading && conversations.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  Loading…
                </p>
              ) : buckets.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {query
                    ? 'No matching conversations.'
                    : 'No conversations yet.'}
                </p>
              ) : (
                buckets.map((bucket, index) => (
                  <section key={bucket.label}>
                    <h3
                      className={cn(
                        'px-2 pb-1 pt-3 text-xs font-medium text-muted-foreground',
                        index === 0 && 'pt-1'
                      )}
                    >
                      {bucket.label}
                    </h3>
                    <div className="space-y-0.5 pb-1">
                      {bucket.items.map((conversation) => (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          active={conversation.id === conversationId}
                          renaming={conversation.id === renamingId}
                          draft={renameDraft}
                          onDraftChange={setRenameDraft}
                          onStartRename={() => {
                            setRenameDraft(conversation.title)
                            setRenamingId(conversation.id)
                          }}
                          onCommitRename={commitRename}
                          onOpen={openFromMenu}
                          onDelete={(id) => {
                            void deleteConversation(id)
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
