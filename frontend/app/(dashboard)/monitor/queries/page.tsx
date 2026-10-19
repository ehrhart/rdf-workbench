'use client'

import { cn } from 'cn'
import { DownloadIcon, PauseIcon, PlayIcon, RefreshCwIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

export default function QueriesMonitorPage(): React.ReactElement {
  const [queries, setQueries] = useState<MonitoredQuery[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState<boolean>(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const stringLimit = 100

  const fetchQueries = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const data = await getMonitoredQueries()
      setQueries(sortQueries(data))
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch monitored queries'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!paused) {
      fetchQueries()
    }

    const intervalId = !paused ? setInterval(fetchQueries, 5000) : undefined

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [paused, fetchQueries])

  const togglePause = (): void => {
    setPaused(!paused)
  }

  const handleAbortQuery = async (queryId: string): Promise<void> => {
    try {
      await abortQuery(queryId)
      fetchQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort query')
    }
  }

  const toggleExpand = (queryId: string): void => {
    setExpanded((prev) => ({
      ...prev,
      [queryId]: !prev[queryId]
    }))
  }

  const handleDownload = (query: MonitoredQuery): void => {
    const blob = new Blob([query.query], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_${query.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const runningCount = queries.filter((q) => q.state === 'RUNNING').length

  return (
    <DashboardShell>
      <DashboardHeader heading="Query monitor" />
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="outline" onClick={fetchQueries} disabled={loading}>
            <RefreshCwIcon />
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

        {loading && !paused && (
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
            of {queries.length} in the recent history.
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
                        <div className="mb-2 flex items-start">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(query)}
                            className="mr-2"
                          >
                            <DownloadIcon />
                          </Button>
                          {query.query.length > stringLimit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpand(query.id)}
                            >
                              {expanded[query.id] ? 'Show Less' : 'Show More'}
                            </Button>
                          )}
                        </div>
                        <pre
                          className={`bg-muted max-h-96 w-full overflow-auto rounded-md p-2 text-xs wrap-break-words whitespace-pre-wrap`}
                        >
                          {expanded[query.id] ||
                          query.query.length <= stringLimit
                            ? query.query
                            : `${query.query.substring(0, stringLimit)}...`}
                        </pre>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {query.origin}
                      </TableCell>
                      <TableCell className="text-xs">{query.kind}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            {formatDuration(query.lifetime)}
                          </TooltipTrigger>
                          <TooltipContent>
                            {query.durationMs !== undefined
                              ? `${query.durationMs} ms`
                              : `${query.lifetime} ms so far`}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {query.state === 'RUNNING' && query.cancellable && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleAbortQuery(query.id)}
                              >
                                Abort
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Click to abort this query
                            </TooltipContent>
                          </Tooltip>
                        )}
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
