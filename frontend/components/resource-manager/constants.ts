import type { ResourceRole } from './types'

export const DEFAULT_ROLE: ResourceRole = 'subject'
export const DEFAULT_SHOW_BLANK_NODES = true

export const DEFAULT_PAGE_SIZE = 10

export const PAGE_SIZES = [10, 20, 30, 40, 50] as const
export const TRIPLE_FETCH_LIMIT = 100
