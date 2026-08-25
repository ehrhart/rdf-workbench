'use client'

import {
  type ColumnFiltersState,
  type ColumnResizeMode,
  type ColumnSizingInfoState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  type Updater,
  useReactTable,
  type VisibilityState
} from '@tanstack/react-table'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  customFilterFn,
  customGlobalFilterFn
} from '@/components/tables/filter-fns'
import { compareValues } from '@/components/tables/value-utils'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type {
  SparqlBindingsResult,
  SparqlBindingValue,
  SparqlQueryResult
} from '@/types'
import {
  InputGroup,
  InputGroupIcon,
  InputGroupInput
} from '../../ui/input-group'
import { calculateTableSizing } from '../calculate-table-sizing'
import { createColumns, type SparqlResultRow } from './table-columns'
import {
  createDefaultColumnSizingInfo,
  DEFAULT_PAGE_SIZE,
  INDEX_COLUMN_ID,
  PAGE_SIZES,
  resolveUpdater
} from './table-utils'

interface ResultsTableProps {
  results: SparqlQueryResult
}
const escapeColumnIdForSelector = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }

  return value.replace(/['"\\]/g, '\\$&')
}

const BindingsResultsTable = ({
  results
}: {
  results: SparqlBindingsResult
}) => {
  const variables = useMemo(() => results.variables, [results.variables])
  const bindings = useMemo(() => results.bindings, [results.bindings])

  const data = useMemo<SparqlResultRow[]>(() => {
    return bindings.map((binding, index) => {
      const row: SparqlResultRow = { __index: index }

      for (const variable of variables) {
        row[variable] = binding[variable] ?? null
      }

      return row
    })
  }, [bindings, variables])

  const columns = useMemo(() => createColumns(variables), [variables])

  const [globalFilter, setGlobalFilter] = useState<string>('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE
  })
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnSizingInfo, setColumnSizingInfo] =
    useState<ColumnSizingInfoState>(() => createDefaultColumnSizingInfo())
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [compactView, setCompactView] = useState(false)
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>(
    {}
  )
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange')
  const [manualRecalculateVersion, setManualRecalculateVersion] = useState(0)
  const userResizedRef = useRef(false)
  const lastResizedColumnIdRef = useRef<string | null>(null)
  const manualSizingEpochRef = useRef(0)
  const manuallyResizedColumnsRef = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const container = tableContainerRef.current
    if (!container) return

    const updateWidth = (nextWidth: number) => {
      setContainerWidth((previousWidth) =>
        Math.abs(previousWidth - nextWidth) > 0.5 ? nextWidth : previousWidth
      )
    }

    updateWidth(container.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      const handleWindowResize = () => {
        updateWidth(container.clientWidth)
      }

      window.addEventListener('resize', handleWindowResize)
      return () => window.removeEventListener('resize', handleWindowResize)
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          updateWidth(entry.contentRect.width)
        }
      }
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  const variablesSignature = useMemo(() => variables.join('|'), [variables])
  const columnVisibilitySignature = useMemo(
    () => JSON.stringify(columnVisibility),
    [columnVisibility]
  )
  const columnSizingSignature = useMemo(
    () => JSON.stringify(columnSizing),
    [columnSizing]
  )

  useEffect(() => {
    const nextRowCount = bindings.length
    const nextVariableCount = variables.length

    void nextRowCount
    void nextVariableCount

    userResizedRef.current = false
    lastResizedColumnIdRef.current = null
    manualSizingEpochRef.current += 1
    manuallyResizedColumnsRef.current.clear()

    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([])
    setRowSelection({})
    setColumnSizing({})
    setColumnSizingInfo(createDefaultColumnSizingInfo())
  }, [bindings.length, variables.length])

  useEffect(() => {
    void compactView
    setExpandedCells({})
    setManualRecalculateVersion((previous) => previous + 1)
  }, [compactView])

  useEffect(() => {
    if (columnSizingInfo.isResizingColumn !== false) {
      userResizedRef.current = true
      if (typeof columnSizingInfo.isResizingColumn === 'string') {
        lastResizedColumnIdRef.current = columnSizingInfo.isResizingColumn
        manuallyResizedColumnsRef.current.set(
          columnSizingInfo.isResizingColumn,
          manualSizingEpochRef.current
        )
      }
    }
  }, [columnSizingInfo.isResizingColumn])

  const handleColumnSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((previous) => resolveUpdater(updater, previous))
    },
    []
  )

  const handleColumnSizingInfoChange = useCallback(
    (updater: Updater<ColumnSizingInfoState>) => {
      setColumnSizingInfo((previous) => resolveUpdater(updater, previous))
    },
    []
  )

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
      if (!compactView) return

      const target = event.target as HTMLElement
      const currentTarget = event.currentTarget as HTMLElement
      const linkElement = target.closest('a[href]')
      const isTruncated =
        currentTarget.scrollWidth > currentTarget.offsetWidth ||
        currentTarget.scrollHeight > currentTarget.offsetHeight

      if (linkElement) {
        if (isTruncated) {
          event.preventDefault()
          event.stopPropagation()
          toggleCellExpansion(cellId)
        }
        return
      }

      if (
        target.closest(
          'button, input, textarea, [role="button"], [role="link"]'
        )
      ) {
        return
      }

      if (isTruncated) {
        toggleCellExpansion(cellId)
      }
    },
    [compactView, toggleCellExpansion]
  )

  const handleCellKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, cellId: string) => {
      if (!compactView) return

      if (event.key === 'Enter' || event.key === ' ') {
        const currentTarget = event.currentTarget as HTMLElement
        const isTruncated =
          currentTarget.scrollWidth > currentTarget.offsetWidth ||
          currentTarget.scrollHeight > currentTarget.offsetHeight

        if (isTruncated) {
          event.preventDefault()
          toggleCellExpansion(cellId)
        }
      }
    },
    [compactView, toggleCellExpansion]
  )

  const handlePaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      setPagination((previous) => {
        const next = resolveUpdater(updater, previous)
        if (next.pageSize !== previous.pageSize) {
          next.pageIndex = 0
        }
        return next
      })
    },
    []
  )

  const table = useReactTable<SparqlResultRow>({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
      columnSizing,
      columnSizingInfo
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
    onPaginationChange: handlePaginationChange,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnSizingInfoChange: handleColumnSizingInfoChange,
    globalFilterFn: 'customGlobalFilter',
    filterFns: {
      customFilter: customFilterFn,
      customGlobalFilter: customGlobalFilterFn
    },
    sortingFns: {
      customSorting: (rowA, rowB, columnId) =>
        compareValues(rowA.getValue(columnId), rowB.getValue(columnId))
    },
    getColumnCanGlobalFilter: (column) => column.id !== INDEX_COLUMN_ID,
    getRowId: (row) => `${row.__index}`,
    autoResetPageIndex: false,
    enableGlobalFilter: true,
    enableSorting: true,
    enableSortingRemoval: true,
    enableColumnResizing: true,
    columnResizeMode
  })

  const recalcColumnSizing = useCallback(
    (options?: { force?: boolean }) => {
      if (!containerWidth) return

      void variablesSignature
      void columnVisibilitySignature

      if (!options?.force && userResizedRef.current) {
        return
      }

      const headers = table
        .getFlatHeaders()
        .filter((header) => header.column.getIsVisible())

      if (headers.length === 0) return

      const nextSizing = calculateTableSizing(headers, containerWidth)
      const currentSizing = table.getState().columnSizing

      let shouldUpdate = options?.force ?? false

      if (!shouldUpdate) {
        shouldUpdate =
          headers.length !== Object.keys(currentSizing).length ||
          headers.some((header) => {
            const key = header.id
            const plannedSize = nextSizing[key]
            const existingSize = currentSizing[key]

            if (typeof plannedSize !== 'number') {
              return true
            }

            if (typeof existingSize !== 'number') {
              return true
            }

            return Math.abs(plannedSize - existingSize) > 0.5
          })
      }

      if (!shouldUpdate) return

      table.setColumnSizing(nextSizing)
      setColumnSizingInfo(createDefaultColumnSizingInfo())
      userResizedRef.current = false
      if (options?.force) {
        manualSizingEpochRef.current += 1
        manuallyResizedColumnsRef.current.clear()
      }
    },
    [containerWidth, table, columnVisibilitySignature, variablesSignature]
  )

  useLayoutEffect(() => {
    if (manualRecalculateVersion === 0) return
    recalcColumnSizing({ force: true })
  }, [manualRecalculateVersion, recalcColumnSizing])

  const { rows } = table.getRowModel()
  const localRowCount = data.length
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const currentPageRows = rows.length
  const headerScrollRef = useRef<HTMLDivElement | null>(null)
  const bodyScrollRef = useRef<HTMLDivElement | null>(null)
  const measurementContainerRef = useRef<HTMLDivElement | null>(null)
  const stickyScrollRef = useRef<HTMLDivElement | null>(null)
  const isSyncingScrollRef = useRef(false)
  const tableTotalSize = table.getTotalSize()
  const shouldShowStickyScrollbar = tableTotalSize > containerWidth + 1

  const startRowNumber =
    pagination.pageIndex * pagination.pageSize + (currentPageRows > 0 ? 1 : 0)
  const endRowNumber =
    pagination.pageIndex * pagination.pageSize + currentPageRows
  const effectiveTotalRows = localRowCount
  const canGoNext = table.getCanNextPage()
  const canGoPrevious = table.getCanPreviousPage()
  const canGoLast = canGoNext

  useEffect(() => {
    return () => {
      if (measurementContainerRef.current) {
        measurementContainerRef.current.remove()
        measurementContainerRef.current = null
      }
    }
  }, [])

  const ensureMeasurementContainer = useCallback(() => {
    if (typeof document === 'undefined') return null
    if (!measurementContainerRef.current) {
      const element = document.createElement('div')
      element.setAttribute('data-column-measure-root', 'true')
      Object.assign(element.style, {
        position: 'absolute',
        visibility: 'hidden',
        left: '-9999px',
        top: '-9999px',
        pointerEvents: 'none',
        width: 'auto',
        height: 'auto',
        maxWidth: 'none',
        maxHeight: 'none',
        overflow: 'visible',
        whiteSpace: 'normal',
        zIndex: '-1'
      })
      document.body.appendChild(element)
      measurementContainerRef.current = element
    }

    return measurementContainerRef.current
  }, [])

  const measureColumnContentWidth = useCallback(
    (columnId: string) => {
      if (typeof document === 'undefined') return null
      const measurementRoot = ensureMeasurementContainer()
      if (!measurementRoot) return null

      const escapedId = escapeColumnIdForSelector(columnId)

      const collectNodes = (root: HTMLElement | null) => {
        if (!root) return [] as HTMLElement[]
        return Array.from(
          root.querySelectorAll<HTMLElement>(`[data-column-id="${escapedId}"]`)
        )
      }

      const nodes = [
        ...collectNodes(headerScrollRef.current),
        ...collectNodes(bodyScrollRef.current)
      ]

      if (nodes.length === 0) {
        return null
      }

      let maxWidth = 0

      for (const node of nodes) {
        const clone = node.cloneNode(true) as HTMLElement
        clone.style.width = 'auto'
        clone.style.minWidth = 'max-content'
        clone.style.maxWidth = 'none'
        clone.style.position = 'relative'
        clone.style.display = 'inline-block'
        clone.style.overflow = 'visible'
        clone.style.textOverflow = 'clip'
        clone.style.whiteSpace = 'normal'
        clone.style.flex = 'initial'
        clone.classList.remove('truncate')
        clone.querySelectorAll<HTMLElement>('.truncate').forEach((element) => {
          element.classList.remove('truncate')
          element.style.whiteSpace = 'normal'
          element.style.textOverflow = 'clip'
        })

        measurementRoot.appendChild(clone)
        const width = Math.ceil(clone.getBoundingClientRect().width)
        measurementRoot.removeChild(clone)

        if (width > maxWidth) {
          maxWidth = width
        }
      }

      return maxWidth
    },
    [ensureMeasurementContainer]
  )

  const autoFitColumn = useCallback(
    (columnId: string) => {
      const measuredWidth = measureColumnContentWidth(columnId)
      if (!measuredWidth) {
        return
      }

      const column = table.getColumn(columnId)
      if (!column) {
        return
      }

      const minSize =
        typeof column.columnDef.minSize === 'number'
          ? column.columnDef.minSize
          : 0
      const maxSize =
        typeof column.columnDef.maxSize === 'number' &&
        Number.isFinite(column.columnDef.maxSize)
          ? column.columnDef.maxSize
          : Number.MAX_SAFE_INTEGER

      const nextSize = Math.min(Math.max(measuredWidth, minSize), maxSize)

      table.setColumnSizing((previous) => ({
        ...previous,
        [columnId]: nextSize
      }))

      userResizedRef.current = true
      lastResizedColumnIdRef.current = columnId
      manuallyResizedColumnsRef.current.set(
        columnId,
        manualSizingEpochRef.current
      )
      setColumnSizingInfo((previous) => ({
        ...previous,
        isResizingColumn: false,
        deltaOffset: null,
        deltaPercentage: null
      }))
    },
    [measureColumnContentWidth, table]
  )

  const syncScroll = useCallback((source: 'header' | 'body' | 'sticky') => {
    if (!headerScrollRef.current || !bodyScrollRef.current) return

    const stickyElement = stickyScrollRef.current

    if (source === 'sticky' && !stickyElement) {
      return
    }

    const nextScrollLeft =
      source === 'header'
        ? headerScrollRef.current.scrollLeft
        : source === 'body'
          ? bodyScrollRef.current.scrollLeft
          : (stickyElement?.scrollLeft ?? 0)

    if (isSyncingScrollRef.current) return
    isSyncingScrollRef.current = true

    if (source !== 'header') {
      headerScrollRef.current.scrollLeft = nextScrollLeft
    }

    if (source !== 'body') {
      bodyScrollRef.current.scrollLeft = nextScrollLeft
    }

    if (stickyElement && source !== 'sticky') {
      stickyElement.scrollLeft = nextScrollLeft
    }

    isSyncingScrollRef.current = false
  }, [])

  useLayoutEffect(() => {
    if (!containerWidth) return
    if (columnSizingInfo.isResizingColumn !== false) return

    void columnVisibilitySignature
    void variablesSignature
    void columnSizingSignature

    if (userResizedRef.current) {
      userResizedRef.current = false
      return
    }

    const totalSize = table.getTotalSize()
    if (!Number.isFinite(totalSize)) return

    const remainder = containerWidth - totalSize
    const REMAINDER_EPSILON = 1

    if (remainder <= REMAINDER_EPSILON) {
      return
    }

    const visibleHeaders = table
      .getFlatHeaders()
      .filter((header) => header.column.getIsVisible())

    if (visibleHeaders.length === 0) return

    const manualColumns = manuallyResizedColumnsRef.current
    const currentManualEpoch = manualSizingEpochRef.current
    const growHeaders = visibleHeaders.filter(
      (header) =>
        header.column.columnDef.meta?.isGrow === true &&
        manualColumns.get(header.column.id) !== currentManualEpoch
    )
    const fallbackHeaders =
      visibleHeaders.length > growHeaders.length
        ? visibleHeaders.filter(
            (header) =>
              manualColumns.get(header.column.id) !== currentManualEpoch
          )
        : []

    const candidateHeaders = (
      growHeaders.length > 0
        ? growHeaders
        : fallbackHeaders.length > 0
          ? fallbackHeaders
          : visibleHeaders
    ).filter(
      (header) => manualColumns.get(header.column.id) !== currentManualEpoch
    )

    if (candidateHeaders.length === 0) return

    let remaining = remainder
    const sizingUpdates = new Map<string, number>()

    const allocationPool = candidateHeaders.map((header) => {
      const columnDef = header.column.columnDef
      const maxSize =
        typeof columnDef.maxSize === 'number' &&
        Number.isFinite(columnDef.maxSize)
          ? columnDef.maxSize
          : Number.MAX_SAFE_INTEGER

      return { header, maxSize }
    })

    while (remaining > REMAINDER_EPSILON && allocationPool.length > 0) {
      const share = remaining / allocationPool.length
      let distributedThisRound = 0

      for (const { header, maxSize } of allocationPool) {
        if (remaining <= REMAINDER_EPSILON) {
          break
        }

        const currentSize =
          sizingUpdates.get(header.column.id) ?? header.getSize()
        const available = maxSize - currentSize

        if (available <= REMAINDER_EPSILON) {
          continue
        }

        const delta = Math.min(available, share)

        if (delta <= REMAINDER_EPSILON) {
          continue
        }

        sizingUpdates.set(header.column.id, currentSize + delta)
        remaining -= delta
        distributedThisRound += delta
      }

      if (distributedThisRound <= REMAINDER_EPSILON) {
        break
      }

      for (let index = allocationPool.length - 1; index >= 0; index -= 1) {
        const { header, maxSize } = allocationPool[index]
        const currentSize =
          sizingUpdates.get(header.column.id) ?? header.getSize()

        if (maxSize - currentSize <= REMAINDER_EPSILON) {
          allocationPool.splice(index, 1)
        }
      }
    }

    if (sizingUpdates.size === 0) {
      return
    }

    table.setColumnSizing((previous) => {
      const next = { ...previous }
      for (const [columnId, size] of sizingUpdates) {
        next[columnId] = size
      }
      return next
    })
  }, [
    columnSizingInfo.isResizingColumn,
    columnVisibilitySignature,
    containerWidth,
    table,
    variablesSignature,
    columnSizingSignature
  ])

  if (variables.length === 0) {
    return <div className="p-4">No results to display</div>
  }

  return (
    <div
      className="flex flex-col border rounded-lg relative"
      ref={tableContainerRef}
    >
      <div className="flex items-center gap-2 p-2 border-b bg-background rounded-t-[inherit]">
        <InputGroup className="relative flex-1">
          <InputGroupIcon position="left">
            <SearchIcon className="size-4" />
          </InputGroupIcon>
          <InputGroupInput
            placeholder="Search in results..."
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
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  Object.values(columnVisibility).some(
                    (isVisible) => !isVisible
                  ) &&
                    'text-blue-500 border-blue-500 hover:text-blue-600 dark:text-blue-400 dark:border-blue-400 dark:hover:text-blue-300'
                )}
              >
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
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <Switch
              id="compact-view-toggle"
              checked={compactView}
              onCheckedChange={setCompactView}
            />
            <Label htmlFor="compact-view-toggle" className="text-sm">
              Compact view
            </Label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-2 border-b bg-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>
            Showing{' '}
            {currentPageRows === 0
              ? '0'
              : `${startRowNumber.toLocaleString()}–${endRowNumber.toLocaleString()}`}{' '}
            of {filteredRowCount.toLocaleString()} row(s) filtered. (Total:{' '}
            {localRowCount.toLocaleString()})
          </span>
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
            {Math.max(table.getPageCount(), 1).toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!canGoPrevious}
          >
            <ChevronsLeftIcon />
            <span className="sr-only">First page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!canGoPrevious}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!canGoNext}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!canGoLast}
          >
            <ChevronsRightIcon />
            <span className="sr-only">Last page</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <div className="sticky border-t top-(--header-height) z-10 bg-background border-b">
          <div
            className="overflow-x-hidden overflow-y-hidden flex relative w-full"
            ref={headerScrollRef}
            onScroll={() => syncScroll('header')}
          >
            {table.getHeaderGroups()[0]?.headers.map((header) => {
              return (
                <div
                  key={header.id}
                  className="border-r border-border last:border-r-0 relative shrink-0 group"
                  style={{
                    width: `${header.getSize()}px`
                  }}
                  data-column-id={header.column.id}
                >
                  <div className="h-10 flex items-center font-medium text-sm">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => autoFitColumn(header.column.id)}
                      className={cn(
                        'absolute top-0 right-0 z-10 h-full w-[5px] cursor-col-resize select-none touch-none transition-colors',
                        header.column.getIsResizing()
                          ? 'bg-primary opacity-100'
                          : 'bg-transparent opacity-0 hover:bg-muted-foreground/50 group-hover:opacity-100'
                      )}
                      style={
                        columnResizeMode === 'onEnd' &&
                        header.column.getIsResizing()
                          ? {
                              transform: `translateX(${columnSizingInfo.deltaOffset ?? 0}px)`
                            }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div
          ref={bodyScrollRef}
          onScroll={() => syncScroll('body')}
          className={cn(
            'relative overflow-x-auto overflow-y-hidden',
            shouldShowStickyScrollbar && 'no-scrollbar'
          )}
        >
          {currentPageRows > 0 ? (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex border-b border-border last:border-b-0 hover:bg-muted/50"
                style={{ minWidth: `${tableTotalSize}px` }}
              >
                {row.getVisibleCells().map((cell) => {
                  const cellId = cell.id
                  const isExpanded = expandedCells[cellId]
                  const cellValue = cell.getValue() as SparqlBindingValue | null
                  const isUriCell = cellValue?.type === 'uri'
                  const cellContent = flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )

                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        'border-r border-border last:border-r-0 p-2 shrink-0 text-sm',
                        isUriCell && 'group'
                      )}
                      style={{
                        width: `${cell.column.getSize()}px`
                      }}
                      data-column-id={cell.column.id}
                    >
                      {compactView ? (
                        <div
                          className={cn(
                            'relative block max-w-full cursor-pointer',
                            {
                              truncate: !isExpanded,
                              'whitespace-normal wrap-break-word': isExpanded
                            }
                          )}
                          role="switch"
                          tabIndex={0}
                          aria-checked={isExpanded}
                          onClick={(event) => handleCellClick(event, cellId)}
                          onKeyDown={(event) =>
                            handleCellKeyDown(event, cellId)
                          }
                        >
                          {cellContent}
                        </div>
                      ) : (
                        <div className="relative block max-w-full whitespace-normal wrap-break-word">
                          {cellContent}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground h-24 flex items-center justify-center">
              {effectiveTotalRows === 0
                ? 'No results returned for this query.'
                : 'No results matching current filters.'}
            </div>
          )}
        </div>

        {shouldShowStickyScrollbar && (
          <div className="sticky bottom-0 left-0 right-0 z-20">
            <div
              ref={stickyScrollRef}
              className="overflow-x-auto overflow-y-hidden pointer-events-auto sticky-scrollbar"
              onScroll={() => syncScroll('sticky')}
            >
              <div
                style={{
                  width: Math.max(tableTotalSize, containerWidth),
                  height: 1
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const ResultsTableComponent = ({ results }: ResultsTableProps) => {
  if (results.kind === 'boolean') {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="text-muted-foreground text-sm">ASK result</div>
          <div className="mt-2 text-3xl font-semibold">
            {results.value ? 'true' : 'false'}
          </div>
        </div>
      </div>
    )
  }

  if (results.kind === 'graph') {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        This query returned an RDF graph. Switch to the Graph view to inspect
        it.
      </div>
    )
  }

  return <BindingsResultsTable results={results} />
}

export default memo(ResultsTableComponent)
export type { ResultsTableProps }
export type { SparqlResultRow } from './table-columns'
