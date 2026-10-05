'use client'

import { LinkIcon, LoaderIcon, ShareIcon, UnlinkIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useChatSession } from '@/components/ask/chat-session'
import { HeaderPortal } from '@/components/ask/header-portal'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ShareInfo {
  id: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export function ChatShareButton() {
  const { user, conversationId, messages } = useChatSession()
  const [share, setShare] = useState<ShareInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [open, setOpen] = useState(false)

  const loadShare = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/share`)
      if (response.status === 404) {
        setShare(null)
        return
      }
      if (!response.ok) throw new Error('Failed to load share status')
      const payload = (await response.json()) as { share?: ShareInfo | null }
      setShare(payload.share ?? null)
    } catch {
      toast.error('Failed to load share status')
    } finally {
      setLoaded(true)
    }
  }, [conversationId])

  // The button reflects share state without opening the popover (the
  // staleness dot), so the status loads for the conversation up front and
  // reloads on conversation switches.
  useEffect(() => {
    if (!user || !conversationId) return
    setShare(null)
    setLoaded(false)
    void loadShare()
  }, [conversationId, loadShare, user])

  if (!user || !conversationId) return null

  const stale = share !== null && messages.length > share.messageCount
  const busy = creating || updating || stopping

  const copyShareLink = async (info: ShareInfo) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${info.id}`
      )
      toast.success('Link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const createShare = async () => {
    setCreating(true)
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/share`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        }
      )
      if (!response.ok) throw new Error('Failed to create share link')
      const payload = (await response.json()) as { share: ShareInfo }
      setShare(payload.share)
      await copyShareLink(payload.share)
    } catch {
      toast.error('Failed to create share link')
    } finally {
      setCreating(false)
    }
  }

  const updateShare = async () => {
    setUpdating(true)
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/share`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        }
      )
      if (!response.ok) throw new Error('Failed to update share')
      const payload = (await response.json()) as { share: ShareInfo }
      setShare(payload.share)
    } catch {
      toast.error('Failed to update share')
    } finally {
      setUpdating(false)
    }
  }

  const stopSharing = async () => {
    setStopping(true)
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/share`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Failed to stop sharing')
      setShare(null)
    } catch {
      toast.error('Failed to stop sharing')
    } finally {
      setStopping(false)
    }
  }

  return (
    <HeaderPortal side="right">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="relative h-8 gap-1.5 rounded-md px-2.5"
          >
            <ShareIcon className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Share</span>
            {stale && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-busy={updating || undefined}
          className={cn(
            updating && 'pointer-events-none select-none opacity-60'
          )}
        >
          <PopoverHeader>
            <PopoverTitle>Share chat</PopoverTitle>
            <PopoverDescription>
              {share === null || !stale ? (
                'Only messages up until now will be shared'
              ) : (
                <>
                  There are new messages since last share.{' '}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => void updateShare()}
                      >
                        Update
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Share the most recent content
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </PopoverDescription>
          </PopoverHeader>
          <p className="text-xs text-muted-foreground">
            Don't share personal information or third-party content without
            permission
          </p>
          <div className="flex items-center justify-end gap-2">
            {share && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void stopSharing()}
                disabled={busy}
              >
                {stopping ? (
                  <LoaderIcon className="animate-spin" />
                ) : (
                  <UnlinkIcon />
                )}
                Stop sharing
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (share) void copyShareLink(share)
                else void createShare()
              }}
              disabled={!loaded || busy}
            >
              {creating ? (
                <LoaderIcon className="animate-spin" />
              ) : (
                <LinkIcon />
              )}
              Copy link
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </HeaderPortal>
  )
}
