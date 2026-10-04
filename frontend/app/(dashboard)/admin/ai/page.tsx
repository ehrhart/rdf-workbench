import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AiSettingsForm } from '@/components/admin/ai-settings'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { getAiSettings } from '@/lib/ai/ai-settings'
import { hasAnyFeature, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'AI Settings',
  description: 'Configure the Ask assistant.'
}

export default async function AiSettingsPage() {
  if (!(await hasAnyFeature(['ai-ask']))) notFound()

  await requirePageAccess('admin', '/admin/ai')
  const settings = await getAiSettings()

  return (
    <DashboardShell>
      <DashboardHeader heading="AI Settings" />
      <AiSettingsForm initial={settings} />
    </DashboardShell>
  )
}
