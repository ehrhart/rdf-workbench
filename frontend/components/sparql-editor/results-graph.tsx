'use client'

import { memo } from 'react'
import { CopyToClipboardButton } from '@/components/prefixes/copy-to-clipboard-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SparqlGraphResult, SparqlQueryResult } from '@/types'

interface ResultsGraphProps {
  results: SparqlQueryResult
}

function ResultsGraph({ results }: ResultsGraphProps) {
  if (results.kind !== 'graph') {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        No RDF graph to display for this result
      </div>
    )
  }

  const graph = results as SparqlGraphResult

  if (!graph.value) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        The query returned an empty graph
      </div>
    )
  }

  return (
    <div className="flex h-[60vh] flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-background px-3 py-2">
        <span className="text-xs text-muted-foreground">{graph.format}</span>
        <CopyToClipboardButton
          textToCopy={graph.value}
          tooltipText="Copy RDF graph"
          variant="ghost"
          size="sm"
        />
      </div>
      <ScrollArea className="flex-1">
        <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed">
          {graph.value}
        </pre>
      </ScrollArea>
    </div>
  )
}

export default memo(ResultsGraph)
