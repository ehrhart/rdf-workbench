import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DereferenceManager } from '@/components/admin/dereference-manager'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { reservedPathsFor } from '@/lib/dereference/rules'
import { getWorkbenchRuntime, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Dereferencing',
  description: 'Choose which resource paths open in the workbench.'
}

export default async function DereferenceAdminPage() {
  const runtime = await getWorkbenchRuntime()
  if (!runtime.features.has('dereference')) notFound()

  await requirePageAccess('admin', '/admin/dereference')

  const [paths, reservedPaths] = await Promise.all([
    runtime.dereference.list(),
    Promise.resolve(reservedPathsFor(runtime.provider))
  ])

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dereferencing"
        text="Choose which resource paths open in the workbench."
      />
      <DereferenceManager paths={paths} reservedPaths={reservedPaths} />
    </DashboardShell>
  )
}
