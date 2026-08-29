import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DereferenceManager } from '@/components/admin/dereference-manager'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { reservedPathsFor } from '@/lib/dereference/rules'
import { getWorkbenchRuntime } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Dereferencing',
  description: 'Manage dereferenceable resource paths.'
}

export default async function DereferenceAdminPage() {
  const runtime = await getWorkbenchRuntime()
  if (!runtime.features.has('dereference')) notFound()

  const administrator = await runtime.auth.getPrincipal()
  if (!administrator) redirect('/logout?redirect=/admin/dereference')
  if (administrator.role !== 'admin') notFound()

  const [paths, reservedPaths] = await Promise.all([
    runtime.dereference.list(),
    Promise.resolve(reservedPathsFor(runtime.provider))
  ])

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dereferencing"
        text="Configure which resource paths are dereferenceable. Each path maps /path/<id> to the matching resource on the data endpoint."
      />
      <DereferenceManager paths={paths} reservedPaths={reservedPaths} />
    </DashboardShell>
  )
}
