import type {
  ColumnFilterValue as TableColumnFilterValue,
  FilterType as TableFilterType
} from '@/components/tables/filter-types'
import type { ResourceExportFileType } from '@/lib/resource-export-formats'

export { FILTER_TYPES } from '@/components/tables/filter-types'
export type { RDFNode, Triple } from '@/types'

export type FilterType = TableFilterType
export type AppStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ResourceInfo {
  uri: string
  label?: string
  comment?: string
  type?: string[]
  role: ResourceRole
  showBlankNodes: boolean
}

export type ColumnFilterValue = TableColumnFilterValue

export type FileType = ResourceExportFileType

export const RESOURCE_ROLES = [
  'subject',
  'predicate',
  'object',
  'context',
  'all'
] as const
export type ResourceRole = (typeof RESOURCE_ROLES)[number]
