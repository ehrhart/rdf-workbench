import type { Row, RowData } from '@tanstack/react-table'
import type { ColumnFilterValue } from './filter-types'
import { compareValues, getComparableValue } from './value-utils'

/**
 * Custom column filter compatible with the shared column filter dropdown.
 */
export const customFilterFn = <TData extends RowData>(
  row: Row<TData>,
  columnId: string,
  rawFilterValue: unknown
): boolean => {
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
export const customGlobalFilterFn = <TData extends RowData>(
  row: Row<TData>,
  _columnId: string,
  filterValue: unknown
): boolean => {
  const searchValue = String(filterValue ?? '').toLowerCase()
  if (!searchValue) return true

  return row
    .getAllCells()
    .some((cell) =>
      getComparableValue(cell.getValue()).toLowerCase().includes(searchValue)
    )
}

/**
 * Custom column sort that compares on the comparable string representation.
 */
export const customSortingFn = <TData extends RowData>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string
): number => compareValues(rowA.getValue(columnId), rowB.getValue(columnId))
