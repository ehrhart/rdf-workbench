import type { Metadata } from 'next'
import { Suspense } from 'react'

import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { FullTextIndexManager } from '@/components/fulltext/fulltext-index-manager'
import { Skeleton } from '@/components/ui/skeleton'
import { getFTRules } from '@/providers/virtuoso/fulltext'

export const metadata: Metadata = {
  title: 'Full-Text Index Management',
  description: 'Manage full-text indexing rules for RDF object values'
}

// Async component for full-text index data
async function FullTextIndexContent() {
  const rules = await getFTRules()
  return <FullTextIndexManager initialRules={rules} />
}

function FullTextIndexSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}

export default function FullTextIndexPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="Full-Text Index Management" />
      <Suspense fallback={<FullTextIndexSkeleton />}>
        <FullTextIndexContent />
      </Suspense>
    </DashboardShell>
  )
}
