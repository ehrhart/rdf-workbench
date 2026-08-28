'use client'

import type { QueryHistoryItem } from '@/types'

export type QueryHistoryChangeDetail =
  | { type: 'save'; item: QueryHistoryItem }
  | { type: 'delete'; id: string }
  | { type: 'clear' }

export interface QueryHistoryService {
  storageKey: string
  eventName: string
  getAll: () => QueryHistoryItem[]
  save: (item: Omit<QueryHistoryItem, 'id'>) => QueryHistoryItem
  delete: (id: string) => void
  clear: () => void
}

interface CreateQueryHistoryServiceOptions {
  storageKey: string
  eventName?: string
  maxEntries?: number
}

const DEFAULT_MAX_ENTRIES = 50

const emitChange = (eventName: string, detail: QueryHistoryChangeDetail) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<QueryHistoryChangeDetail>(eventName, {
      detail
    })
  )
}

export function createQueryHistoryService({
  storageKey,
  eventName = `query-history:${storageKey}:updated`,
  maxEntries = DEFAULT_MAX_ENTRIES
}: CreateQueryHistoryServiceOptions): QueryHistoryService {
  const safeGetAll = (): QueryHistoryItem[] => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const history = localStorage.getItem(storageKey)
      return history ? JSON.parse(history) : []
    } catch (error) {
      console.error('Failed to parse query history:', error)
      return []
    }
  }

  const persist = (items: QueryHistoryItem[]) => {
    localStorage.setItem(storageKey, JSON.stringify(items))
  }

  return {
    storageKey,
    eventName,
    getAll: safeGetAll,
    save: (item) => {
      const newItem: QueryHistoryItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 9)
      }

      const history = safeGetAll()
      const updatedHistory = [newItem, ...history].slice(0, maxEntries)

      persist(updatedHistory)
      emitChange(eventName, { type: 'save', item: newItem })
      return newItem
    },
    delete: (id: string) => {
      const history = safeGetAll()
      const filtered = history.filter((item) => item.id !== id)
      persist(filtered)
      emitChange(eventName, { type: 'delete', id })
    },
    clear: () => {
      persist([])
      emitChange(eventName, { type: 'clear' })
    }
  }
}

export const queryHistoryService = createQueryHistoryService({
  storageKey: 'queryHistory',
  eventName: 'query-history:sparql'
})

export const isqlQueryHistoryService = createQueryHistoryService({
  storageKey: 'isqlQueryHistory',
  eventName: 'query-history:isql'
})
