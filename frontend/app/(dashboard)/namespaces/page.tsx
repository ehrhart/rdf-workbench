import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { PrefixManager } from '@/components/prefixes/prefix-manager'
import { getPrefixes } from '@/lib/prefix-actions'
import { getWorkbenchRuntime, hasAnyFeature } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Namespaces',
  description: 'Manage namespace prefixes for your SPARQL queries.'
}

export default async function NamespacesPage() {
  const runtime = await getWorkbenchRuntime()
  if (!(await hasAnyFeature(['virtuoso-namespaces', 'qlever-namespaces']))) {
    notFound()
  }

  const prefixes = await getPrefixes()
  const canManage =
    runtime.provider === 'virtuoso' ||
    (await runtime.auth.getPrincipal())?.role === 'admin'
  const scopeLabel =
    runtime.provider === 'virtuoso' ? 'Virtuoso' : 'the workbench namespaces'

  return (
    <DashboardShell>
      <DashboardHeader heading="Namespaces" />
      <PrefixManager
        initialPrefixes={prefixes}
        canManage={canManage}
        scopeLabel={scopeLabel}
      />
    </DashboardShell>
  )
}
