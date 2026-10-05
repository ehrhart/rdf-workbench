import type { UIMessage } from 'ai'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SharedChatView } from '@/components/ask/shared-chat-view'
import RDFIcon from '@/components/rdf-icon'
import { Button } from '@/components/ui/button'
import { getShareById } from '@/lib/ai/conversation-share-store'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getWorkbenchName } from '@/lib/runtime/config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const share = await getShareById(id)
  if (!share) return { title: 'Shared chat' }
  return { title: share.title, robots: { index: false } }
}

export default async function SharePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const share = await getShareById(id)
  if (!share) notFound()

  const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
  const isOwner = principal?.id === share.ownerId
  const appName = getWorkbenchName()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="py-5 px-6 flex items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2 group">
          <RDFIcon className="size-5" />
          <span className="text-base font-semibold">{appName}</span>
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto pb-32">
        <SharedChatView
          title={share.title}
          messages={share.messages as UIMessage[]}
        />
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          {isOwner ? (
            <>
              <p className="text-sm text-muted-foreground">
                This is the read-only copy that you shared of your chat
              </p>
              <Button asChild size="sm">
                <Link href={`/ask/${share.conversationId}`}>
                  Open original chat
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This is a copy of a chat. Content may include unverified or unsafe
              content
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
