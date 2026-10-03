import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AskConsole } from '@/components/ask/ask-console'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { AskConsoleSkeleton } from '@/components/skeletons'
import { getProfileSummary } from '@/lib/ai/profile-store'
import { requireFeature, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Ask',
  description: 'Ask questions about the dataset in natural language'
}

async function AskConsoleContent() {
  const profileSummary = await getProfileSummary().catch(() => null)

  return <AskConsole initialProfileSummary={profileSummary} />
}

export default async function AskPage() {
  await requirePageAccess('session')
  await requireFeature('ai-ask')
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Ask"
        text="Describe what you want to know. The assistant resolves entities, writes SPARQL against the dataset profile, and verifies the query against the endpoint."
      />
      <Suspense fallback={<AskConsoleSkeleton />}>
        <AskConsoleContent />
      </Suspense>
    </DashboardShell>
  )
}
