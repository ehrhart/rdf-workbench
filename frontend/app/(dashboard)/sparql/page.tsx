import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { PrefixesProvider } from '@/components/prefixes/prefix-context'
import { QueryConsole } from '@/components/query/query-console'
import { QueryConsoleSkeleton } from '@/components/skeletons'
import { getWorkbenchRuntime, requirePageAccess } from '@/lib/runtime'
import { cfgItemValue } from '@/providers/virtuoso/config'

export const metadata: Metadata = {
  title: 'SPARQL query console',
  description: 'Write and run SPARQL queries.'
}

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
    <PrefixesProvider prefixes={prefixes}>
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
    </PrefixesProvider>
  )
}

export default async function QueryPage() {
  await requirePageAccess('anonymousRead')
  return (
    <DashboardShell>
      <DashboardHeader heading="SPARQL query console" />
      <Suspense fallback={<QueryConsoleSkeleton />}>
        <QueryConsoleContent />
      </Suspense>
    </DashboardShell>
  )
}
