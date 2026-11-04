import { DashboardShell } from '@/components/dashboard/shell'
import { DashboardHeaderSkeleton } from '@/components/skeletons'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SparqlLoading() {
  return (
    <DashboardShell>
      <DashboardHeaderSkeleton />
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-64 w-full" />

            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
