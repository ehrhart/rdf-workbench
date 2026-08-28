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
