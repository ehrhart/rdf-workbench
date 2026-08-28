import type { Column, RowData } from '@tanstack/react-table'
import { useCallback, useEffect, useState } from 'react'
import type {
  ColumnFilterValue,
  FilterType
} from '@/components/tables/filter-types'
import { FILTER_TYPES } from '@/components/tables/filter-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface FilterContentProps<TData extends RowData> {
  column: Column<TData, unknown>
  onClose?: () => void
}

export function FilterContent<TData extends RowData>({
  column,
  onClose
}: FilterContentProps<TData>) {
  const currentFilter = column.getFilterValue() as ColumnFilterValue | undefined
  const [type, setType] = useState<FilterType>(
    currentFilter?.type ?? 'contains'
  )
  const [value, setValue] = useState<string>(currentFilter?.filterValue ?? '')

  // Update local state if the external filter changes (e.g., cleared globally)
  useEffect(() => {
    setType(currentFilter?.type ?? 'contains')
    setValue(currentFilter?.filterValue ?? '')
  }, [currentFilter])

  const handleApplyFilter = useCallback(() => {
    if (type === 'blank' || type === 'notBlank') {
      column.setFilterValue({ type, filterValue: '' }) // Value not needed for blank/notBlank
    } else if (value) {
      column.setFilterValue({ type, filterValue: value })
    } else {
      column.setFilterValue(undefined) // Clear if value is empty
    }
    onClose?.()
  }, [column, type, value, onClose])

  const handleClearFilter = useCallback(() => {
    column.setFilterValue(undefined)
    setValue('')
    setType('contains')
    onClose?.()
  }, [column, onClose])

  const showValueInput = type !== 'blank' && type !== 'notBlank'

  return (
    <div className="space-y-2 p-2">
      <Select value={type} onValueChange={(v) => setType(v as FilterType)}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Filter type" />
        </SelectTrigger>
        <SelectContent>
          {FILTER_TYPES.map((ft: FilterType) => (
            <SelectItem key={ft} value={ft}>
              {ft
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str: string) => str.toUpperCase())}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showValueInput && (
        <Input
          placeholder="Filter value..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8"
        />
      )}

      <div className="flex justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={handleClearFilter}>
          Clear
        </Button>
        <Button size="sm" onClick={handleApplyFilter}>
          Apply
        </Button>
      </div>
    </div>
  )
}
