import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AiSettingsForm } from '@/components/admin/ai-settings'
import {
  type AiTuningDetail,
  AiTuningList
} from '@/components/admin/ai-tuning-list'
import { DatasetProfileCard } from '@/components/admin/dataset-profile-card'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { getAiSettings } from '@/lib/ai/ai-settings'
import { latestJobs } from '@/lib/ai/exploration-jobs'
import { getProfileSummary } from '@/lib/ai/profile-store'
import { hasAnyFeature, requirePageAccess } from '@/lib/runtime'
import { AI_TUNING_ENTRIES } from '@/lib/settings/registry'
import { getStoredResolutions } from '@/lib/settings/store'

export const metadata: Metadata = {
  title: 'AI settings',
  description: 'Configure the Ask assistant.'
}

export default async function AiSettingsPage() {
  if (!(await hasAnyFeature(['ai-ask']))) notFound()

  await requirePageAccess('admin', '/admin/ai')
  const [settings, summary, jobs, tuning] = await Promise.all([
    getAiSettings(),
    getProfileSummary().catch(() => null),
    latestJobs().catch(() => ({ explore: null, profile: null })),
    getStoredResolutions(AI_TUNING_ENTRIES)
  ])
  const details: AiTuningDetail[] = AI_TUNING_ENTRIES.map((entry) => {
    const resolution = tuning[entry.key]
    return {
      key: entry.key,
      label: entry.label,
      description: entry.description ?? null,
      envVar: entry.envVar,
      currentValue: resolution.resolution.value,
      source: resolution.resolution.source,
      storedValue: resolution.stored,
      env: resolution.env
    }
  })

  return (
    <DashboardShell>
      <DashboardHeader heading="AI settings" />
      <DatasetProfileCard
        initialSummary={summary}
        initialProfileJob={jobs.profile}
      />
      <AiSettingsForm initial={settings} initialExploreJob={jobs.explore} />
      <AiTuningList details={details} />
    </DashboardShell>
  )
}
