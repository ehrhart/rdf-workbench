import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { QueryConsoleSkeleton } from '@/components/skeletons'

export default function IsqlLoading() {
  return (
    <DashboardShell>
      <DashboardHeader heading="ISQL Console" />
      <QueryConsoleSkeleton />
    </DashboardShell>
  )
}
