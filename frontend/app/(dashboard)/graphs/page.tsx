import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { GraphManager } from '@/components/graphs/graph-manager'
import { GraphListSkeleton } from '@/components/skeletons'
import { getWorkbenchRuntime } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Named Graphs',
  description: 'Browse named graphs in the configured RDF store'
}

// Async component for graph data
async function GraphsContent() {
  const runtime = await getWorkbenchRuntime()
  const [graphs, session] = await Promise.all([
    runtime.graphs.listNamedGraphs(),
    runtime.auth.getPrincipal()
  ])
  return (
    <GraphManager
      initialGraphs={graphs}
      canManage={
        runtime.features.has('virtuoso-graph-mutations') && Boolean(session)
      }
      portableExportFormats={
        runtime.provider === 'qlever'
          ? runtime.sparql.getDownloadFormats('construct')
          : []
      }
    />
  )
}

export default function GraphsPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="Named Graphs" />
      <Suspense fallback={<GraphListSkeleton />}>
        <GraphsContent />
      </Suspense>
    </DashboardShell>
  )
}
