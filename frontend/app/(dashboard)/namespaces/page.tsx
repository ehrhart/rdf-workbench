import type { Metadata } from 'next'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { PrefixList } from '@/components/prefixes/prefix-list'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getPrefixes } from '@/lib/prefix-actions'
import { requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Namespaces',
  description: 'Prefixes you can use in SPARQL queries.'
}

export default async function NamespacesPage() {
  await requirePageAccess('anonymousRead')
  const prefixes = await getPrefixes().catch(() => null)

  return (
    <DashboardShell>
      <DashboardHeader heading="Namespaces" />
      {prefixes === null ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load the namespaces. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : (
        <PrefixList prefixes={prefixes} />
      )}
    </DashboardShell>
  )
}
