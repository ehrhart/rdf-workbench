'use client'

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState
} from '@tanstack/react-table'
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
  XIcon
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { DownloadFormat } from '@/lib/runtime/contracts'
import { GRAPH_EXPORT_FILE_TYPES, type GraphExportFileType } from '@/lib/utils'
import {
  clearRepository,
  deleteGraph,
  getGraphTripleCount
} from '@/providers/virtuoso/capabilities'
import type { NamedGraph } from '@/types'

interface FileSystemFileHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
  }) => Promise<FileSystemFileHandle>
}

interface GraphManagerProps {
  initialGraphs: NamedGraph[]
  canManage?: boolean
  portableExportFormats?: readonly DownloadFormat[]
}

type DeleteDialogStatus = 'confirm' | 'deleting' | 'done' | 'error'

interface DeleteGraphProgress {
  initial?: number
  remaining?: number
}

interface DeleteDialogState {
  open: boolean
  uris: string[]
  status: DeleteDialogStatus
  perGraph: Record<string, DeleteGraphProgress>
  totalInitial: number
  totalRemaining: number
  currentUri?: string
  errorMessage?: string
}

type ClearDialogStatus = 'confirm' | 'clearing' | 'done' | 'error'

interface ClearDialogState {
  open: boolean
  status: ClearDialogStatus
  errorMessage?: string
}

type ExportDialogStatus = 'confirm' | 'exporting' | 'done' | 'error'

interface ExportDialogState {
  open: boolean
  uris: string[]
  fileType: GraphExportFileType | null
  status: ExportDialogStatus
  errorMessage?: string
  downloadUrl?: string
}

const POLL_INTERVAL_MS = 900
const MAX_POLL_ATTEMPTS = 240

const createDefaultDeleteState = (): DeleteDialogState => ({
  open: false,
  uris: [],
  status: 'confirm',
  perGraph: {},
  totalInitial: 0,
  totalRemaining: 0,
  currentUri: undefined,
  errorMessage: undefined
})

const createDefaultClearState = (): ClearDialogState => ({
  open: false,
  status: 'confirm',
  errorMessage: undefined
})

const createDefaultExportState = (): ExportDialogState => ({
  open: false,
  uris: [],
  fileType: null,
  status: 'confirm',
  errorMessage: undefined,
  downloadUrl: undefined
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const shortGraphName = (uri: string): string => {
  const local = uri.split(/[/#:]/).filter(Boolean).pop() ?? uri
  return local.length > 40 ? `${local.slice(0, 37)}...` : local
}

const calculateTotals = (
  perGraph: Record<string, DeleteGraphProgress>
): { initial: number; remaining: number } => {
  return Object.values(perGraph).reduce<{ initial: number; remaining: number }>(
    (acc, entry) => {
      const initial = Number.isFinite(entry.initial)
        ? (entry.initial as number)
        : 0
      const remainingCandidate = entry.remaining ?? entry.initial ?? 0
      const remaining =
        typeof remainingCandidate === 'number'
          ? Math.max(remainingCandidate, 0)
          : 0

      return {
        initial: acc.initial + initial,
        remaining: acc.remaining + remaining
      }
    },
    { initial: 0, remaining: 0 }
  )
}

export function GraphManager({
  initialGraphs,
  canManage = true,
  portableExportFormats = []
}: GraphManagerProps) {
  const router = useRouter()
  const [graphs, setGraphs] = useState<NamedGraph[]>(initialGraphs)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState>(
    createDefaultDeleteState()
  )
  const [clearDialogState, setClearDialogState] = useState<ClearDialogState>(
    createDefaultClearState()
  )
  const [exportDialogState, setExportDialogState] = useState<ExportDialogState>(
    createDefaultExportState()
  )

  useEffect(() => {
    setGraphs(initialGraphs)
  }, [initialGraphs])

  const updateGraphProgress = (
    uri: string,
    update: { initial?: number; remaining?: number }
  ) => {
    setDeleteDialogState((prev) => {
      const previous = prev.perGraph[uri] || {}
      const nextGraph: DeleteGraphProgress = {
        initial: update.initial ?? previous.initial ?? update.remaining,
        remaining: update.remaining ?? previous.remaining ?? previous.initial
      }

      const perGraph = {
        ...prev.perGraph,
        [uri]: nextGraph
      }

      const totals = calculateTotals(perGraph)

      return {
        ...prev,
        perGraph,
        totalInitial: totals.initial,
        totalRemaining: totals.remaining
      }
    })
  }

  const openDeleteDialog = (uris: string[]) => {
    if (!canManage || uris.length === 0) return

    const perGraph = uris.reduce<Record<string, DeleteGraphProgress>>(
      (acc, uri) => {
        const graph = graphs.find((item) => item.uri === uri)
        acc[uri] = {
          initial: graph?.tripleCount,
          remaining: graph?.tripleCount
        }
        return acc
      },
      {}
    )

    const totals = calculateTotals(perGraph)

    setDeleteDialogState({
      open: true,
      uris,
      perGraph,
      status: 'confirm',
      totalInitial: totals.initial,
      totalRemaining: totals.remaining,
      currentUri: undefined,
      errorMessage: undefined
    })
  }

  const resetDeleteDialog = () => {
    setDeleteDialogState(createDefaultDeleteState())
  }

  const deleteGraphWithProgress = async (uri: string) => {
    let initialEstimate = deleteDialogState.perGraph[uri]?.initial

    try {
      const liveCount = await getGraphTripleCount(uri)
      if (Number.isFinite(liveCount)) {
        initialEstimate = liveCount
      }
    } catch (error) {
      console.warn('Unable to fetch triple count for graph', uri, error)
    }

    updateGraphProgress(uri, {
      initial: initialEstimate,
      remaining: initialEstimate
    })

    await deleteGraph(uri)

    // Poll triple counts while deletion is in progress
    let attempts = 0
    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts += 1
      await sleep(POLL_INTERVAL_MS)

      try {
        const remaining = await getGraphTripleCount(uri)
        if (typeof remaining === 'number') {
          updateGraphProgress(uri, { initial: initialEstimate, remaining })
          if (remaining === 0) {
            break
          }
        }
      } catch (error) {
        console.warn('Unable to poll triple count for graph', uri, error)
      }
    }

    // Ensure we show 0 at the end
    updateGraphProgress(uri, { initial: initialEstimate, remaining: 0 })
  }

  const startDeletion = async () => {
    const uris = deleteDialogState.uris
    if (uris.length === 0) return

    setDeleteDialogState((prev) => ({
      ...prev,
      status: 'deleting',
      errorMessage: undefined
    }))

    try {
      for (const uri of uris) {
        setDeleteDialogState((prev) => ({ ...prev, currentUri: uri }))
        await deleteGraphWithProgress(uri)
      }

      setGraphs((prev) => prev.filter((graph) => !uris.includes(graph.uri)))
      setRowSelection({})

      setDeleteDialogState((prev) => ({
        ...prev,
        status: 'done',
        currentUri: undefined
      }))

      toast.success(
        uris.length === 1
          ? 'Graph deleted successfully.'
          : `${uris.length} graphs have been deleted successfully.`
      )
    } catch (error) {
      console.error('Failed during graph deletion', error)
      setDeleteDialogState((prev) => ({
        ...prev,
        status: 'error',
        currentUri: undefined,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to delete the graph(s).'
      }))
      toast.error('Failed to delete the graph(s).')
    }
  }

  const openExportDialog = (uris: string[], fileType: GraphExportFileType) => {
    if (uris.length === 0) return

    setExportDialogState({
      open: true,
      uris,
      fileType,
      status: 'confirm',
      errorMessage: undefined,
      downloadUrl: undefined
    })
  }

  const resetExportDialog = () => {
    setExportDialogState(createDefaultExportState())
  }

  const startExport = async () => {
    const { uris, fileType } = exportDialogState
    if (uris.length === 0 || !fileType) return

    setExportDialogState((prev) => ({
      ...prev,
      status: 'exporting',
      errorMessage: undefined
    }))

    try {
      const params = new URLSearchParams()
      params.set('format', fileType.contentType)
      uris.forEach((uri) => {
        params.append('graph', uri)
      })

      const response = await fetch(`/api/export?${params.toString()}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      // Create a blob from the response
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      setExportDialogState((prev) => ({
        ...prev,
        status: 'done',
        downloadUrl: url
      }))

      // Trigger download
      const filename =
        response.headers
          .get('Content-Disposition')
          ?.split('filename=')?.[1]
          ?.replace(/"/g, '') || `export-${Date.now()}.${fileType.extension}`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      toast.success(
        uris.length === 1
          ? 'Graph exported successfully.'
          : `${uris.length} graphs exported successfully.`
      )
    } catch (error) {
      console.error('Failed during graph export', error)
      setExportDialogState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to export the graph(s).'
      }))
      toast.error('Failed to export the graph(s).')
    }
  }

  const handleDeleteGraph = (uri: string) => {
    if (!canManage) return
    openDeleteDialog([uri])
  }

  const handleExportGraph = (uri: string, fileType: GraphExportFileType) => {
    openExportDialog([uri], fileType)
  }

  const handlePortableGraphExport = async (
    uri: string,
    format: DownloadFormat
  ) => {
    const filename = `graph.${format.extension}`
    const query = `CONSTRUCT { ?subject ?predicate ?object } WHERE { GRAPH <${uri}> { ?subject ?predicate ?object } }`

    let fallbackToBlob = false
    let fileHandle: FileSystemFileHandle | undefined
    // The save-file picker must be requested within the click gesture while
    // transient user activation is still valid; deferring it loses permission.
    const pickerWindow = window as SaveFilePickerWindow
    if ('showSaveFilePicker' in pickerWindow) {
      try {
        fileHandle = await pickerWindow.showSaveFilePicker?.({
          suggestedName: filename
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast.info('Download cancelled')
          return
        }
        fallbackToBlob = true
      }
    } else {
      fallbackToBlob = true
    }

    const label = shortGraphName(uri)
    const controller = new AbortController()
    const toastId = toast.loading(`Exporting ${label} as ${format.label}...`, {
      action: {
        label: 'Cancel',
        onClick: () => controller.abort()
      }
    })

    try {
      const response = await fetch('/api/sparql/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, format: format.mime, filename }),
        signal: controller.signal
      })
      if (!response.ok)
        throw new Error((await response.text()) || 'Export failed')

      if (!fallbackToBlob && fileHandle && response.body) {
        const writable = await fileHandle.createWritable()
        await response.body.pipeTo(writable)
      } else {
        const url = URL.createObjectURL(await response.blob())
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
      }

      toast.success(`Exported ${label} as ${format.label}`, { id: toastId })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info(`Export of ${label} cancelled`, { id: toastId })
        return
      }
      console.error('Failed during graph export', error)
      toast.error(
        `${label}: ${
          error instanceof Error ? error.message : 'Graph export failed'
        }`,
        { id: toastId }
      )
    }
  }

  const handleDeleteSelected = () => {
    if (!canManage) return
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedUris = selectedRows.map((row) => row.original.uri)

    if (selectedUris.length === 0) return

    openDeleteDialog(selectedUris)
  }

  const handleExportSelected = (fileType: GraphExportFileType) => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedUris = selectedRows.map((row) => row.original.uri)

    if (selectedUris.length === 0) return

    openExportDialog(selectedUris, fileType)
  }

  const handleExportRepository = (fileType: GraphExportFileType) => {
    if (graphs.length === 0) {
      toast.error('There are no graphs to export.')
      return
    }

    openExportDialog(
      graphs.map((graph) => graph.uri),
      fileType
    )
  }

  const openClearDialog = () => {
    if (!canManage) return
    setClearDialogState({
      open: true,
      status: 'confirm',
      errorMessage: undefined
    })
  }

  const resetClearDialog = () => {
    setClearDialogState(createDefaultClearState())
  }

  const startClearRepository = async () => {
    setClearDialogState((prev) => ({
      ...prev,
      status: 'clearing',
      errorMessage: undefined
    }))

    try {
      await clearRepository()

      router.refresh()
      setRowSelection({})

      setClearDialogState((prev) => ({
        ...prev,
        status: 'done'
      }))

      toast.success('Repository has been cleared successfully.')
    } catch (error) {
      console.error('Failed to clear repository:', error)
      setClearDialogState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to clear the repository.'
      }))
      toast.error('Failed to clear the repository.')
    }
  }

  // Define columns for the table
  const columns: ColumnDef<NamedGraph>[] = [
    ...(canManage
      ? [
          {
            id: 'select',
            header: ({ table }) => (
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && 'indeterminate')
                }
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
              />
            ),
            enableSorting: false,
            enableHiding: false
          } as ColumnDef<NamedGraph>
        ]
      : []),
    {
      accessorKey: 'uri',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Graph URI
            <ArrowUpDownIcon className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <Link
          href={`/resource?uri=${encodeURIComponent(row.getValue('uri'))}&role=context`}
          className="text-primary inline-flex max-w-full items-center font-mono text-sm hover:underline"
          title={row.getValue('uri')}
        >
          <span className="max-w-2xl truncate">{row.getValue('uri')}</span>
        </Link>
      )
    },
    {
      accessorKey: 'tripleCount',
      header: ({ column }) => {
        return (
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Triples
              <ArrowUpDownIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const count = row.getValue('tripleCount') as number
        return (
          <div className="text-center">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {count.toLocaleString()}
            </Badge>
          </div>
        )
      }
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const graph = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(graph.uri)
                  toast.success(`Copied graph URI to clipboard`)
                }}
              >
                <CopyIcon />
                Copy Graph URI
              </DropdownMenuItem>
              {portableExportFormats.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <DownloadIcon />
                      Download Graph
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {portableExportFormats.map((format) => (
                          <DropdownMenuItem
                            key={format.mime}
                            onClick={() =>
                              handlePortableGraphExport(graph.uri, format)
                            }
                          >
                            {format.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </>
              )}
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UploadIcon />
                      Export Graph
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {GRAPH_EXPORT_FILE_TYPES.map((type) => (
                          <DropdownMenuItem
                            key={type.name}
                            onClick={() => handleExportGraph(graph.uri, type)}
                          >
                            {type.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteGraph(graph.uri)}
                    className="text-destructive focus:text-destructive"
                  >
                    <TrashIcon className="stroke-destructive" />
                    Delete Graph
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  const table = useReactTable<NamedGraph>({
    data: graphs,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection
  })

  const deletionInProgress = deleteDialogState.status === 'deleting'
  const overallProgress =
    deleteDialogState.totalInitial > 0
      ? Math.min(
          100,
          Math.round(
            ((deleteDialogState.totalInitial -
              deleteDialogState.totalRemaining) /
              deleteDialogState.totalInitial) *
              100
          )
        )
      : undefined

  const clearingInProgress = clearDialogState.status === 'clearing'
  const exportingInProgress = exportDialogState.status === 'exporting'

  return (
    <div className="relative space-y-6 pb-24">
      <Dialog
        open={deleteDialogState.open}
        onOpenChange={(open) => {
          if (!open && !deletionInProgress) {
            resetDeleteDialog()
          }
        }}
      >
        <DialogContent showCloseButton={!deletionInProgress}>
          <DialogHeader>
            <DialogTitle>
              {deleteDialogState.uris.length > 1
                ? `Delete ${deleteDialogState.uris.length} graphs?`
                : 'Delete graph?'}
            </DialogTitle>
            <DialogDescription>
              {deleteDialogState.status === 'confirm'
                ? 'This will permanently delete all data in the selected graph(s). This action cannot be undone.'
                : 'Deleting your data. This may take a few moments for large graphs.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {deleteDialogState.status !== 'confirm' && (
              <div className="rounded-md border bg-muted/60 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Progress</span>
                  <span className="text-muted-foreground text-xs">
                    {overallProgress !== undefined
                      ? `${overallProgress}%`
                      : 'Starting...'}
                  </span>
                </div>
                <Progress value={overallProgress ?? 15} />
                <p className="text-muted-foreground text-sm">
                  {deleteDialogState.status === 'done' ? (
                    <span className="font-medium">Deletion complete</span>
                  ) : deleteDialogState.currentUri ? (
                    <>
                      <span className="font-medium">Deleting:</span>{' '}
                      <span className="font-mono text-xs">
                        {deleteDialogState.currentUri}
                      </span>
                    </>
                  ) : (
                    'Preparing deletion...'
                  )}
                </p>
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-semibold">
                {deleteDialogState.status === 'confirm'
                  ? `${deleteDialogState.uris.length} graph${deleteDialogState.uris.length === 1 ? '' : 's'} will be deleted`
                  : `Deleting ${deleteDialogState.uris.length} graph${deleteDialogState.uris.length === 1 ? '' : 's'}`}
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {deleteDialogState.uris.map((uri) => {
                  const progress = deleteDialogState.perGraph[uri]
                  const initial = progress?.initial
                  const remaining =
                    typeof progress?.remaining === 'number'
                      ? Math.max(progress.remaining, 0)
                      : undefined

                  const percent = (() => {
                    if (typeof initial === 'number' && initial > 0) {
                      const value =
                        ((initial - (remaining ?? initial)) / initial) * 100
                      return Math.min(100, Math.max(0, Math.round(value)))
                    }
                    if (remaining === 0) return 100
                    return undefined
                  })()

                  return (
                    <div
                      key={uri}
                      className="rounded-md border bg-background/50 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs break-all">{uri}</p>
                        {typeof initial === 'number' && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary"
                          >
                            {initial.toLocaleString()} triples
                          </Badge>
                        )}
                      </div>
                      {deleteDialogState.status !== 'confirm' && (
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {typeof remaining === 'number'
                              ? remaining === 0
                                ? 'Complete'
                                : `${remaining.toLocaleString()} triples left`
                              : 'Calculating...'}
                          </span>
                          {percent !== undefined && <span>{percent}%</span>}
                        </div>
                      )}
                      {deleteDialogState.status !== 'confirm' && (
                        <Progress value={percent ?? 5} className="mt-1 h-1" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {deleteDialogState.status === 'error' && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                <p className="font-semibold mb-1">Deletion failed</p>
                <p className="text-xs">
                  {deleteDialogState.errorMessage ||
                    'Unable to delete the selected graph(s). Please try again.'}
                </p>
              </div>
            )}

            {deleteDialogState.status === 'done' && (
              <div className="border-green-500/40 bg-green-500/10 text-green-600 rounded-md border p-3 text-sm">
                <p className="font-semibold">✓ Successfully deleted</p>
                <p className="text-xs mt-1">
                  {deleteDialogState.uris.length === 1
                    ? 'The graph has been permanently removed.'
                    : `All ${deleteDialogState.uris.length} graphs have been permanently removed.`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {deleteDialogState.status === 'confirm' && (
              <>
                <Button variant="outline" onClick={resetDeleteDialog}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={startDeletion}
                  disabled={deleteDialogState.uris.length === 0}
                >
                  <TrashIcon />
                  Delete
                  {deleteDialogState.uris.length > 1
                    ? ` ${deleteDialogState.uris.length} graphs`
                    : ' graph'}
                </Button>
              </>
            )}

            {deleteDialogState.status === 'deleting' && (
              <>
                <Button variant="outline" disabled>
                  Cancel
                </Button>
                <Button variant="destructive" disabled>
                  <Loader2Icon className="animate-spin" />
                  Deleting...
                </Button>
              </>
            )}

            {deleteDialogState.status === 'done' && (
              <Button onClick={resetDeleteDialog}>Close</Button>
            )}

            {deleteDialogState.status === 'error' && (
              <>
                <Button variant="outline" onClick={resetDeleteDialog}>
                  Close
                </Button>
                <Button variant="destructive" onClick={startDeletion}>
                  <TrashIcon /> Retry
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clearDialogState.open}
        onOpenChange={(open) => {
          if (!open && !clearingInProgress) {
            resetClearDialog()
          }
        }}
      >
        <DialogContent showCloseButton={!clearingInProgress}>
          <DialogHeader>
            <DialogTitle>Clear entire repository?</DialogTitle>
            <DialogDescription>
              {clearDialogState.status === 'confirm'
                ? 'This will permanently delete all RDF data from the repository. This action cannot be undone.'
                : 'Clearing the repository. This may take a few moments.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {clearDialogState.status === 'clearing' && (
              <div className="flex items-center justify-center space-x-3 rounded-md border bg-muted/60 p-6">
                <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium">Clearing repository...</p>
              </div>
            )}

            {clearDialogState.status === 'error' && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                <p className="font-semibold mb-1">Clear failed</p>
                <p className="text-xs">
                  {clearDialogState.errorMessage ||
                    'Unable to clear the repository. Please try again.'}
                </p>
              </div>
            )}

            {clearDialogState.status === 'done' && (
              <div className="border-green-500/40 bg-green-500/10 text-green-600 rounded-md border p-3 text-sm">
                <p className="font-semibold">
                  ✓ Repository cleared successfully
                </p>
                <p className="text-xs mt-1">
                  All RDF data has been permanently removed from the repository.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {clearDialogState.status === 'confirm' && (
              <>
                <Button variant="outline" onClick={resetClearDialog}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={startClearRepository}>
                  <TrashIcon />
                  Clear Repository
                </Button>
              </>
            )}

            {clearDialogState.status === 'clearing' && (
              <>
                <Button variant="outline" disabled>
                  Cancel
                </Button>
                <Button variant="destructive" disabled>
                  <Loader2Icon className="animate-spin" />
                  Clearing...
                </Button>
              </>
            )}

            {clearDialogState.status === 'done' && (
              <Button onClick={resetClearDialog}>Close</Button>
            )}

            {clearDialogState.status === 'error' && (
              <>
                <Button variant="outline" onClick={resetClearDialog}>
                  Close
                </Button>
                <Button variant="destructive" onClick={startClearRepository}>
                  <TrashIcon /> Retry
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={exportDialogState.open}
        onOpenChange={(open) => {
          if (!open && !exportingInProgress) {
            resetExportDialog()
          }
        }}
      >
        <DialogContent showCloseButton={!exportingInProgress}>
          <DialogHeader>
            <DialogTitle>
              {exportDialogState.status === 'confirm'
                ? 'Export graphs?'
                : exportDialogState.status === 'exporting'
                  ? 'Exporting graphs...'
                  : exportDialogState.status === 'done'
                    ? 'Export complete'
                    : 'Export failed'}
            </DialogTitle>
            <DialogDescription>
              {exportDialogState.status === 'confirm' &&
                `Export ${exportDialogState.uris.length} graph${exportDialogState.uris.length === 1 ? '' : 's'} as ${exportDialogState.fileType?.name}. ${exportDialogState.uris.length > 1 ? 'The download will be a ZIP archive.' : ''}`}
              {exportDialogState.status === 'exporting' &&
                'Preparing your export. This may take a few moments for large graphs.'}
              {exportDialogState.status === 'done' &&
                'Your export has been prepared and the download should start automatically.'}
              {exportDialogState.status === 'error' &&
                'An error occurred while preparing your export.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {exportDialogState.status === 'exporting' && (
              <div className="rounded-md border bg-muted/60 p-4 space-y-3">
                <div className="flex items-center justify-center space-x-3">
                  <Loader2Icon className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">Preparing export...</p>
                </div>
                <Progress value={undefined} className="h-2" />
                <p className="text-muted-foreground text-xs text-center">
                  Processing {exportDialogState.uris.length} graph
                  {exportDialogState.uris.length === 1 ? '' : 's'}
                </p>
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-semibold">
                {exportDialogState.uris.length} graph
                {exportDialogState.uris.length === 1 ? '' : 's'}
                {exportDialogState.fileType &&
                  ` · ${exportDialogState.fileType.name}`}
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {exportDialogState.uris.map((uri) => (
                  <div
                    key={uri}
                    className="rounded-md bg-background/50 px-3 py-2 text-xs font-mono break-all"
                  >
                    {uri}
                  </div>
                ))}
              </div>
            </div>

            {exportDialogState.status === 'error' && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
                <p className="font-semibold mb-1">Export failed</p>
                <p className="text-xs">
                  {exportDialogState.errorMessage ||
                    'Unable to export the selected graph(s). Please try again.'}
                </p>
              </div>
            )}

            {exportDialogState.status === 'done' && (
              <div className="border-green-500/40 bg-green-500/10 text-green-600 rounded-md border p-3 text-sm">
                <p className="font-semibold">✓ Export successful</p>
                <p className="text-xs mt-1">
                  {exportDialogState.uris.length === 1
                    ? 'The graph has been exported.'
                    : `All ${exportDialogState.uris.length} graphs have been exported.`}{' '}
                  Your download should start automatically.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {exportDialogState.status === 'confirm' && (
              <>
                <Button variant="outline" onClick={resetExportDialog}>
                  Cancel
                </Button>
                <Button onClick={startExport}>
                  <UploadIcon />
                  Export
                  {exportDialogState.uris.length > 1
                    ? ` ${exportDialogState.uris.length} graphs`
                    : ' graph'}
                </Button>
              </>
            )}

            {exportDialogState.status === 'exporting' && (
              <>
                <Button variant="outline" disabled>
                  Cancel
                </Button>
                <Button disabled>
                  <Loader2Icon className="animate-spin" />
                  Exporting...
                </Button>
              </>
            )}

            {exportDialogState.status === 'done' && (
              <Button onClick={resetExportDialog}>Close</Button>
            )}

            {exportDialogState.status === 'error' && (
              <>
                <Button variant="outline" onClick={resetExportDialog}>
                  Close
                </Button>
                <Button onClick={startExport}>
                  <UploadIcon /> Retry
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {graphs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-yellow-100 p-3">
              <SearchIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No graphs found</h3>
            <p className="text-muted-foreground mb-4 max-w-md text-center">
              The endpoint currently exposes no named graphs.
            </p>
            {canManage && (
              <div className="flex gap-2">
                <Button onClick={() => router.push('/import')}>
                  <DownloadIcon /> Import Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filter graph URIs..."
              value={(table.getColumn('uri')?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn('uri')?.setFilterValue(event.target.value)
              }
              className="flex-1 min-w-56"
            />

            {canManage && (
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!canManage}>
                      <UploadIcon /> Export Repository
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {GRAPH_EXPORT_FILE_TYPES.map((type) => (
                      <DropdownMenuItem
                        key={type.name}
                        onClick={() => handleExportRepository(type)}
                      >
                        {type.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  onClick={() => router.push('/import')}
                  variant="outline"
                  size="sm"
                >
                  <DownloadIcon /> Import Data
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={openClearDialog}
                  disabled={!canManage}
                >
                  <TrashIcon /> Clear Repository
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
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

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon />
                Previous
              </Button>
              <div className="text-muted-foreground text-sm">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Floating Bulk Actions Bar */}
      {canManage && table.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className="animate-in slide-in-from-bottom-5 fixed bottom-6 left-1/2 z-50 -translate-x-1/2 duration-300">
          <Card className="border-primary/20 bg-background/95 supports-backdrop-filter:bg-background/80 border-2 shadow-2xl backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Selection Info */}
                <div className="flex items-center gap-3 border-r pr-4">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <Checkbox
                      checked={true}
                      className="h-5 w-5"
                      aria-label="Selected items indicator"
                      onClick={() => {
                        setRowSelection({})
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {table.getFilteredSelectedRowModel().rows.length}{' '}
                      {table.getFilteredSelectedRowModel().rows.length === 1
                        ? 'graph'
                        : 'graphs'}{' '}
                      selected
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Ready for bulk actions
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="default"
                        className="gap-2"
                      >
                        <UploadIcon />
                        Export
                        <ChevronDownIcon className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {GRAPH_EXPORT_FILE_TYPES.map((type) => (
                        <DropdownMenuItem
                          key={type.name}
                          onClick={() => handleExportSelected(type)}
                        >
                          {type.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="destructive"
                    size="default"
                    onClick={handleDeleteSelected}
                    className="gap-2"
                    disabled={!canManage}
                  >
                    <TrashIcon />
                    Delete
                  </Button>

                  <div className="bg-border mx-1 h-8 w-px" />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRowSelection({})}
                    className="h-9 w-9"
                    title="Clear selection"
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
