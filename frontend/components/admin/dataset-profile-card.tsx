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
        toast.error(
          "Couldn't refresh the summary. The rebuilt profile is saved."
        )
      }
    } else if (finished.status === 'failed') {
      toast.error(finished.error ?? "Couldn't rebuild the profile.")
    } else if (finished.status === 'cancelled') {
      toast.info('Rebuild cancelled')
    }
  })

  async function rebuild() {
    const result = await start()
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't rebuild the profile.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset profile</CardTitle>
        <CardDescription>
          The classes, properties, and prefixes Ask uses when answering.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {running ? (
          <p className="text-muted-foreground text-sm">
            Building the profile in the background ({elapsedSeconds}s). You can
            leave this page.
          </p>
        ) : summary ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Built </span>
            {format(new Date(summary.builtAt), 'PPp')}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            No profile yet. It builds automatically the first time Ask runs.
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
