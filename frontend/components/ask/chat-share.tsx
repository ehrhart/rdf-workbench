'use client'

import { LoaderIcon, ShareIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useChatSession } from '@/components/ask/chat-session'
import { HeaderPortal } from '@/components/ask/header-portal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle
} from '@/components/ui/dialog'
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

  if (!user || !conversationId) return null

  const stale = share !== null && messages.length > share.messageCount
  const busy = creating || updating || stopping

  const loadShare = async () => {
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
  }

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

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    setShare(null)
    setLoaded(false)
    setCreating(false)
    setUpdating(false)
    setStopping(false)
    void loadShare()
  }

  return (
    <HeaderPortal side="right">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleOpenChange(true)}
          >
            <ShareIcon />
            <span className="sr-only">Share chat</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share chat</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogTitle>Share chat</DialogTitle>
          <div
            aria-busy={updating || undefined}
            className={cn(
              'grid gap-4',
              updating && 'pointer-events-none select-none opacity-60'
            )}
          >
            <DialogDescription>
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
            </DialogDescription>
            <p className="text-xs text-muted-foreground">
              Don't share personal information or third-party content without
              permission
            </p>
            <DialogFooter>
              {share && (
                <Button
                  variant="destructive"
                  onClick={() => void stopSharing()}
                  disabled={busy}
                >
                  Stop sharing
                </Button>
              )}
              <Button
                onClick={() => {
                  if (share) void copyShareLink(share)
                  else void createShare()
                }}
                disabled={!loaded || busy}
              >
                {creating ? (
                  <LoaderIcon className="animate-spin" />
                ) : (
                  'Copy link'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </HeaderPortal>
  )
}
