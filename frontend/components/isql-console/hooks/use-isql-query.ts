'use client'

import { useRef, useState } from 'react'
import type { DownloadRequest } from '@/components/query/query-workbench'
import { useAbortQuery } from '@/components/query/use-abort-query'

export type SqlQueryRow = Record<string, unknown>

export type SqlStatementStatus = 'success' | 'error'

export interface SqlStatementResult {
  statement: string
  rows: SqlQueryRow[]
  rowCount: number
  status: SqlStatementStatus
  errorMessage?: string
  errorCode?: string
}

interface IsqlResponseBody {
  results?: SqlQueryRow[]
  statements?: SqlStatementResult[]
  error?: string
  hasErrors?: boolean
  errorMessage?: string
}

export function useIsqlQuery() {
  const [results, setResults] = useState<SqlStatementResult[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { abortQuery: abortRunningQuery } = useAbortQuery()

  const executeQuery = async (
    query: string
  ): Promise<{ data: SqlStatementResult[] | null; error: Error | null }> => {
    setIsLoading(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/isql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query }),
        signal: abortControllerRef.current.signal
      })

      const payload = (await response.json()) as IsqlResponseBody

      if (!response.ok) {
        const message = payload?.error || 'ISQL query failed'
        throw new Error(message)
      }

      const statements: SqlStatementResult[] =
        Array.isArray(payload.statements) && payload.statements.length > 0
          ? payload.statements
          : [
              {
                statement: query.trim() || 'Statement 1',
                rows: Array.isArray(payload.results) ? payload.results : [],
                rowCount: Array.isArray(payload.results)
                  ? payload.results.length
                  : 0,
                status: (payload.hasErrors
                  ? 'error'
                  : 'success') as SqlStatementStatus,
                errorMessage: payload.errorMessage
              }
            ]

      setResults(statements)
      return { data: statements, error: null }
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
    }
  }

  const abortQuery = async (): Promise<void> => {
    abortControllerRef.current?.abort()

    try {
      await abortRunningQuery()
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err))
      setError(normalizedError)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const downloadResults = (request: DownloadRequest<SqlStatementResult[]>) => {
    const payload = request.results ?? results
    if (!payload || payload.length === 0) return

    const jsonString = JSON.stringify(payload, null, 2)
    const blob = new Blob([jsonString], {
      type: request.format ?? 'application/json'
    })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = request.filename || 'isql-results.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
