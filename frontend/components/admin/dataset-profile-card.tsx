'use client'

import { format } from 'date-fns'
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
  AiJobDto,
  ProfileResponseDto,
  ProfileSummaryDto
} from '@/lib/ai/ask-contract'
import { useAiJobs, useJobCompletion } from '@/lib/client/ai-jobs'

interface DatasetProfileCardProps {
  initialSummary: ProfileSummaryDto | null
  initialProfileJob: AiJobDto | null
}

export function DatasetProfileCard({
  initialSummary,
  initialProfileJob
}: DatasetProfileCardProps) {
  const [summary, setSummary] = useState<ProfileSummaryDto | null>(
    initialSummary
  )
  const { job, running, elapsedSeconds, start, cancel } = useAiJobs(
    'profile',
    initialProfileJob
  )

  useJobCompletion(job, async (finished) => {
    if (finished.status === 'succeeded') {
      try {
        const response = await fetch('/api/ask/profile')
        const payload = (await response
          .json()
          .catch(() => null)) as ProfileResponseDto | null
        if (payload?.profile) {
          setSummary(payload.profile)
          toast.success('Dataset profile rebuilt')
        }
      } catch {
        toast.error('Profile rebuilt, but the summary could not be refreshed')
      }
    } else if (finished.status === 'failed') {
      toast.error(finished.error ?? 'Profile rebuild failed')
    } else if (finished.status === 'cancelled') {
      toast.info('Profile rebuild cancelled')
    }
  })

  async function rebuild() {
    const result = await start()
    if (!result.ok) {
      toast.error(result.error ?? 'Profile rebuild failed')
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
        {running ? (
          <p className="text-muted-foreground text-sm">
            Building in the background ({elapsedSeconds}s elapsed). You can
            leave this page.
          </p>
        ) : summary ? (
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
          {running ? (
            <Button type="button" variant="outline" onClick={() => cancel()}>
              Cancel build
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={rebuild}>
              {summary ? 'Rebuild profile' : 'Build profile'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
