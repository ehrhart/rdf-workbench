'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from 'ai'
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  HistoryIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  TableIcon,
  TrashIcon,
  XIcon
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type {
  AskMessageMetadata,
  ConversationDto,
  ProfileResponseDto,
  ProfileSummaryDto,
  QuerySuccessOutput,
  RunQueryOutput,
  SearchEntitiesOutput
} from '@/lib/ai/ask-contract'
import { cn } from '@/lib/utils'

interface AskConsoleProps {
  initialProfileSummary: ProfileSummaryDto | null
}

const FALLBACK_EXAMPLE_QUESTIONS = [
  'How many distinct resources does each class have?',
  'Which properties connect the main classes?',
  'List 10 resources with their labels.'
]

const RESULT_ROW_PREVIEW_COUNT = 8
const DIFF_LINE_LIMIT = 12

type ChatPart = UIMessage['parts'][number]

function isTextPart(
  part: ChatPart
): part is Extract<ChatPart, { type: 'text' }> {
  return part.type === 'text'
}

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

function formatTimestamp(iso: string): string {
  try {
    return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
  } catch {
    return iso
  }
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

function messageText(message: UIMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join('\n')
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
            {visibleRows.map((row) => (
              <tr key={JSON.stringify(row)} className="border-t">
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
              : `${success.rowCount ?? 0} rows${success.truncated ? ' (truncated)' : ''}`}
          </span>
        )}
        {success && typeof success.durationMs === 'number' && (
          <span>· {success.durationMs}ms</span>
        )}
        {success?.limitEnforced && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
            LIMIT enforced
          </span>
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
 * Flattens an assistant message into renderable items with stable,
 * content-independent keys (occurrence counters and toolCallIds, never array
 * indices). Also tracks the most recent failed query so a successful retry
 * can render a repair diff.
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
        items.push({
          kind: 'tool-query',
          key: toolPart.toolCallId,
          part: toolPart,
          previousFailedQuery: null
        })
      } else if (output?.ok) {
        items.push({
          kind: 'tool-query',
          key: toolPart.toolCallId,
          part: toolPart,
          previousFailedQuery: failedQuery
        })
        failedQuery = null
      } else {
        items.push({
          kind: 'tool-query',
          key: toolPart.toolCallId,
          part: toolPart,
          previousFailedQuery: null
        })
      }
    }
  }

  // The Save button attaches to the message's final fenced query.
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item.kind === 'query') {
      item.isFinalQuery = true
      break
    }
  }

  return items
}

/** Footer segments: "9.2s · 5 steps · ↑1.2k ↓0.8k · 2 queries, 1 entity search". */
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
  lastUserText
}: {
  message: UIMessage
  isLast: boolean
  lastUserText: string
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

  return (
    <div className="space-y-2.5">
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
    </div>
  )
}

function ProfileBar({
  summary,
  onRebuilt
}: {
  summary: ProfileSummaryDto
  onRebuilt: (summary: ProfileSummaryDto) => void
}) {
  const [rebuilding, setRebuilding] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [full, setFull] = useState<ProfileResponseDto | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)

  const rebuild = async () => {
    setRebuilding(true)
    try {
      const response = await fetch('/api/ask/profile', { method: 'POST' })
      const payload = (await response.json()) as ProfileResponseDto & {
        error?: string
      }
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? 'Profile rebuild failed')
      }
      if (payload.profile) onRebuilt(payload.profile)
      setFull(null)
      toast.success('Dataset profile rebuilt')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Profile rebuild failed'
      )
    } finally {
      setRebuilding(false)
    }
  }

  const openSheet = (open: boolean) => {
    setSheetOpen(open)
    if (open && full === null && !loadingFull) {
      setLoadingFull(true)
      fetch('/api/ask/profile?full=1')
        .then((response) => response.json())
        .then((payload: ProfileResponseDto) => setFull(payload))
        .catch(() => {
          setFull({
            profile: null,
            text: '(failed to load profile text)',
            systemPrompt: '(failed to load system prompt)'
          })
        })
        .finally(() => setLoadingFull(false))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <DatabaseIcon className="size-4 text-muted-foreground" />
      <span className="font-medium">
        {summary.classCount} classes, {summary.propertyCount} properties
      </span>
      <span className="text-xs text-muted-foreground">
        built {formatTimestamp(summary.builtAt)} · {summary.provider}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => openSheet(true)}>
          What the model sees
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={rebuild}
          disabled={rebuilding}
        >
          {rebuilding ? (
            <LoaderIcon className="animate-spin" />
          ) : (
            <RefreshCwIcon />
          )}
          <span className="sr-only">Rebuild profile</span>
        </Button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={openSheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>What the model sees</SheetTitle>
            <SheetDescription>
              Context sent to the model with every question.
            </SheetDescription>
          </SheetHeader>
          <Tabs
            defaultValue="profile"
            className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4"
          >
            <TabsList>
              <TabsTrigger value="profile">Dataset profile</TabsTrigger>
              <TabsTrigger value="prompt">System prompt</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                {full ? (full.text ?? '(no profile)') : 'Loading…'}
              </pre>
            </TabsContent>
            <TabsContent value="prompt">
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                {full ? (full.systemPrompt ?? '(none)') : 'Loading…'}
              </pre>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function AskConsole({ initialProfileSummary }: AskConsoleProps) {
  const [profileSummary, setProfileSummary] = useState(initialProfileSummary)
  const [input, setInput] = useState('')
  const [exampleQuestions, setExampleQuestions] = useState(
    FALLBACK_EXAMPLE_QUESTIONS
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const pendingScrollRef = useRef(false)

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [persistenceUnavailable, setPersistenceUnavailable] = useState(false)
  const persistingRef = useRef(false)

  const persistConversation = async (finishedMessages: UIMessage[]) => {
    if (persistingRef.current) return
    persistingRef.current = true
    try {
      let id = conversationId
      if (!id) {
        const firstUser = finishedMessages.find(
          (message) => message.role === 'user'
        )
        const firstText = firstUser
          ? messageText(firstUser).trim().slice(0, 60)
          : ''
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: firstText || 'New chat' })
        })
        if (response.status === 401) {
          setPersistenceUnavailable(true)
          return
        }
        if (!response.ok) return
        const payload = (await response.json()) as {
          conversation: ConversationDto
        }
        id = payload.conversation.id
        setConversationId(id)
        setTitle(payload.conversation.title)
      }
      const saved = await fetch(`/api/conversations/${id}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finishedMessages })
      })
      if (saved.status === 401) setPersistenceUnavailable(true)
    } catch (error) {
      console.error(
        '[ask] conversation persistence failed:',
        error instanceof Error ? error.message : error
      )
    } finally {
      persistingRef.current = false
    }
  }

  const {
    messages,
    sendMessage,
    regenerate,
    setMessages,
    status,
    stop,
    error
  } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ask' }),
    onFinish: ({ messages: finishedMessages }) => {
      persistConversation(finishedMessages)
    }
  })

  const streaming = status === 'streaming' || status === 'submitted'
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

  useEffect(() => {
    let cancelled = false
    fetch('/api/ask/profile')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ProfileResponseDto | null) => {
        const questions = payload?.exampleQuestions
        if (cancelled || !Array.isArray(questions) || questions.length === 0) {
          return
        }
        setExampleQuestions(questions.slice(0, 3))
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  // Keep the pane pinned to the bottom while content streams in, unless the
  // user has scrolled away to read; then offer the jump pill instead.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages and status are intentional triggers, not read values — the effect must re-run on every stream update
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    if (pendingScrollRef.current) {
      pendingScrollRef.current = false
      element.scrollTo({ top: element.scrollHeight })
      return
    }
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight
    if (distance <= 120) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    } else if (distance > 200) {
      setShowJumpToLatest(true)
    }
  }, [messages, status])

  const send = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    sendMessage({ text })
  }

  const editMessage = (message: UIMessage) => {
    const index = messages.findIndex((item) => item.id === message.id)
    if (index < 0) return
    setMessages(messages.slice(0, index))
    setInput(messageText(message))
    textareaRef.current?.focus()
  }

  const startTitleEdit = () => {
    setTitleDraft(title)
    setEditingTitle(true)
  }

  const commitTitle = async () => {
    setEditingTitle(false)
    const next = titleDraft.trim()
    if (!next || next === title) return
    setTitle(next)
    if (!conversationId) return
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next })
      })
      if (response.status === 401) setPersistenceUnavailable(true)
      else if (!response.ok) throw new Error('Failed to rename conversation')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to rename conversation'
      )
      setTitle(title)
    }
  }

  const newChat = () => {
    setConversationId(null)
    setTitle('')
    setEditingTitle(false)
    setMessages([])
  }

  const openHistorySheet = (open: boolean) => {
    setHistoryOpen(open)
    if (!open) return
    setConversationsLoading(true)
    fetch('/api/conversations')
      .then(async (response) => {
        if (response.status === 401) {
          setPersistenceUnavailable(true)
          setHistoryOpen(false)
          return null
        }
        if (!response.ok) throw new Error('Failed to load conversations')
        return (await response.json()) as { conversations: ConversationDto[] }
      })
      .then((payload) => {
        if (payload) setConversations(payload.conversations ?? [])
      })
      .catch(() => toast.error('Failed to load conversations'))
      .finally(() => setConversationsLoading(false))
  }

  const openConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`)
      if (response.status === 401) {
        setPersistenceUnavailable(true)
        setHistoryOpen(false)
        return
      }
      if (!response.ok) throw new Error('Failed to load conversation')
      const payload = (await response.json()) as {
        conversation: ConversationDto
        messages: UIMessage[]
      }
      pendingScrollRef.current = true
      setMessages((payload.messages ?? []) as UIMessage[])
      setConversationId(payload.conversation.id)
      setTitle(payload.conversation.title)
      setEditingTitle(false)
      setHistoryOpen(false)
    } catch (loadError) {
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load conversation'
      )
    }
  }

  const startRename = (conversation: ConversationDto) => {
    setRenamingId(conversation.id)
    setRenameDraft(conversation.title)
  }

  const commitRename = async () => {
    const id = renamingId
    setRenamingId(null)
    if (!id) return
    const next = renameDraft.trim()
    const current = conversations.find((conversation) => conversation.id === id)
    if (!next || !current || next === current.title) return
    setConversations((list) =>
      list.map((conversation) =>
        conversation.id === id ? { ...conversation, title: next } : conversation
      )
    )
    if (id === conversationId) setTitle(next)
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next })
      })
      if (response.status === 401) setPersistenceUnavailable(true)
      else if (!response.ok) throw new Error('Failed to rename conversation')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to rename conversation'
      )
      setConversations((list) =>
        list.map((conversation) =>
          conversation.id === id
            ? { ...conversation, title: current.title }
            : conversation
        )
      )
    }
  }

  const deleteConversation = async (id: string) => {
    if (!window.confirm('Delete this conversation?')) return
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE'
      })
      if (response.status === 401) {
        setPersistenceUnavailable(true)
        return
      }
      if (!response.ok) throw new Error('Failed to delete conversation')
      setConversations((list) =>
        list.filter((conversation) => conversation.id !== id)
      )
      if (conversationId === id) {
        setConversationId(null)
        setTitle('')
        setMessages([])
      }
      toast.success('Conversation deleted')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete conversation'
      )
    }
  }

  const toolCallCount =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts.filter((part) => asToolPart(part) !== null).length
      : 0

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col gap-4">
      {profileSummary && (
        <ProfileBar summary={profileSummary} onRebuilt={setProfileSummary} />
      )}

      <p className="text-xs text-muted-foreground">
        {profileSummary
          ? `Read-only queries against ${profileSummary.endpoint}`
          : 'Queries run read-only against the configured SPARQL endpoint.'}
      </p>

      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-4">
        {!streaming && !persistenceUnavailable && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openHistorySheet(true)}
            >
              <HistoryIcon /> History
            </Button>
            {editingTitle ? (
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitTitle()
                  }
                  if (event.key === 'Escape') {
                    setTitleDraft(title)
                    setEditingTitle(false)
                  }
                }}
                aria-label="Conversation title"
                className="h-7 min-w-0 flex-1 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={startTitleEdit}
                title={title || 'Add a title'}
                className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                {title || 'Untitled chat'}
              </button>
            )}
            <Button variant="outline" size="sm" onClick={newChat}>
              <PlusIcon /> New chat
            </Button>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={() => {
              const element = scrollRef.current
              if (!element) return
              const distance =
                element.scrollHeight - element.scrollTop - element.clientHeight
              setShowJumpToLatest((shown) =>
                distance > 200 ? true : distance <= 120 ? false : shown
              )
            }}
            className="h-full space-y-4 overflow-y-auto rounded-lg border p-4"
          >
            {messages.length === 0 && (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  Ask anything about this dataset. The assistant resolves
                  entities, writes SPARQL, and verifies every query.
                </p>
                <div className="flex w-full flex-col gap-2">
                  {exampleQuestions.map((question) => (
                    <Button
                      key={question}
                      variant="outline"
                      size="sm"
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
                  <div key={message.id} className="group flex justify-end">
                    <div className="relative max-w-[80%]">
                      <div className="rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
                        {messageText(message)}
                      </div>
                      {message.id === lastUserId && !streaming && (
                        <div className="absolute top-0 right-full mr-1.5 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => regenerate()}
                          >
                            <RefreshCwIcon />
                            <span className="sr-only">Regenerate</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => editMessage(message)}
                          >
                            <PencilIcon />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              return (
                <AssistantMessageView
                  key={message.id}
                  message={message}
                  isLast={message.id === lastMessage?.id}
                  lastUserText={lastUserText}
                />
              )
            })}
            {status === 'streaming' && lastMessage?.role === 'assistant' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderIcon className="size-3.5 animate-spin" />
                Working, {toolCallCount} tool call(s)
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
          {showJumpToLatest && (
            <Button
              variant="outline"
              size="sm"
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
              onClick={() => {
                setShowJumpToLatest(false)
                const element = scrollRef.current
                if (element) {
                  element.scrollTo({
                    top: element.scrollHeight,
                    behavior: 'smooth'
                  })
                }
              }}
            >
              <ChevronDownIcon /> Jump to latest
            </Button>
          )}
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

      <Sheet open={historyOpen} onOpenChange={openHistorySheet}>
        <SheetContent side="left" className="w-80 max-w-[85vw]">
          <SheetHeader>
            <SheetTitle>Conversation history</SheetTitle>
            <SheetDescription>Your recent ask sessions.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {conversationsLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((conversation) => (
                  <li
                    key={conversation.id}
                    className="flex items-center gap-0.5 rounded-md hover:bg-muted/60"
                  >
                    {renamingId === conversation.id ? (
                      <Input
                        ref={(element) => {
                          element?.focus()
                        }}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitRename()
                          }
                          if (event.key === 'Escape') {
                            setRenameDraft(conversation.title)
                            setRenamingId(null)
                          }
                        }}
                        aria-label="Conversation name"
                        className="h-7 min-w-0 flex-1 text-sm"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openConversation(conversation.id)}
                          className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left"
                        >
                          <span className="block truncate text-sm font-medium">
                            {conversation.title || 'Untitled chat'}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatTimestamp(conversation.updatedAt)} ·{' '}
                            {conversation.messageCount} messages
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => startRename(conversation)}
                        >
                          <PencilIcon />
                          <span className="sr-only">
                            Rename {conversation.title || 'conversation'}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteConversation(conversation.id)}
                        >
                          <TrashIcon />
                          <span className="sr-only">
                            Delete {conversation.title || 'conversation'}
                          </span>
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
