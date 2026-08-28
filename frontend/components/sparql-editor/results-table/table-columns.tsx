'use client'

import type { Column, ColumnDef } from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  XIcon
} from 'lucide-react'
import { useCallback, useState } from 'react'
import type { SparqlBindingValue } from '../../../types'
import { ColumnFilterDropdown } from '../../tables/ColumnFilterDropdown'
import { FilterContent } from '../../tables/FilterContent'
import { customFilterFn, customSortingFn } from '../../tables/filter-fns'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '../../ui/dropdown-menu'
import { INDEX_COLUMN_ID } from './table-utils'

export interface SparqlResultRow {
  __index: number
  [variable: string]: SparqlBindingValue | null | number
}

const CombinedHeaderDropdown = ({
  column,
  variable
}: {
  column: Column<SparqlResultRow, unknown>
  variable: string
}) => {
  const handleClose = useCallback(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Escape'
      })
    )
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 justify-start overflow-hidden w-full"
          >
            <span className="truncate block">{variable}</span>
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="space-y-2 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
            className="h-8 px-2 justify-start"
          >
            Sort
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 h-3.5 w-3.5 shrink-0" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 h-3.5 w-3.5 shrink-0" />
            ) : (
              <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 shrink-0" />
            )}
          </Button>

          <div className="border-t" />

          <div className="space-y-2">
            <FilterContent column={column} onClose={handleClose} />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const createColumns = (
  variables: string[]
): ColumnDef<SparqlResultRow>[] => {
  const dataColumns = variables.map<ColumnDef<SparqlResultRow>>((variable) => ({
    id: variable,
    accessorKey: variable,
    minSize: 60,
    // maxSize: 720,
    meta: {
      isGrow: true
    },
    header: ({ column }) => {
      const columnSize = column.getSize()
      const contentWidth = columnSize - 32
      const textWidth = variable.length * 8
      const minWidthNeeded = textWidth + 72
      const useCombinedDropdown = contentWidth < minWidthNeeded

      if (useCombinedDropdown) {
        return <CombinedHeaderDropdown column={column} variable={variable} />
      }

      return (
        <div className="flex items-center px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 overflow-hidden min-w-0"
            onClick={() => column.toggleSorting()}
          >
            <span className="truncate block pr-2">{variable}</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 h-3.5 w-3.5 shrink-0" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 h-3.5 w-3.5 shrink-0" />
            ) : (
              <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 shrink-0" />
            )}
          </Button>
          <ColumnFilterDropdown column={column} />
        </div>
      )
    },
    cell: ({ getValue }) =>
      renderBindingValue(getValue<SparqlBindingValue | null>()),
    filterFn: customFilterFn,
    sortingFn: customSortingFn,
    enableResizing: true
  }))

  return [
    {
      id: INDEX_COLUMN_ID,
      header: () => (
        <div className="text-muted-foreground text-center text-xs mx-auto">
          #
        </div>
      ),
      size: 50,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination
        const displayIndex = pageIndex * pageSize + row.index + 1

        return (
          <div className="text-muted-foreground text-center text-xs">
            {displayIndex.toLocaleString()}
          </div>
        )
      },
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: true,
      enableResizing: false
    },
    ...dataColumns
  ]
}

const UriCell = ({ value }: { value: string }) => {
  return (
    <a
      href={`/resource?uri=${encodeURIComponent(value)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:underline"
    >
      {shortenUri(value)}
    </a>
  )
}

const CopyableCell = ({
  value,
  children
}: {
  value: string
  children: React.ReactNode
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  )

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus('success')
      setTimeout(() => setCopyStatus('idle'), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 1500)
    }
  }, [value])

  const getButtonIcon = () => {
    switch (copyStatus) {
      case 'success':
        return <CheckIcon className="h-3 w-3 text-green-600" />
      case 'error':
        return <XIcon className="h-3 w-3 text-red-600" />
      default:
        return <CopyIcon className="h-3 w-3" />
    }
  }

  return (
    <div className="relative pr-5 group">
      {children}
      <Button
        variant="secondary"
        size="icon-sm"
        className="absolute top-0 right-0 size-5 p-0 bg-primary-foreground transition-all duration-200 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:scale-105"
        onClick={handleCopy}
        title={
          copyStatus === 'success'
            ? 'Copied!'
            : copyStatus === 'error'
              ? 'Copy failed'
              : 'Copy to clipboard'
        }
      >
        {getButtonIcon()}
      </Button>
    </div>
  )
}

export function renderBindingValue(value: SparqlBindingValue | null) {
  if (!value) return ''

  switch (value.type) {
    case 'uri':
      return (
        <CopyableCell value={value.value}>
          <UriCell value={value.value} />
        </CopyableCell>
      )
    case 'literal':
      if (value['xml:lang']) {
        return (
          <CopyableCell value={value.value}>
            <span>
              "{value.value}"{' '}
              <span className="text-muted-foreground text-xs">
                @{value['xml:lang']}
              </span>
            </span>
          </CopyableCell>
        )
      }
      if (value.datatype) {
        return (
          <CopyableCell value={value.value}>
            <span>
              {value.value}{' '}
              <span className="text-muted-foreground text-xs">
                ^{shortenUri(value.datatype)}
              </span>
            </span>
          </CopyableCell>
        )
      }
      return <CopyableCell value={value.value}>{value.value}</CopyableCell>
    default:
      return <CopyableCell value={value.value}>{value.value}</CopyableCell>
  }
}

export function shortenUri(uri: string) {
  const match = uri.match(/[/#]([^/#]+)$/)
  return match ? match[1] : uri
}
