'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { Copy, Play, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { QueryHistoryService } from '@/lib/client/query-history'
import { queryHistoryService } from '@/lib/client/query-history'
import { cn, formatDuration } from '@/lib/utils'
import type { QueryHistoryItem } from '@/types'

type SortOption = 'newest' | 'oldest' | 'fastest' | 'slowest'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  fastest: 'Fastest first',
  slowest: 'Slowest first'
}

interface QueryHistoryProps {
  onSelectQueryAction?: (query: string) => void
  service?: QueryHistoryService
  queryNoun?: string
  emptyHistoryMessage?: string
}

export function QueryHistory({
  onSelectQueryAction,
  service = queryHistoryService,
  queryNoun = 'SPARQL query',
  emptyHistoryMessage
}: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { storageKey, eventName } = service

  const refreshHistory = useCallback(() => {
    setHistory(service.getAll())
  }, [service])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    const handleUpdate: EventListener = () => {
      refreshHistory()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        refreshHistory()
      }
    }

    window.addEventListener(eventName, handleUpdate)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(eventName, handleUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [eventName, refreshHistory, storageKey])

  const filteredHistory = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = normalizedSearch
      ? history.filter((item) =>
          item.query.toLowerCase().includes(normalizedSearch)
        )
      : [...history]

    return filtered.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime()
      const bTime = new Date(b.timestamp).getTime()

      switch (sortOption) {
        case 'oldest':
          return aTime - bTime
        case 'fastest':
          return a.duration - b.duration
        case 'slowest':
          return b.duration - a.duration
        default:
          return bTime - aTime
      }
    })
  }, [history, searchTerm, sortOption])

  useEffect(() => {
    if (!expandedId) {
      return
    }

    if (!filteredHistory.some((item) => item.id === expandedId)) {
      setExpandedId(null)
    }
  }, [expandedId, filteredHistory])

  const handleClearAll = useCallback(() => {
    if (!history.length) {
      return
    }

    if (confirm('Are you sure you want to clear all query history?')) {
      service.clear()
      setExpandedId(null)
      toast.success('Query history cleared')
    }
  }, [history.length, service])

  const handleDelete = useCallback(
    (id: string) => {
      service.delete(id)
      setExpandedId((current) => (current === id ? null : current))
      toast.success('Query removed from history')
    },
    [service]
  )

  const handleToggleItem = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }, [])

  const handleCopy = useCallback(async (query: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(query)
      toast.success('Query copied to clipboard')
    } catch (error) {
      console.error('Failed to copy query:', error)
      toast.error('Failed to copy query')
    }
  }, [])

  const totalCount = history.length
  const filteredCount = filteredHistory.length

  const countLabel = useMemo(() => {
    const pluralize = (count: number) => (count === 1 ? 'query' : 'queries')

    if (totalCount === 0) {
      return (
        emptyHistoryMessage ??
        `We keep every ${queryNoun} you run so you can revisit them later.`
      )
    }

    if (searchTerm.trim()) {
      return `Showing ${filteredCount} of ${totalCount} saved ${pluralize(totalCount)}.`
    }

    return `You have ${totalCount} saved ${pluralize(totalCount)}.`
  }, [emptyHistoryMessage, filteredCount, queryNoun, searchTerm, totalCount])

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="gap-4 pb-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Query History</CardTitle>
            <CardDescription>{countLabel}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshHistory}
            >
              <RefreshCw className="mr-1 size-4" aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={!history.length}
            >
              Clear All
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-xs">
            <Search
              className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search saved queries"
              className="pl-10"
            />
          </div>
          <Select
            value={sortOption}
            onValueChange={(value: SortOption) => setSortOption(value)}
          >
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <SelectItem key={option} value={option}>
                  {SORT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-6 pb-6">
        {totalCount === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {emptyHistoryMessage ??
              `Run a ${queryNoun} and we will save it here automatically.`}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No saved queries match your filters.
            </p>
            {searchTerm.trim() ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
              >
                Clear search
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => {
              const isExpanded = expandedId === item.id
              const distance = formatDistanceToNow(new Date(item.timestamp), {
                addSuffix: true
              })

              return (
                <article
                  key={item.id}
                  className={cn(
                    'group border rounded-lg bg-background/70 p-4 transition-colors',
                    isExpanded
                      ? 'border-primary/70 bg-accent/30'
                      : 'border-border/70 hover:border-primary/20 hover:bg-accent/20'
                  )}
                >
                  <div
                    // role="button"
                    // onClick={() => handleToggleItem(item.id)}
                    // onKeyDown={(e) => {
                    //   if (e.key === 'Enter' || e.key === ' ') {
                    //     e.preventDefault()
                    //     handleToggleItem(item.id)
                    //   }
                    // }}
                    // tabIndex={0}
                    // aria-expanded={isExpanded}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{distance}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate">
                          {format(new Date(item.timestamp), 'PPpp')}
                        </span>
                        <Badge variant="secondary" className="w-fit">
                          {formatDuration(item.duration)}
                        </Badge>
                        <div className="flex flex-wrap justify-end gap-2 ml-auto">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(item.query)}
                          >
                            <Copy className="mr-2 size-4" aria-hidden />
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="mr-2 size-4" aria-hidden />
                            Delete
                          </Button>
                          {onSelectQueryAction ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onSelectQueryAction(item.query)}
                            >
                              <Play className="mr-2 size-4" aria-hidden />
                              Use in Editor
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <pre
                        onClick={() => handleToggleItem(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleToggleItem(item.id)
                          }
                        }}
                        className={cn(
                          'max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border bg-muted/30 p-3 font-mono leading-relaxed text-foreground text-sm/snug cursor-pointer',
                          isExpanded
                            ? ''
                            : 'max-h-32 overflow-hidden opacity-80'
                        )}
                        style={
                          !isExpanded
                            ? {
                                boxShadow:
                                  'inset 0 -10px 10px -10px rgba(0,0,0,0.1)'
                              }
                            : undefined
                        }
                      >
                        {item.query}
                      </pre>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
