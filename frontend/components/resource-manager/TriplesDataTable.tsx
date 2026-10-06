import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  EyeIcon,
  SearchIcon,
  XIcon
} from 'lucide-react'
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import { ColumnFilterDropdown } from '@/components/tables/ColumnFilterDropdown'
import {
  customFilterFn,
  customGlobalFilterFn,
  customSortingFn
} from '@/components/tables/filter-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { InputGroup, InputGroupIcon, InputGroupInput } from '../ui/input-group'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './constants'
import { ResourceLink } from './ResourceLink'
import type { AppStatus, RDFNode, ResourceInfo, Triple } from './types'

// --- Column Definitions ---

const createColumns = (): ColumnDef<Triple>[] => [
  {
    id: 'index',
    header: '#',
    size: 40,
    cell: ({ row }) => (
      <div className="text-muted-foreground text-center text-xs">
        {row.index + 1}
      </div>
    ),
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false
  },
  {
    id: 'subject',
    size: 240,
    header: ({ column }) => (
      <div className="-ml-2 flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => column.toggleSorting()}
        >
          Subject{' '}
          {column.getIsSorted() === 'asc' ? (
            <ArrowUpIcon className="ml-2 h-3.5 w-3.5" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDownIcon className="ml-2 h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          )}
        </Button>
        <ColumnFilterDropdown column={column} />
      </div>
    ),
    accessorFn: (row) => row.subject,
    cell: ({ getValue }) => <ResourceLink node={getValue<RDFNode>()} />,
    filterFn: customFilterFn,
    sortingFn: customSortingFn
  },
  {
    id: 'predicate',
    size: 240,
    header: ({ column }) => (
      <div className="-ml-2 flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => column.toggleSorting()}
        >
          Predicate{' '}
          {column.getIsSorted() === 'asc' ? (
            <ArrowUpIcon className="ml-2 h-3.5 w-3.5" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDownIcon className="ml-2 h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          )}
        </Button>
        <ColumnFilterDropdown column={column} />
      </div>
    ),
    accessorFn: (row) => row.predicate,
    cell: ({ getValue }) => <ResourceLink node={getValue<RDFNode>()} />,
    filterFn: customFilterFn,
    sortingFn: customSortingFn
  },
  {
    id: 'object',
    size: 320,
    header: ({ column }) => (
      <div className="-ml-2 flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => column.toggleSorting()}
        >
          Object{' '}
          {column.getIsSorted() === 'asc' ? (
            <ArrowUpIcon className="ml-2 h-3.5 w-3.5" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDownIcon className="ml-2 h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          )}
        </Button>
        <ColumnFilterDropdown column={column} />
      </div>
    ),
    accessorFn: (row) => row.object,
    cell: ({ getValue }) => <ResourceLink node={getValue<RDFNode>()} />,
    filterFn: customFilterFn,
    sortingFn: customSortingFn
  },
  {
    id: 'context',
    size: 200,
    header: ({ column }) => (
      <div className="-ml-2 flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => column.toggleSorting()}
        >
          Context{' '}
          {column.getIsSorted() === 'asc' ? (
            <ArrowUpIcon className="ml-2 h-3.5 w-3.5" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDownIcon className="ml-2 h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          )}
        </Button>
        <ColumnFilterDropdown column={column} />
      </div>
    ),
    accessorFn: (row) => row.context,
    cell: ({ getValue }) => <ResourceLink node={getValue<RDFNode>()} />,
    filterFn: customFilterFn,
    sortingFn: customSortingFn
  }
]

// --- Main Component ---

interface TriplesDataTableProps {
  triples: Triple[]
  status: AppStatus
  error: string | null
  resourceInfo: ResourceInfo | null
}

export const TriplesDataTable = memo(function TriplesDataTable({
  triples,
  status,
  error,
  resourceInfo
}: TriplesDataTableProps) {
  const [globalFilter, setGlobalFilter] = useState<string>('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE
  })
  const [rowSelection, setRowSelection] = useState({})
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>(
    {}
  )
  const [compactView, setCompactView] = useState(false)

  const columns = useMemo(() => createColumns(), [])

  // Reset pagination and filters when resource changes
  useEffect(() => {
    const nextUri = resourceInfo?.uri
    const nextRole = resourceInfo?.role

    void nextUri
    void nextRole

    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([])
    setExpandedCells({})
  }, [resourceInfo?.uri, resourceInfo?.role])

  const toggleCellExpansion = useCallback((cellId: string) => {
    setExpandedCells((previous) => {
      const nextState = { ...previous }
      if (nextState[cellId]) {
        delete nextState[cellId]
      } else {
        nextState[cellId] = true
      }
      return nextState
    })
  }, [])

  const handleCellClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, cellId: string) => {
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) {
        return
      }

      const target = event.target as HTMLElement
      const interactive = target.closest(
        'a[href], button, input, textarea, [role="button"], [role="link"]'
      )
      if (interactive && interactive !== event.currentTarget) {
        return
      }

      toggleCellExpansion(cellId)
    },
    [toggleCellExpansion]
  )

  const handleCellKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, cellId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggleCellExpansion(cellId)
      }
    },
    [toggleCellExpansion]
  )

  const handleCompactViewChange = useCallback((checked: boolean) => {
    setCompactView(checked)
    setExpandedCells({})
  }, [])

  const table = useReactTable<Triple>({
    data: triples,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getColumnCanGlobalFilter: (column) => column.id !== 'index',
    enableGlobalFilter: true,
    globalFilterFn: customGlobalFilterFn,
    autoResetPageIndex: false,
    enableSorting: true,
    enableSortingRemoval: true
  })

  const isLoading = status === 'loading'
  const { rows } = table.getRowModel()
  const visibleColumns = table.getVisibleLeafColumns()
  const totalVisibleSize = visibleColumns.reduce(
    (total, column) => total + column.getSize(),
    0
  )
  const skeletonRowIds = useMemo(
    () =>
      Array.from(
        { length: pagination.pageSize },
        (_, idx) => `skeleton-${idx}`
      ),
    [pagination.pageSize]
  )

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InputGroup className="relative max-w-xs grow sm:grow-0">
          <InputGroupIcon position="left">
            <SearchIcon className="size-4" />
          </InputGroupIcon>
          <InputGroupInput
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-10 pr-10 h-8"
          />
          {globalFilter && (
            <InputGroupIcon position="right">
              <XIcon
                className="size-4 cursor-pointer"
                onClick={() => setGlobalFilter('')}
              />
            </InputGroupIcon>
          )}
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <EyeIcon /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id === 'index'
                        ? '#'
                        : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <Switch
              id="triples-compact-view-toggle"
              checked={compactView}
              onCheckedChange={handleCompactViewChange}
            />
            <Label htmlFor="triples-compact-view-toggle" className="text-sm">
              Compact view
            </Label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full table-fixed caption-bottom border-collapse text-sm">
          <thead className="[&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0"
                    style={{
                      width: `${(header.getSize() / totalVisibleSize) * 100}%`
                    }}
                  >
                    {!header.isPlaceholder &&
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              // Skeleton Loader
              skeletonRowIds.map((rowId) => (
                <tr
                  key={rowId}
                  className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={`${col.id}-${rowId}`}
                      className="p-4 align-middle [&:has([role=checkbox])]:pr-0"
                    >
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isIndexCell = cell.column.id === 'index'
                    const isExpanded = expandedCells[cell.id]

                    return (
                      <td key={cell.id} className="p-4 align-top">
                        {isIndexCell ? (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )
                        ) : compactView ? (
                          // biome-ignore lint/a11y/useSemanticElements: cell renders interactive links, so a native button is not valid here
                          <div
                            className={cn(
                              'relative block max-w-full cursor-pointer',
                              {
                                truncate: !isExpanded,
                                'whitespace-normal wrap-break-word': isExpanded
                              }
                            )}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={(event) => handleCellClick(event, cell.id)}
                            onKeyDown={(event) =>
                              handleCellKeyDown(event, cell.id)
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        ) : (
                          <div className="whitespace-normal wrap-break-word">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            ) : (
              // No Results
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {status === 'error' ? (
                    <Card className="border-destructive bg-destructive/10 rounded-t-none rounded-b-md">
                      <CardContent className="text-destructive pt-4 text-left text-sm">
                        <p className="font-medium">Query error:</p>
                        <p>{error}</p>
                      </CardContent>
                    </Card>
                  ) : status === 'success' && triples.length === 0 ? (
                    'No triples found for this resource and role.'
                  ) : (
                    'No results matching filters.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-muted-foreground text-sm">
          Showing {table.getPaginationRowModel().rows.length.toLocaleString()}{' '}
          of {table.getFilteredRowModel().rows.length.toLocaleString()} row(s)
          filtered. (Total: {triples.length.toLocaleString()})
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Rows per page:</span>
          <Select
            value={`${pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder={pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm">
            Page {pagination.pageIndex + 1} of{' '}
            {table.getPageCount()?.toLocaleString() ?? 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
            <span className="sr-only">First page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
            <span className="sr-only">Next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
            <span className="sr-only">Last page</span>
          </Button>
        </div>
      </div>
    </div>
  )
})
