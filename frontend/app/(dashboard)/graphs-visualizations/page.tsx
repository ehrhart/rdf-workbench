import type { Metadata } from 'next'
import GraphVisualization from '@/components/dashboard/graph-visualization'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { ResourceAutocomplete } from '@/components/resource-autocomplete'

export const metadata: Metadata = {
  title: 'Graphs Visualizations',
  description: 'Visualize RDF graphs from the configured endpoint'
}

export default async function VisualizationPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const uri = (await searchParams).uri?.toString() || ''

  return (
    <DashboardShell>
      <DashboardHeader heading="Graph Visualization" />
      <ResourceAutocomplete searchType="visual" defaultValue={uri} showButton />
      {uri && (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-hidden">
            <GraphVisualization initialUri={uri} />
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
