import type { ColumnSizingInfoState, Updater } from '@tanstack/react-table'

export const DEFAULT_PAGE_SIZE = 100
export const PAGE_SIZES = [25, 50, 100, 250, 500] as const
export const INDEX_COLUMN_ID = 'index' as const

export const createDefaultColumnSizingInfo = (): ColumnSizingInfoState => ({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: []
})

export const resolveUpdater = <T>(updater: Updater<T>, previous: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(previous) : updater
