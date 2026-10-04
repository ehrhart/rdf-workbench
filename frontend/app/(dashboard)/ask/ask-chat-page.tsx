import { Suspense } from 'react'
import { AskConsole } from '@/components/ask/ask-console'
import { ChatSessionProvider } from '@/components/ask/chat-session'
import { AskConsoleSkeleton } from '@/components/skeletons'
import { getAiSettings } from '@/lib/ai/ai-settings'
import { getProfileSummary } from '@/lib/ai/profile-store'
import {
  getWorkbenchRuntime,
  requireFeature,
  requirePageAccess
} from '@/lib/runtime'
import type { User } from '@/types'

async function AskConsoleContent() {
  const [profileSummary, exampleQuestions] = await Promise.all([
    getProfileSummary().catch(() => null),
    getAiSettings().then((settings) => settings.exampleQuestions)
  ])

  return (
    <AskConsole
      initialProfileSummary={profileSummary}
      initialExampleQuestions={exampleQuestions}
    />
  )
}

export async function AskChatPage() {
  await requirePageAccess('anonymousAsk')
  await requireFeature('ai-ask')

  const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
  const user: User | null = principal
    ? {
        id: principal.id,
        username: principal.username,
        role: principal.role
      }
    : null

  return (
    <ChatSessionProvider user={user}>
      {/* Only the message pane scrolls: fill the viewport under the header. */}
      <div
        className="flex min-h-0 flex-col"
        style={{
          height: 'calc(100svh - var(--header-height) - 1rem)'
        }}
      >
        <Suspense fallback={<AskConsoleSkeleton />}>
          <AskConsoleContent />
        </Suspense>
      </div>
    </ChatSessionProvider>
  )
}
