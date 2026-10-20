import type { Metadata } from 'next'
import { AccessFlagList } from '@/components/admin/access-flag-list'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { getAccessFlagDetails } from '@/lib/access/access-flags'
import { requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Access',
  description: 'Control what logged-out visitors can open and use.'
}

export default async function AccessPage() {
  await requirePageAccess('admin', '/admin/access')
  const details = await getAccessFlagDetails()

  return (
    <DashboardShell>
      <DashboardHeader heading="Access" />
      <AccessFlagList details={details} />
    </DashboardShell>
  )
}
