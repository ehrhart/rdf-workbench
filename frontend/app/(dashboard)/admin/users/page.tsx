import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { UserManager } from '@/components/admin/user-manager'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { listLocalUsers } from '@/lib/local-auth'
import {
  getWorkbenchRuntime,
  hasAnyFeature,
  requirePageAccess
} from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Users',
  description: 'Create accounts and reset passwords.'
}

export default async function UsersPage() {
  const runtime = await getWorkbenchRuntime()
  if (!(await hasAnyFeature(['user-admin']))) {
    notFound()
  }

  await requirePageAccess('admin', '/admin/users')
  const principal = await runtime.auth.getPrincipal()
  if (!principal) notFound()
  const users = await listLocalUsers()

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Users"
        text="Create accounts and reset passwords."
      />
      <UserManager users={users} currentUserId={principal.id} />
    </DashboardShell>
  )
}
