'use client'

import { useRef, useState } from 'react'
import { useAbortQuery } from '@/components/query/use-abort-query'
import type { SparqlQueryResult } from '@/types'

interface DownloadRequest {
  query?: string
  format: string
  filename?: string
  results?: SparqlQueryResult | null
}

export function useSparqlQuery(endpoint: string) {
  const [results, setResults] = useState<SparqlQueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeQueryIdRef = useRef<string | null>(null)
  const { abortQuery: abortRunningQuery } = useAbortQuery()

  const executeQuery = async (
    query: string
  ): Promise<{ data: SparqlQueryResult | null; error: Error | null }> => {
    setIsLoading(true)
    setError(null)
    abortControllerRef.current = new AbortController()
    activeQueryIdRef.current =
      crypto.randomUUID?.() ??
      `wq-${Date.now()}-${Math.random().toString(36).slice(2)}`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          Accept: 'application/sparql-results+json',
          'X-Query-Id': activeQueryIdRef.current
        },
        body: query,
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        let errorMessage = `SPARQL query failed: ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // If parsing fails, use the default message
        }
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as SparqlQueryResult

      setResults(data)
      return { data, error: null }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const abortedError = new Error('Query aborted')
        setError(abortedError)
        return { data: null, error: abortedError }
      }

      const normalizedError =
        err instanceof Error ? err : new Error(String(err))
      setError(normalizedError)
      return { data: null, error: normalizedError }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      activeQueryIdRef.current = null
    }
  }

  const abortQuery = async (): Promise<void> => {
    const queryId = activeQueryIdRef.current
    abortControllerRef.current?.abort()

    try {
      await abortRunningQuery(queryId ?? undefined)
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err))
      setError(normalizedError)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      activeQueryIdRef.current = null
    }
  }

  const downloadResults = async (request: DownloadRequest) => {
    const trimmedQuery = request.query?.trim()
    if (!trimmedQuery) return

    const filename = request.filename?.trim() || 'sparql-results'

    const response = await fetch('/api/sparql/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: trimmedQuery,
        format: request.format,
        filename,
        results: request.results ?? null
      })
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(
        message || 'Failed to download SPARQL query results. Please retry.'
      )
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    results,
    isLoading,
    error,
    executeQuery,
    downloadResults,
    abortQuery
  }
}
