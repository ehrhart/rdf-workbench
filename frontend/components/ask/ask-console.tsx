'use client'

import type { ToolUIPart, UIMessage } from 'ai'
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  CopyIcon,
  ExternalLinkIcon,
  LoaderIcon,
  PencilIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  TableIcon,
  XIcon
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useStickToBottom } from 'use-stick-to-bottom'
import { ChatHeader } from '@/components/ask/chat-header'
import {
  isTextPart,
  messageText,
  useChatSession
} from '@/components/ask/chat-session'
import { DatasetChip } from '@/components/ask/dataset-chip'
import { MarkdownText } from '@/components/ask/markdown-text'
import { diffQueryLines } from '@/components/ask/query-diff'
import {
  type HighlightedQuery,
  highlightSparql
} from '@/components/ask/sparql-highlight'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type {
  AskMessageMetadata,
  ProfileSummaryDto,
  QuerySuccessOutput,
  RunQueryOutput,
  SearchEntitiesOutput
} from '@/lib/ai/ask-contract'
import { cn } from '@/lib/utils'

interface AskConsoleProps {
  initialProfileSummary: ProfileSummaryDto | null
  initialExampleQuestions: string[]
}

const RESULT_ROW_PREVIEW_COUNT = 8
const DIFF_LINE_LIMIT = 12

type ChatPart = UIMessage['parts'][number]

function isReasoningPart(
  part: ChatPart
): part is Extract<ChatPart, { type: 'reasoning' }> {
  return part.type === 'reasoning'
}

function asToolPart(part: ChatPart): ToolUIPart | null {
  return part.type.startsWith('tool-') ? (part as ToolUIPart) : null
}

function asSearchOutput(part: ToolUIPart): SearchEntitiesOutput | null {
  const output = part.output
  if (
    output &&
    typeof output === 'object' &&
    'results' in output &&
    Array.isArray((output as SearchEntitiesOutput).results)
  ) {
    return output as SearchEntitiesOutput
  }
  return null
}

function asQueryOutput(part: ToolUIPart): RunQueryOutput | null {
  const output = part.output
  if (output && typeof output === 'object' && 'ok' in output) {
    return output as RunQueryOutput
  }
  return null
}

function asQueryInput(part: ToolUIPart): string | null {
  const input = part.input
  if (input && typeof input === 'object' && 'query' in input) {
    return String((input as { query: unknown }).query)
  }
  return null
}

function humanizeChatError(message: string): string {
  try {
    const payload = JSON.parse(message) as { error?: unknown }
    if (typeof payload.error === 'string' && payload.error) {
      return payload.error
    }
  } catch {
    return message
  }
  return message
}

interface TextBlock {
  kind: 'text' | 'sparql'
  content: string
}

function splitSparqlBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = []
  const pattern = /```(?:sparql)?\n?([\s\S]*?)```/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      blocks.push({ kind: 'text', content: text.slice(cursor, match.index) })
    }
    blocks.push({ kind: 'sparql', content: (match[1] ?? '').trim() })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    blocks.push({ kind: 'text', content: text.slice(cursor) })
  }
  return blocks
}

function compactCount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? String(millions) : millions.toFixed(1)}M`
  }
  if (value >= 1000) {
    const thousands = value / 1000
    return `${Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1)}k`
  }
  return String(value)
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function buildCsv(
  variables: string[],
  rows: Array<Record<string, string>>
): string {
  const lines = [variables.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(
      variables.map((variable) => csvField(row[variable] ?? '')).join(',')
    )
  }
  return lines.join('\n')
}

function HighlightedQueryBlock({
  query,
  className
}: {
  query: string
  className?: string
}) {
  const [highlighted, setHighlighted] = useState<HighlightedQuery | null>(null)

  useEffect(() => {
    let cancelled = false
    setHighlighted(null)
    highlightSparql(query).then((result) => {
      if (!cancelled) setHighlighted(result)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap',
        className
      )}
      style={
        highlighted
          ? {
              backgroundColor: highlighted.background,
              color: highlighted.foreground
            }
          : undefined
      }
    >
      {highlighted ? (
        <span
          // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes token text through its hast renderer, so the markup cannot inject
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      ) : (
        query
      )}
    </pre>
  )
}

function ResultTable({ output }: { output: QuerySuccessOutput }) {
  const allRows = output.rows ?? []
  const variables = output.variables ?? Object.keys(allRows[0] ?? {})
  const [showAll, setShowAll] = useState(false)
  const hasMore = allRows.length > RESULT_ROW_PREVIEW_COUNT
  const visibleRows = showAll
    ? allRows
    : allRows.slice(0, RESULT_ROW_PREVIEW_COUNT)
  const links = output.links

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(buildCsv(variables, allRows))
      toast.success('Copied results as CSV')
    } catch {
      toast.error('Failed to copy CSV')
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1">
        {hasMore && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowAll((shown) => !shown)}
          >
            {showAll ? 'Show fewer rows' : `Show all ${allRows.length}`}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={copyCsv}
          disabled={allRows.length === 0}
        >
          <ClipboardCopyIcon />
          <span className="sr-only">Copy CSV</span>
        </Button>
      </div>
      <div className="max-h-80 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50">
            <tr>
              {variables.map((variable) => (
                <th key={variable} className="px-2 py-1 text-left font-medium">
                  {variable}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional result rows may legitimately duplicate and never reorder
              <tr key={rowIndex} className="border-t">
                {variables.map((variable) => {
                  const text = row[variable] ?? ''
                  const link = links?.[text]
                  const isNumeric =
                    text.trim() !== '' && Number.isFinite(Number(text))
                  return (
                    <td
                      key={variable}
                      className={cn(
                        'max-w-64 truncate px-2 py-1',
                        isNumeric && 'text-right'
                      )}
                      title={text}
                    >
                      {link ? (
                        <a
                          href={`/resource?uri=${encodeURIComponent(link)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {text}
                        </a>
                      ) : (
                        text
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(variables.length, 1)}
                  className="px-2 py-2 text-muted-foreground"
                >
                  No rows returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QueryBlock({
  query,
  showSave = false,
  lastUserText
}: {
  query: string
  showSave?: boolean
  lastUserText: string
}) {
  const [saved, setSaved] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(query)
    toast.success('Query copied')
  }

  const save = async () => {
    if (saved) return
    const name = lastUserText.trim().slice(0, 60) || 'Ask query'
    try {
      const response = await fetch('/api/saved-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, query })
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error ?? 'Failed to save query')
      }
      setSaved(true)
      toast.success('Saved to saved queries')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save query'
      )
    }
  }

  return (
    <div className="space-y-1">
      <HighlightedQueryBlock query={query} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <CopyIcon /> Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.location.href = `/sparql?query=${encodeURIComponent(query)}`
          }}
        >
          <ExternalLinkIcon /> Open in console
        </Button>
        {showSave && (
          <Button variant="outline" size="sm" onClick={save} disabled={saved}>
            <SaveIcon /> {saved ? 'Saved' : 'Save query'}
          </Button>
        )}
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('Failed to copy message')
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="sr-only">Copy message</span>
    </Button>
  )
}

function SearchEntitiesCard({ part }: { part: ToolUIPart }) {
  const output = asSearchOutput(part)
  if (!output) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        <SearchIcon className="size-3.5" /> Entities
      </span>
      {output.results.map((result) => (
        <a
          key={result.resource}
          href={`/resource?uri=${encodeURIComponent(result.resource)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border px-2 py-0.5 hover:bg-muted"
          title={result.resource}
        >
          {result.label || result.resource}
        </a>
      ))}
      {output.results.length === 0 && (
        <span className="text-muted-foreground">
          {output.note ?? 'No matches.'}
        </span>
      )}
    </div>
  )
}

function RunQueryCard({
  part,
  previousFailedQuery
}: {
  part: ToolUIPart
  previousFailedQuery?: string | null
}) {
  const output = asQueryOutput(part)
  const inputQuery = asQueryInput(part)
  const query = output?.query ?? inputQuery ?? ''
  const success = output?.ok ? output : null
  const running =
    part.state === 'input-streaming' || part.state === 'input-available'

  const diff =
    success && previousFailedQuery
      ? diffQueryLines(previousFailedQuery, query)
      : []
  const visibleDiff = diff.slice(0, DIFF_LINE_LIMIT)

  return (
    <div className="space-y-1.5 rounded-md border p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <TableIcon className="size-3.5" />
        <span className="font-medium">SPARQL</span>
        {running && <LoaderIcon className="size-3.5 animate-spin" />}
        {success && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="size-3.5" />
            {success.kind === 'boolean'
              ? `ASK → ${String(success.boolean)}`
              : `${success.rowCount ?? 0} ${
                  (success.rowCount ?? 0) === 1 ? 'row' : 'rows'
                }${success.truncated ? ' (truncated)' : ''}`}
          </span>
        )}
        {success && typeof success.durationMs === 'number' && (
          <span>· {success.durationMs}ms</span>
        )}
        {success?.limitEnforced && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help rounded-full bg-muted px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                LIMIT enforced
              </span>
            </TooltipTrigger>
            <TooltipContent>
              The query had no LIMIT or asked for more rows than allowed, so the
              tool capped it automatically.
            </TooltipContent>
          </Tooltip>
        )}
        {output && !output.ok && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangleIcon className="size-3.5" /> needs revision
          </span>
        )}
      </div>
      {success &&
        success.kind === 'bindings' &&
        ((success.rowCount ?? success.rows?.length ?? 0) === 0 ? (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-muted-foreground">
              The query ran but matched nothing.
            </p>
            <p className="mt-0.5 text-muted-foreground/80">
              Check the query or try broader terms.
            </p>
          </div>
        ) : (
          <ResultTable output={success} />
        ))}
      {success && success.kind === 'boolean' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border p-2.5',
            success.boolean
              ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          {success.boolean ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <XIcon className="size-3.5" />
          )}
          <span className="font-medium">
            ASK query → {String(success.boolean)}
          </span>
        </div>
      )}
      {diff.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">Changes from previous attempt</p>
          <div className="overflow-x-auto rounded-md bg-muted p-2">
            {visibleDiff.map((line) => (
              <div
                key={`${line.sign}:${line.text}`}
                className={cn(
                  'whitespace-pre-wrap',
                  line.sign === 'removed'
                    ? 'text-destructive'
                    : 'text-emerald-600 dark:text-emerald-300'
                )}
              >
                {line.sign === 'removed' ? `- ${line.text}` : `+ ${line.text}`}
              </div>
            ))}
            {diff.length > DIFF_LINE_LIMIT && (
              <div className="text-muted-foreground">
                +{diff.length - DIFF_LINE_LIMIT} more
              </div>
            )}
          </div>
        </div>
      )}
      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />{' '}
          query
        </CollapsibleTrigger>
        <CollapsibleContent>
          <HighlightedQueryBlock query={query} className="mt-1.5 p-2" />
        </CollapsibleContent>
      </Collapsible>
      {output && !output.ok && (
        <ul className="list-disc space-y-1 pl-4 text-destructive">
          {output.error && <li>{output.error}</li>}
          {(output.issues ?? []).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ThinkingBlock({
  state,
  text
}: {
  state: 'streaming' | 'done' | undefined
  text: string
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {state === 'streaming' ? (
          <LoaderIcon className="size-3.5 animate-spin" />
        ) : (
          <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
        )}
        Thinking
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
          {text}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}

type AssistantItem =
  | {
      kind: 'reasoning'
      key: string
      state: 'streaming' | 'done' | undefined
      text: string
    }
  | { kind: 'text'; key: string; content: string }
  | { kind: 'query'; key: string; content: string; isFinalQuery: boolean }
  | { kind: 'tool-search'; key: string; part: ToolUIPart }
  | {
      kind: 'tool-query'
      key: string
      part: ToolUIPart
      previousFailedQuery: string | null
    }

/**
 * Keys stay content-independent (occurrence counters and toolCallIds, never
 * array indices) so they survive streaming updates.
 */
function buildAssistantItems(message: UIMessage): AssistantItem[] {
  const items: AssistantItem[] = []
  let reasoningNumber = 0
  let textPartNumber = 0
  let failedQuery: string | null = null

  for (const part of message.parts) {
    if (isReasoningPart(part)) {
      reasoningNumber += 1
      items.push({
        kind: 'reasoning',
        key: `reasoning-${reasoningNumber}`,
        state: part.state,
        text: part.text
      })
      continue
    }
    if (isTextPart(part)) {
      textPartNumber += 1
      let textBlockNumber = 0
      let sparqlBlockNumber = 0
      for (const block of splitSparqlBlocks(part.text)) {
        if (block.kind === 'text') {
          const content = block.content.trim()
          if (!content) continue
          textBlockNumber += 1
          items.push({
            kind: 'text',
            key: `text-${textPartNumber}-${textBlockNumber}`,
            content
          })
        } else {
          sparqlBlockNumber += 1
          items.push({
            kind: 'query',
            key: `query-${textPartNumber}-${sparqlBlockNumber}`,
            content: block.content,
            isFinalQuery: false
          })
        }
      }
      continue
    }
    const toolPart = asToolPart(part)
    if (toolPart?.type === 'tool-search_entities') {
      items.push({
        kind: 'tool-search',
        key: toolPart.toolCallId,
        part: toolPart
      })
      continue
    }
    if (toolPart?.type === 'tool-run_readonly_query') {
      const output = asQueryOutput(toolPart)
      if (output && !output.ok) {
        failedQuery = output.query ?? asQueryInput(toolPart) ?? null
      }
      items.push({
        kind: 'tool-query',
        key: toolPart.toolCallId,
        part: toolPart,
        previousFailedQuery: output?.ok ? failedQuery : null
      })
      if (output?.ok) failedQuery = null
    }
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item.kind === 'query') {
      item.isFinalQuery = true
      break
    }
  }

  return items
}

function buildFooterSegments(
  parts: ChatPart[],
  metadata: Partial<AskMessageMetadata>
): string[] {
  const segments: string[] = []
  if (typeof metadata.durationMs === 'number') {
    segments.push(`${(metadata.durationMs / 1000).toFixed(1)}s`)
  }
  if (typeof metadata.stepCount === 'number') {
    segments.push(
      `${metadata.stepCount} ${metadata.stepCount === 1 ? 'step' : 'steps'}`
    )
  }
  const inputTokens = metadata.usage?.inputTokens
  const outputTokens = metadata.usage?.outputTokens
  if (typeof inputTokens === 'number' || typeof outputTokens === 'number') {
    const usage: string[] = []
    if (typeof inputTokens === 'number')
      usage.push(`↑${compactCount(inputTokens)}`)
    if (typeof outputTokens === 'number') {
      usage.push(`↓${compactCount(outputTokens)}`)
    }
    if (usage.length > 0) segments.push(usage.join(' '))
  }
  let queries = 0
  let searches = 0
  for (const part of parts) {
    const toolPart = asToolPart(part)
    if (toolPart?.type === 'tool-run_readonly_query') queries += 1
    else if (toolPart?.type === 'tool-search_entities') searches += 1
  }
  if (queries > 0) {
    segments.push(`${queries} ${queries === 1 ? 'query' : 'queries'}`)
  }
  if (searches > 0) {
    segments.push(
      `${searches} entity ${searches === 1 ? 'search' : 'searches'}`
    )
  }
  return segments
}

function AssistantMessageView({
  message,
  isLast,
  lastUserText,
  streaming,
  onRegenerate
}: {
  message: UIMessage
  isLast: boolean
  lastUserText: string
  streaming: boolean
  onRegenerate: () => void
}) {
  const metadata = (message.metadata ?? {}) as Partial<AskMessageMetadata>
  const items = useMemo(() => buildAssistantItems(message), [message])
  const footerSegments = useMemo(
    () =>
      buildFooterSegments(
        message.parts,
        (message.metadata ?? {}) as Partial<AskMessageMetadata>
      ),
    [message]
  )
  const showActions = !(isLast && streaming)

  return (
    <div className="group space-y-2.5">
      {items.map((item) => {
        switch (item.kind) {
          case 'reasoning':
            return (
              <ThinkingBlock
                key={item.key}
                state={item.state}
                text={item.text}
              />
            )
          case 'text':
            return <MarkdownText key={item.key} text={item.content} />
          case 'query':
            return (
              <QueryBlock
                key={item.key}
                query={item.content}
                showSave={item.isFinalQuery && isLast}
                lastUserText={lastUserText}
              />
            )
          case 'tool-search':
            return <SearchEntitiesCard key={item.key} part={item.part} />
          case 'tool-query':
            return (
              <RunQueryCard
                key={item.key}
                part={item.part}
                previousFailedQuery={item.previousFailedQuery}
              />
            )
          default:
            return null
        }
      })}
      {metadata.budgetReached && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-600/10 p-2.5 text-xs text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-400">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Reached the tool-step limit before finishing. The last working query
            is kept above.
          </span>
        </div>
      )}
      {footerSegments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {footerSegments.join(' · ')}
        </p>
      )}
      {showActions && (
        <div className="-ml-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <CopyButton text={messageText(message)} />
          {isLast && (
            <Button variant="ghost" size="icon-xs" onClick={onRegenerate}>
              <RefreshCwIcon />
              <span className="sr-only">Regenerate</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function UserMessageView({
  message,
  isLast,
  streaming,
  onRegenerate,
  onEditSubmit
}: {
  message: UIMessage
  isLast: boolean
  streaming: boolean
  onRegenerate: () => void
  onEditSubmit: (message: UIMessage, text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEditing = () => {
    setDraft(messageText(message))
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setDraft('')
  }

  const submitEditing = () => {
    const text = draft.trim()
    if (!text) return
    setEditing(false)
    setDraft('')
    onEditSubmit(message, text)
  }

  if (editing) {
    return (
      <div className="flex w-full max-w-[85%] flex-col items-end gap-2">
        <Textarea
          autoFocus
          rows={Math.min(10, Math.max(3, draft.split('\n').length))}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelEditing()
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submitEditing()
            }
          }}
          className="w-full resize-none bg-background text-normal-foreground"
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={cancelEditing}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submitEditing}
            disabled={draft.trim() === ''}
          >
            Send
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[80%]">
        <div className="rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          {messageText(message)}
        </div>
        <div className="absolute top-0 right-full mr-1.5 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <CopyButton text={messageText(message)} />
          {isLast && !streaming && (
            <>
              <Button variant="ghost" size="icon-xs" onClick={onRegenerate}>
                <RefreshCwIcon />
                <span className="sr-only">Regenerate</span>
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={startEditing}>
                <PencilIcon />
                <span className="sr-only">Edit</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function AskConsole({
  initialProfileSummary,
  initialExampleQuestions
}: AskConsoleProps) {
  const [profileSummary, setProfileSummary] = useState(initialProfileSummary)
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
    useStickToBottom()
  const {
    messages,
    status,
    error,
    streaming,
    sendMessage,
    stop,
    regenerate,
    setMessages,
    pendingScrollRef
  } = useChatSession()

  const lastMessage = messages[messages.length - 1]

  const lastUserText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.role !== 'user') continue
      const text = message.parts.find(isTextPart)
      if (text) return text.text
    }
    return ''
  }, [messages])

  const lastUserId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') return messages[index].id
    }
    return null
  }, [messages])

  // Focus the composer on page load and whenever the chat resets to
  // empty (New chat, sidebar Ask); leave it alone on conversation loads.
  const wasEmptyRef = useRef(false)
  useEffect(() => {
    const isEmpty = messages.length === 0
    if (isEmpty && !wasEmptyRef.current) textareaRef.current?.focus()
    wasEmptyRef.current = isEmpty
  }, [messages])

  // Conversation switches jump straight to the latest message. Following
  // the stream while it runs is handled by use-stick-to-bottom: it stays
  // pinned to the bottom on content resize while the reader is there and
  // unlocks on any user scroll gesture (wheel, touch, scrollbar drag,
  // keyboard).
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages is an intentional trigger — the effect must re-run when the switched conversation has finished loading
  useEffect(() => {
    if (!pendingScrollRef.current) return
    pendingScrollRef.current = false
    void scrollToBottom({ animation: 'auto' })
  }, [messages, pendingScrollRef, scrollToBottom])

  const send = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    void scrollToBottom()
    sendMessage({ text })
  }

  const editMessage = (message: UIMessage, text: string) => {
    const index = messages.findIndex((item) => item.id === message.id)
    if (index < 0) return
    setMessages(messages.slice(0, index))
    void scrollToBottom()
    sendMessage({ text })
  }

  const toolCallCount =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts.filter((part) => asToolPart(part) !== null).length
      : 0
  // "Working" means a tool call is actually running — not the thinking
  // gaps between calls, which the Thinking block's spinner already covers.
  const toolRunning =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some((part) => {
      const toolPart = asToolPart(part)
      return (
        toolPart !== null &&
        toolPart.state !== 'output-available' &&
        toolPart.state !== 'output-error'
      )
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto"
        >
          <div
            ref={contentRef}
            className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6"
          >
            {messages.length === 0 && (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  Ask anything about this Knowledge Graph.
                </p>
                <div className="flex w-full flex-col gap-2">
                  {initialExampleQuestions.map((question) => (
                    <Button
                      key={question}
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start sm:h-auto whitespace-normal py-2 text-left"
                      onClick={() => {
                        if (!streaming) sendMessage({ text: question })
                      }}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => {
              if (message.role === 'user') {
                return (
                  <UserMessageView
                    key={message.id}
                    message={message}
                    isLast={message.id === lastUserId}
                    streaming={streaming}
                    onRegenerate={regenerate}
                    onEditSubmit={editMessage}
                  />
                )
              }
              return (
                <AssistantMessageView
                  key={message.id}
                  message={message}
                  isLast={message.id === lastMessage?.id}
                  lastUserText={lastUserText}
                  streaming={streaming}
                  onRegenerate={regenerate}
                />
              )
            })}
            {status === 'streaming' && toolRunning && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderIcon className="size-3.5 animate-spin" />
                Working, {toolCallCount} tool{' '}
                {toolCallCount === 1 ? 'call' : 'calls'}
              </div>
            )}
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <span className="flex items-center gap-2">
                  <AlertTriangleIcon className="size-4 shrink-0" />
                  {humanizeChatError(error.message)}
                </span>
                {!streaming && lastUserText && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerate()}
                  >
                    <RefreshCwIcon /> Retry
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {!isAtBottom && (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
            onClick={() => {
              void scrollToBottom()
            }}
          >
            <ChevronDownIcon /> Jump to latest
          </Button>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
        <div className="mb-1.5 flex items-center">
          <DatasetChip summary={profileSummary} onRebuilt={setProfileSummary} />
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder="Ask about the dataset…"
            rows={2}
            className="min-w-0 flex-1 resize-none"
          />
          {streaming ? (
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => stop()}
            >
              Stop
            </Button>
          ) : (
            <Button
              className="shrink-0"
              onClick={send}
              disabled={!input.trim()}
            >
              Ask
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
