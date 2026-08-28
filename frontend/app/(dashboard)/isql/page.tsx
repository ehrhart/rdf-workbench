import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { IsqlConsole } from '@/components/isql-console/isql-console'
import { QueryConsoleSkeleton } from '@/components/skeletons'
import { cfgItemValue } from '../configuration/actions'

export const metadata: Metadata = {
  title: 'ISQL Console',
  description: 'Execute SQL commands directly against Virtuoso'
}

async function IsqlConsoleContent() {
  // await requireSession()
  const defaultQuery = await cfgItemValue('ISQL', 'DefaultQuery')
  return <IsqlConsole defaultQuery={defaultQuery ?? undefined} />
}

export default function IsqlPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="ISQL Console" />
      <Suspense fallback={<QueryConsoleSkeleton />}>
        <IsqlConsoleContent />
      </Suspense>
    </DashboardShell>
  )
}
