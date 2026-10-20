import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { IsqlConsole } from '@/components/isql-console/isql-console'
import { QueryConsoleSkeleton } from '@/components/skeletons'
import { requirePageAccess } from '@/lib/runtime'
import { cfgItemValue } from '@/providers/virtuoso/config'

export const metadata: Metadata = {
  title: 'iSQL console',
  description: 'Run SQL commands against Virtuoso.'
}

async function IsqlConsoleContent() {
  const defaultQuery = await cfgItemValue('ISQL', 'DefaultQuery')
  return <IsqlConsole defaultQuery={defaultQuery ?? undefined} />
}

export default async function IsqlPage() {
  await requirePageAccess('admin')
  return (
    <DashboardShell>
      <DashboardHeader heading="iSQL console" />
      <Suspense fallback={<QueryConsoleSkeleton />}>
        <IsqlConsoleContent />
      </Suspense>
    </DashboardShell>
  )
}
