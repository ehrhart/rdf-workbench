'use client'

import { cn } from 'cn'
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  Square
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { formatDuration } from '@/lib/utils'
import { abortQuery, getMonitoredQueries, type MonitoredQuery } from './actions'

const STATE_BADGES: Record<
  MonitoredQuery['state'],
  { variant: 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  RUNNING: {
    variant: 'secondary',
    className: 'bg-blue-500/10 text-blue-600'
  },
  COMPLETED: {
    variant: 'secondary',
    className: 'bg-emerald-500/10 text-emerald-600'
  },
  FAILED: { variant: 'destructive' },
  CANCELLED: { variant: 'outline', className: 'text-muted-foreground' },
  TIMEOUT: {
    variant: 'secondary',
    className: 'bg-amber-500/10 text-amber-600'
  }
}

const STATE_ORDER: Record<MonitoredQuery['state'], number> = {
  RUNNING: 0,
  FAILED: 1,
  TIMEOUT: 2,
  CANCELLED: 3,
  COMPLETED: 4
}

function sortQueries(queries: MonitoredQuery[]): MonitoredQuery[] {
  return [...queries].sort((a, b) => {
    const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state]
    if (byState !== 0) return byState
    return b.startedAt - a.startedAt
  })
}

const queryClock = (() => {
  let state = { now: Date.now(), baseline: Date.now() }
  const listeners = new Set<() => void>()
  let frame: number | null = null
  let lastTick = 0
  let enabled = true

  function loop(nowMs: number): void {
    frame = requestAnimationFrame(loop)
    if (nowMs - lastTick < 100) return
    lastTick = nowMs
    state = { ...state, now: Date.now() }
    for (const listener of listeners) listener()
  }

  function startLoop(): void {
    if (frame === null) {
      lastTick = 0
      frame = requestAnimationFrame(loop)
    }
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      if (listeners.size === 1 && enabled) startLoop()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && frame !== null) {
          cancelAnimationFrame(frame)
          frame = null
        }
      }
    },
    getSnapshot(): { now: number; baseline: number } {
      return state
    },
    getServerSnapshot(): { now: number; baseline: number } {
      return state
    },
    setBaseline(): void {
      state = { now: Date.now(), baseline: Date.now() }
      for (const listener of listeners) listener()
    },
    setEnabled(value: boolean): void {
      enabled = value
      if (value && listeners.size > 0) startLoop()
      if (!value && frame !== null) {
        cancelAnimationFrame(frame)
        frame = null
      }
    }
  }
})()

function StaticDurationCell({ ms }: { ms: number }): React.ReactElement {
  return (
    <TableCell>
      <Tooltip>
        <TooltipTrigger>{formatDuration(ms)}</TooltipTrigger>
        <TooltipContent>{ms} ms</TooltipContent>
      </Tooltip>
    </TableCell>
  )
}

function LiveDurationCell({
  query
}: {
  query: MonitoredQuery
}): React.ReactElement {
  const { now, baseline } = useSyncExternalStore(
    queryClock.subscribe,
    queryClock.getSnapshot,
    queryClock.getServerSnapshot
  )
  const ms = query.lifetime + (now - baseline)
  return (
    <TableCell>
      <Tooltip>
        <TooltipTrigger>{formatDuration(ms)}</TooltipTrigger>
        <TooltipContent>{ms} ms so far</TooltipContent>
      </Tooltip>
    </TableCell>
  )
}

function DurationCell({
  query
}: {
  query: MonitoredQuery
}): React.ReactElement {
  return query.state === 'RUNNING' ? (
    <LiveDurationCell query={query} />
  ) : (
    <StaticDurationCell ms={query.durationMs ?? query.lifetime} />
  )
}

function ExpandableQueryText({
  text,
  expanded,
  onToggle
}: {
  text: string
  expanded: boolean
  onToggle: () => void
}) {
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)

  return (
    // biome-ignore lint/a11y/useSemanticElements: selection requires a real pre
    <pre
      className="bg-muted hover:bg-muted/80 max-h-96 w-full cursor-pointer overflow-auto rounded-md p-2 font-mono text-xs wrap-break-words whitespace-pre-wrap"
      title={expanded ? 'Click to collapse' : 'Click to expand'}
      onMouseDown={(event) => {
        pressOrigin.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        const origin = pressOrigin.current
        pressOrigin.current = null
        if (!origin) return
        const moved = Math.hypot(
          event.clientX - origin.x,
          event.clientY - origin.y
        )
        if (moved > 5) return
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) return
        onToggle()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: selection requires a real pre
      role="button"
      tabIndex={0}
    >
      {text}
    </pre>
  )
}

export default function QueriesMonitorPage(): React.ReactElement {
  const [queries, setQueries] = useState<MonitoredQuery[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState<boolean>(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const stringLimit = 100

  const fetchQueries = useCallback(
    async (showSpinner = false): Promise<void> => {
      try {
        if (showSpinner) {
          setLoading(true)
        }
        const data = await getMonitoredQueries()
        queryClock.setBaseline()
        setQueries(sortQueries(data))
        setError(null)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load recent queries and updates."
        )
      } finally {
        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!paused) {
      fetchQueries(true)
    }

    const intervalId = !paused ? setInterval(fetchQueries, 5000) : undefined

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [paused, fetchQueries])

  useEffect(() => {
    queryClock.setEnabled(!paused)
  }, [paused])

  const togglePause = (): void => {
    setPaused(!paused)
  }

  const handleAbortQuery = async (queryId: string): Promise<void> => {
    try {
      await abortQuery(queryId)
      fetchQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't abort the query.")
    }
  }

  const toggleExpand = (queryId: string): void => {
    setExpanded((prev) => ({
      ...prev,
      [queryId]: !prev[queryId]
    }))
  }

  const handleDownload = (query: MonitoredQuery): void => {
    const isUpdate = query.kind === 'update'
    const blob = new Blob([query.query], {
      type: isUpdate ? 'application/sparql-update' : 'application/sparql-query'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_${query.id}.${isUpdate ? 'ru' : 'rq'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const runningCount = queries.filter((q) => q.state === 'RUNNING').length

  return (
    <DashboardShell>
      <DashboardHeader heading="Queries and updates" />
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => fetchQueries(true)}
            disabled={loading}
          >
            <RefreshCwIcon className={cn(loading && 'animate-spin')} />
            Refresh
          </Button>

          <Button
            variant={paused ? 'default' : 'outline'}
            onClick={togglePause}
          >
            {paused ? (
              <>
                <PlayIcon />
                Resume
              </>
            ) : (
              <>
                <PauseIcon />
                Pause
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && queries.length === 0 && !paused && (
          <div className="my-8 flex items-center justify-center">
            <RefreshCwIcon className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && queries.length === 0 && (
          <Alert className="mb-4">
            <AlertDescription>No queries recorded yet.</AlertDescription>
          </Alert>
        )}

        {queries.length > 0 && (
          <div className="text-muted-foreground mb-2 text-sm">
            {runningCount === 1
              ? '1 query running'
              : `${runningCount} queries running`}{' '}
            of {queries.length} in recent history.
          </div>
        )}

        {queries.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Query</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((query) => {
                  const badge = STATE_BADGES[query.state]
                  const isExpandable = query.query.length > stringLimit
                  return (
                    <TableRow key={query.id}>
                      <TableCell>
                        <Badge
                          variant={badge.variant}
                          className={cn(badge.className)}
                        >
                          {query.state}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isExpandable ? (
                          <ExpandableQueryText
                            text={
                              expanded[query.id]
                                ? query.query
                                : `${query.query.substring(0, stringLimit)}…`
                            }
                            expanded={Boolean(expanded[query.id])}
                            onToggle={() => toggleExpand(query.id)}
                          />
                        ) : (
                          <pre className="bg-muted max-h-96 w-full overflow-auto rounded-md p-2 font-mono text-xs wrap-break-words whitespace-pre-wrap">
                            {query.query}
                          </pre>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {query.origin}
                      </TableCell>
                      <TableCell className="text-xs">{query.kind}</TableCell>
                      <DurationCell query={query} />
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Download query as .${
                                  query.kind === 'update' ? 'ru' : 'rq'
                                }`}
                                onClick={() => handleDownload(query)}
                              >
                                <DownloadIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Download query as .
                              {query.kind === 'update' ? 'ru' : 'rq'}
                            </TooltipContent>
                          </Tooltip>
                          {query.state === 'RUNNING' && query.cancellable && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label="Abort query"
                                  onClick={() => handleAbortQuery(query.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Square className="fill-current" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abort this query</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
