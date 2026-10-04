'use client'

import { DatabaseIcon } from 'lucide-react'
import { useState } from 'react'
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
}

export function DatasetChip({ summary }: DatasetChipProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [full, setFull] = useState<ProfileResponseDto | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)

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
