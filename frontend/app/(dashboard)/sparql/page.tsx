import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { QueryConsole } from '@/components/query/query-console'
import { QueryConsoleSkeleton } from '@/components/skeletons'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { cfgItemValue } from '@/providers/virtuoso/config'

export const metadata: Metadata = {
  title: 'SPARQL Query Console',
  description: 'Execute SPARQL queries against the configured RDF endpoint'
}

// Async component for query console with data
async function QueryConsoleContent() {
  const runtime = await getWorkbenchRuntime()
  const [prefixes, defaultQuery, session] = await Promise.all([
    runtime.prefixes.list().catch(() => ({})),
    runtime.provider === 'virtuoso'
      ? cfgItemValue('SPARQL', 'DefaultQuery').catch(() => null)
      : Promise.resolve(null),
    runtime.auth.getPrincipal().catch(() => null)
  ])

  const user = session
    ? {
        id: session.id,
        username: session.username,
        role: session.role
      }
    : null

  return (
    <QueryConsole
      prefixes={prefixes}
      defaultQuery={defaultQuery ?? undefined}
      user={user}
      downloadFormats={{
        select: runtime.sparql.getDownloadFormats('select'),
        ask: runtime.sparql.getDownloadFormats('ask'),
        graph: runtime.sparql.getDownloadFormats('construct')
      }}
    />
  )
}

export default function QueryPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="SPARQL Query Console" />
      <Suspense fallback={<QueryConsoleSkeleton />}>
        <QueryConsoleContent />
      </Suspense>
    </DashboardShell>
  )
}
