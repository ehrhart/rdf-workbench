import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AiSettingsForm } from '@/components/admin/ai-settings'
import { DatasetProfileCard } from '@/components/admin/dataset-profile-card'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { getAiSettings } from '@/lib/ai/ai-settings'
import { getProfileSummary } from '@/lib/ai/profile-store'
import { hasAnyFeature, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'AI Settings',
  description: 'Configure the Ask assistant.'
}

export default async function AiSettingsPage() {
  if (!(await hasAnyFeature(['ai-ask']))) notFound()

  await requirePageAccess('admin', '/admin/ai')
  const [settings, summary] = await Promise.all([
    getAiSettings(),
    getProfileSummary().catch(() => null)
  ])

  return (
    <DashboardShell>
      <DashboardHeader heading="AI Settings" />
      <DatasetProfileCard initialSummary={summary} />
      <AiSettingsForm initial={settings} />
    </DashboardShell>
  )
}
