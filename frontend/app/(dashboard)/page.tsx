import { AlertCircle } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { RecentQueries } from '@/components/dashboard/recent-queries'
import { SavedQueriesCard } from '@/components/dashboard/saved-queries'
import { DashboardShell } from '@/components/dashboard/shell'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { ResourceSearch } from '@/components/resource-search'
import { StatsCardsSkeleton } from '@/components/skeletons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getWorkbenchRuntime } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Overview of the configured RDF store'
}

async function StatsSection() {
  const runtime = await getWorkbenchRuntime()
  const [overview, graphs] = await Promise.all([
    runtime.getEndpointOverview().catch(() => null),
    runtime.graphs.listNamedGraphs().catch(() => [])
  ])
  const stats = {
    totalTriples:
      typeof overview?.stats['num-triples-normal'] === 'number'
        ? overview.stats['num-triples-normal']
        : graphs.reduce((sum, graph) => sum + graph.tripleCount, 0),
    namedGraphs: graphs.length
  }
  const isUnavailable = stats.totalTriples === 0 && stats.namedGraphs === 0

  return (
    <>
      {isUnavailable && (
        <Alert
          variant="default"
          className="border-yellow-500/50 bg-yellow-500/5"
        >
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-sm text-muted-foreground">
            Unable to fetch real-time statistics from the configured endpoint.
          </AlertDescription>
        </Alert>
      )}
      <StatsCards stats={stats} provider={runtime.provider} />
    </>
  )
}

export default async function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="Dashboard" />
      <div className="grid gap-4 md:gap-8">
        <ResourceSearch />

        <Suspense fallback={<StatsCardsSkeleton />}>
          <StatsSection />
        </Suspense>

        <RecentQueries />

        <SavedQueriesCard />
      </div>
    </DashboardShell>
  )
}
