import { FolderOpen, LinkIcon } from 'lucide-react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'
import { CopyToClipboardButton } from '../prefixes/copy-to-clipboard-button'

export async function SavedQueriesCard() {
  try {
    const runtime = await getWorkbenchRuntime()
    const savedQueries = await runtime.savedQueries.list(null)
    const baseUrl = getRuntimeConfig().WORKBENCH_URL.replace(/\/$/, '')

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Saved SPARQL Queries</CardTitle>
          </div>
          <FolderOpen className="size-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {savedQueries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No saved queries yet.
            </p>
          ) : (
            <ScrollArea className="max-h-96 pr-2">
              <div className="space-y-3">
                {savedQueries.map((saved) => (
                  <Link
                    key={saved.id}
                    href={`/sparql?savedQueryId=${encodeURIComponent(saved.id)}`}
                    className="flex flex-col gap-2 rounded-lg border p-3 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col min-w-0 gap-1">
                        <span className="truncate text-sm font-semibold">
                          {saved.name}
                        </span>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {saved.query}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CopyToClipboardButton
                          textToCopy={`${baseUrl}/sparql?savedQueryId=${encodeURIComponent(saved.id)}`}
                          tooltipText="Copy link"
                          successMessage="Saved query link copied"
                          errorMessage="Failed to copy link"
                          copyIcon={<LinkIcon />}
                          className="h-8 w-8"
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error('Failed to render saved queries on dashboard', error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Queries</CardTitle>
          <CardDescription>
            Shared queries available to everyone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Unable to load saved queries right now. Please try again later.
          </p>
        </CardContent>
      </Card>
    )
  }
}
