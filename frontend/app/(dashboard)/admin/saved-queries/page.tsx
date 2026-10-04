import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SavedQueryManager } from '@/components/admin/saved-query-manager'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { getWorkbenchRuntime, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Saved Queries',
  description: 'Manage shared saved SPARQL queries.'
}

export default async function SavedQueriesAdminPage() {
  const runtime = await getWorkbenchRuntime()
  if (!runtime.features.has('saved-queries')) notFound()

  await requirePageAccess('admin', '/admin/saved-queries')

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Saved Queries"
        text="Create, edit, reorder, and delete the shared saved queries used across the workbench."
      />
      <SavedQueryManager />
    </DashboardShell>
  )
}
