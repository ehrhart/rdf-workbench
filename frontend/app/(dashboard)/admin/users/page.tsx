import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { UserManager } from '@/components/admin/user-manager'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { listLocalUsers } from '@/lib/local-auth'
import { getWorkbenchRuntime } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'User Administration',
  description: 'Manage RDF Workbench user accounts.'
}

export default async function UsersPage() {
  const runtime = await getWorkbenchRuntime()
  if (!runtime.features.has('qlever-user-admin')) {
    notFound()
  }

  const administrator = await runtime.auth.getPrincipal()
  if (!administrator) redirect('/logout?redirect=/admin/users')
  if (administrator.role !== 'admin') notFound()
  const users = await listLocalUsers()

  return (
    <DashboardShell>
      <DashboardHeader
        heading="User Administration"
        text="Manage local RDF Workbench accounts and access."
      />
      <UserManager users={users} currentUserId={administrator.id} />
    </DashboardShell>
  )
}
