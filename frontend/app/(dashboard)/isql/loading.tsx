import { DashboardShell } from '@/components/dashboard/shell'
import {
  DashboardHeaderSkeleton,
  QueryConsoleSkeleton
} from '@/components/skeletons'

export default function IsqlLoading() {
  return (
    <DashboardShell>
      <DashboardHeaderSkeleton />
      <QueryConsoleSkeleton />
    </DashboardShell>
  )
}
