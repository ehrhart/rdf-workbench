'use client'

import type { SavedQuery } from '@/types'

interface SavePayload {
  name: string
  query: string
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string }
    if (data?.error) return data.error
  } catch (error) {
    console.warn('Failed to parse saved query error payload', error)
  }

  return response.statusText || 'Unexpected error'
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as T
}

export async function fetchSavedQueries(): Promise<SavedQuery[]> {
  const response = await fetch('/api/saved-queries', { cache: 'no-store' })
  const data = await handleResponse<{ items: SavedQuery[] }>(response)
  return Array.isArray(data.items) ? data.items : []
}

export async function fetchSavedQuery(id: string): Promise<SavedQuery | null> {
  const response = await fetch(`/api/saved-queries/${id}`, {
    cache: 'no-store'
  })

  if (response.status === 404) {
    return null
  }

  return handleResponse<SavedQuery>(response)
}

export async function createSavedQueryClient(
  payload: SavePayload
): Promise<SavedQuery> {
  const response = await fetch('/api/saved-queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  return handleResponse<SavedQuery>(response)
}

export async function updateSavedQueryClient(
  id: string,
  payload: SavePayload
): Promise<SavedQuery> {
  const response = await fetch(`/api/saved-queries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  return handleResponse<SavedQuery>(response)
}

export async function deleteSavedQueryClient(id: string): Promise<void> {
  const response = await fetch(`/api/saved-queries/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}

export async function reorderSavedQueriesClient(
  order: Array<{ id: string; position: number }>
): Promise<void> {
  const response = await fetch('/api/saved-queries/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}
