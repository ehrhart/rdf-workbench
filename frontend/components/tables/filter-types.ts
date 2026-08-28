import type { FilterFn, RowData, SortingFn } from '@tanstack/react-table'

export const FILTER_TYPES = [
  'contains',
  'doesNotContain',
  'equals',
  'doesNotEqual',
  'beginsWith',
  'endsWith',
  'blank',
  'notBlank'
] as const

export type FilterType = (typeof FILTER_TYPES)[number]

export interface ColumnFilterValue {
  type: FilterType
  filterValue: string
}

/**
 * Module augmentation for TanStack Table custom filter and sorting functions.
 */
declare module '@tanstack/react-table' {
  interface FilterFns {
    customFilter?: FilterFn<RowData>
    customGlobalFilter?: FilterFn<RowData>
  }
  interface SortingFns {
    customSorting?: SortingFn<unknown>
  }
  // biome-ignore lint/correctness/noUnusedVariables: signature
  interface TableOptions<TData extends RowData> {
    filterFns?: FilterFns
    sortingFns?: SortingFns
  }
}
