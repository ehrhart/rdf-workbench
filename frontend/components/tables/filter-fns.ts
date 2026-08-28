import type { FilterFn } from '@tanstack/react-table'
import type { ColumnFilterValue } from './filter-types'
import { getComparableValue } from './value-utils'

/**
 * Custom column filter compatible with the shared column filter dropdown.
 */
export const customFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  rawFilterValue
) => {
  const filterValue = rawFilterValue as ColumnFilterValue | undefined
  if (!filterValue) return true

  const { type, filterValue: inputValue } = filterValue
  const cellValue = getComparableValue(row.getValue(columnId))
  const value = cellValue.toLowerCase()
  const filterInput = String(inputValue ?? '').toLowerCase()

  switch (type) {
    case 'contains':
      return value.includes(filterInput)
    case 'doesNotContain':
      return !value.includes(filterInput)
    case 'equals':
      return value === filterInput
    case 'doesNotEqual':
      return value !== filterInput
    case 'beginsWith':
      return value.startsWith(filterInput)
    case 'endsWith':
      return value.endsWith(filterInput)
    case 'blank':
      return value.length === 0
    case 'notBlank':
      return value.length > 0
    default:
      return true
  }
}

/**
 * Global filter that searches across all cell values exposed by the table.
 */
export const customGlobalFilterFn: FilterFn<unknown> = (
  row,
  _columnId,
  filterValue
) => {
  const searchValue = String(filterValue ?? '').toLowerCase()
  if (!searchValue) return true

  return row
    .getAllCells()
    .some((cell) =>
      getComparableValue(cell.getValue()).toLowerCase().includes(searchValue)
    )
}
