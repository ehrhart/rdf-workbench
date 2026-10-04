'use client'

import { DatabaseIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useChatSession } from '@/components/ask/chat-session'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import type {
  ProfileResponseDto,
  ProfileSummaryDto
} from '@/lib/ai/ask-contract'

interface DatasetChipProps {
  summary: ProfileSummaryDto | null
  onRebuilt: (summary: ProfileSummaryDto) => void
}

export function DatasetChip({ summary, onRebuilt }: DatasetChipProps) {
  const { user } = useChatSession()
  const isAdmin = user?.role === 'admin'
  const [rebuilding, setRebuilding] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [full, setFull] = useState<ProfileResponseDto | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)

  const rebuild = async () => {
    setRebuilding(true)
    try {
      const response = await fetch('/api/ask/profile', { method: 'POST' })
      const payload = (await response.json()) as ProfileResponseDto & {
        error?: string
      }
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? 'Profile rebuild failed')
      }
      if (payload.profile) onRebuilt(payload.profile)
      setFull(null)
      toast.success('Dataset profile rebuilt')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Profile rebuild failed'
      )
    } finally {
      setRebuilding(false)
    }
  }

  const openSheet = (open: boolean) => {
    setSheetOpen(open)
    if (open && full === null && !loadingFull) {
      setLoadingFull(true)
      fetch('/api/ask/profile?full=1')
        .then((response) => response.json())
        .then((payload: ProfileResponseDto) => setFull(payload))
        .catch(() => {
          setFull({
            profile: null,
            text: '(failed to load profile text)',
            systemPrompt: '(failed to load system prompt)'
          })
        })
        .finally(() => setLoadingFull(false))
    }
  }

  if (!summary) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 rounded-md px-2 text-muted-foreground"
        onClick={() => openSheet(true)}
        title={`${summary.classCount} classes · ${summary.propertyCount} properties`}
      >
        <DatabaseIcon className="size-3.5" />
        <span className="hidden sm:inline">
          {summary.classCount} classes · {summary.propertyCount} properties
        </span>
      </Button>
      <Sheet open={sheetOpen} onOpenChange={openSheet}>
        <SheetContent className="w-full! gap-0 sm:max-w-xl!">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle>System prompt</SheetTitle>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={rebuild}
                  disabled={rebuilding}
                >
                  {rebuilding ? (
                    <LoaderIcon className="animate-spin" />
                  ) : (
                    <RefreshCwIcon />
                  )}
                  <span className="sr-only">Rebuild profile</span>
                </Button>
              )}
            </div>
          </SheetHeader>
          <pre className="mx-4 mb-4 min-h-0 min-w-0 flex-1 overflow-y-auto break-words rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {full ? (full.systemPrompt ?? '(none)') : 'Loading…'}
          </pre>
        </SheetContent>
      </Sheet>
    </>
  )
}
