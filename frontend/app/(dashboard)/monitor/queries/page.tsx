'use client'

import { DownloadIcon, PauseIcon, PlayIcon, RefreshCwIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardShell } from '@/components/dashboard/shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { cn, formatDuration } from '@/lib/utils'
import { abortQuery, getRunningQueries, type RunningQuery } from './actions'

export default function QueriesMonitorPage(): React.ReactElement {
  const [queries, setQueries] = useState<RunningQuery[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState<boolean>(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const stringLimit = 100

  // Track all queries ever seen, with active/inactive status
  type QueryWithActive = RunningQuery & { active: boolean }
  const [allQueries, setAllQueries] = useState<QueryWithActive[]>([])

  const fetchQueries = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const data = await getRunningQueries()
      // Mark all queries as active/inactive
      setAllQueries((prev) => {
        // Map of current query ids
        const currentIds = new Set<string>(data.map((q) => q.id))
        // Update existing queries: set active if present, inactive if not
        const updated = prev.map((q) => ({
          ...q,
          active: currentIds.has(q.id)
        }))
        // Add new queries
        const newQueries = data
          .filter((q) => !prev.some((pq) => pq.id === q.id))
          .map((q) => ({ ...q, active: true }))
        return [...updated, ...newQueries]
      })
      setQueries(data) // still keep for legacy logic if needed
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch running queries'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!paused) {
      fetchQueries()
    }

    // Set up polling interval if not paused
    const intervalId = !paused ? setInterval(fetchQueries, 5000) : undefined

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [paused, fetchQueries])

  const togglePause = (): void => {
    setPaused(!paused)
  }

  const handleAbortQuery = async (queryId?: string): Promise<void> => {
    try {
      await abortQuery(queryId)
      fetchQueries() // Refresh the list after aborting
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

  const handleDownload = async (queryId: string): Promise<void> => {
    const query = allQueries.find((q) => q.id === queryId)
    if (!query) return

    const blob = new Blob([query.query], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_${queryId}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="Running queries" />
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
            <AlertDescription>No running queries or updates.</AlertDescription>
          </Alert>
        )}

        {allQueries.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Query</TableHead>
                  <TableHead>Lifetime</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...allQueries].reverse().map((query) => (
                  <TableRow
                    key={query.id}
                    className={cn(!query.active && 'opacity-50')}
                  >
                    <TableCell className="font-mono">{query.id}</TableCell>
                    <TableCell>
                      <div className="mb-2 flex items-start">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(query.id)}
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
                        {expanded[query.id] || query.query.length <= stringLimit
                          ? query.query
                          : `${query.query.substring(0, stringLimit)}...`}
                      </pre>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          {formatDuration(query.lifetime)}
                        </TooltipTrigger>
                        <TooltipContent>{query.lifetime} ms</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {query.active && (
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
