import type { RowData } from '@tanstack/react-table'

declare module '*.css'

declare module '@tanstack/react-table' {
  interface ColumnMeta<_TData extends RowData, _TValue> {
    isGrow?: boolean
    widthPercentage?: number
  }
}
