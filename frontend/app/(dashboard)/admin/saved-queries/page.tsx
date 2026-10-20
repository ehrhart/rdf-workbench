import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SavedQueryManager } from '@/components/admin/saved-query-manager'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { getWorkbenchRuntime, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Saved queries',
  description: 'Manage the queries everyone can reuse.'
}

export default async function SavedQueriesAdminPage() {
  const runtime = await getWorkbenchRuntime()
  if (!runtime.features.has('saved-queries')) notFound()

  await requirePageAccess('admin', '/admin/saved-queries')

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Saved queries"
        text="The queries everyone can reuse."
      />
      <SavedQueryManager />
    </DashboardShell>
  )
}
