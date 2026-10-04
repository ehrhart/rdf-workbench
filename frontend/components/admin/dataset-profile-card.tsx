'use client'

import { format } from 'date-fns'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import type {
  ProfileResponseDto,
  ProfileSummaryDto
} from '@/lib/ai/ask-contract'

interface DatasetProfileCardProps {
  initialSummary: ProfileSummaryDto | null
}

export function DatasetProfileCard({
  initialSummary
}: DatasetProfileCardProps) {
  const [summary, setSummary] = useState<ProfileSummaryDto | null>(
    initialSummary
  )
  const [rebuilding, setRebuilding] = useState(false)

  async function rebuild() {
    setRebuilding(true)
    try {
      const response = await fetch('/api/ask/profile', { method: 'POST' })
      const payload = (await response.json().catch(() => null)) as
        | (ProfileResponseDto & { error?: string })
        | null
      if (!response.ok || payload?.error) {
        toast.error(payload?.error ?? 'Profile rebuild failed')
        return
      }
      if (payload?.profile) {
        setSummary(payload.profile)
        toast.success('Dataset profile rebuilt')
      }
    } catch {
      toast.error('Profile rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset profile</CardTitle>
        <CardDescription>
          Snapshot of the dataset&apos;s classes, properties, and prefixes
          introspected from the SPARQL endpoint and injected into the system
          prompt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Built </span>
            {format(new Date(summary.builtAt), 'PPp')}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            No profile built yet. It is built automatically the first time Ask
            runs.
          </p>
        )}
        <div className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={rebuild}
            disabled={rebuilding}
          >
            {rebuilding && <Loader2Icon className="animate-spin" />}
            {summary ? 'Rebuild profile' : 'Build profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
