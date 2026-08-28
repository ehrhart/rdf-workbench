'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowUpDown as ArrowUpDownIcon, PlayIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { queryHistoryService } from '@/lib/client/query-history'
import type { QueryHistoryItem } from '@/types'
import { CopyToClipboardButton } from '../prefixes/copy-to-clipboard-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export function RecentQueries() {
  const router = useRouter()
  const [queries, setQueries] = useState<QueryHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])

  const loadQueries = useCallback(() => {
    try {
      const history = queryHistoryService.getAll()
      setQueries(history)
    } catch (error) {
      console.error('Failed to load query history:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueries()
  }, [loadQueries])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'queryHistory') {
        loadQueries()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [loadQueries])

  const handleRunQuery = useCallback(
    (query: string) => {
      router.push(`/sparql?query=${encodeURIComponent(query)}`)
    },
    [router]
  )

  const columns: ColumnDef<QueryHistoryItem>[] = useMemo(
    () => [
      {
        accessorKey: 'query',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Query
            <ArrowUpDownIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const query = row.original.query

          if (query.length <= 50) {
            return <span className="font-mono text-xs">{query}</span>
          }

          return (
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default font-mono text-xs">{`${query.substring(0, 50)}...`}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md p-0">
                  <div className="relative">
                    <ScrollArea className="flex max-h-64 flex-col">
                      <pre className="p-4 pr-12 break-all whitespace-pre-wrap">
                        {query}
                      </pre>
                    </ScrollArea>
                    <CopyToClipboardButton
                      textToCopy={query}
                      className="absolute top-1 right-3 h-8 w-8"
                      successMessage="Full query copied to clipboard"
                      errorMessage="Failed to copy full query"
                    />
                  </div>
                </TooltipContent>
              </Tooltip>
              <CopyToClipboardButton
                textToCopy={query}
                className="h-8 w-8"
                tooltipText="Copy query"
                successMessage="Query copied to clipboard"
                errorMessage="Failed to copy query"
              />
            </div>
          )
        }
      },
      {
        accessorKey: 'timestamp',
        accessorFn: (row) => new Date(row.timestamp).getTime(),
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Timestamp
            <ArrowUpDownIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span>{format(new Date(row.original.timestamp), 'PPp')}</span>
        )
      },
      {
        accessorKey: 'duration',
        accessorFn: (row) => row.duration,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Duration
            <ArrowUpDownIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <span>{row.original.duration}ms</span>
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRunQuery(row.original.query)}
            >
              <PlayIcon />
              <span className="sr-only">Run</span>
            </Button>
          </div>
        )
      }
    ],
    [handleRunQuery]
  )

  const data = useMemo(() => queries.slice(0, 5), [queries])

  const table = useReactTable<QueryHistoryItem>({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Queries</CardTitle>
        <CardDescription>Your recently executed SPARQL queries</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : queries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">
            No recent queries found
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
