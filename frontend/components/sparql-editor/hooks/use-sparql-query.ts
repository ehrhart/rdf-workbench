'use client'

import { useRef, useState } from 'react'
import { useAbortQuery } from '@/components/query/use-abort-query'
import { detectQueryKind } from '@/lib/sparql/kind'
import { normalizeSparqlJsonResult } from '@/lib/sparql/results'
import type { SparqlQueryResult } from '@/types'

interface DownloadRequest {
  query?: string
  format: string
  filename?: string
  results?: SparqlQueryResult | null
}

async function parseUpdateResponse(
  response: Response
): Promise<SparqlQueryResult> {
  if (response.status === 204) return { kind: 'boolean', value: true }
  return normalizeSparqlJsonResult(await response.json())
}

async function parseQueryResponse(
  response: Response
): Promise<SparqlQueryResult> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('text/turtle')) {
    return {
      kind: 'graph',
      value: await response.text(),
      format: 'text/turtle'
    }
  }
  return normalizeSparqlJsonResult(await response.json())
}

export function useSparqlQuery(endpoint: string) {
  const [results, setResults] = useState<SparqlQueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { abortQuery: abortRunningQuery } = useAbortQuery()

  const executeQuery = async (
    query: string
  ): Promise<{ data: SparqlQueryResult | null; error: Error | null }> => {
    setIsLoading(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    try {
      const isUpdate = detectQueryKind(query) === 'update'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': isUpdate
            ? 'application/sparql-update'
            : 'application/sparql-query',
          Accept: 'application/sparql-results+json'
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

      const data = isUpdate
        ? await parseUpdateResponse(response)
        : await parseQueryResponse(response)

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

  const downloadResults = async (request: DownloadRequest) => {
    const trimmedQuery = request.query?.trim()
    if (!trimmedQuery) return

    const filename = request.filename?.trim() || 'sparql-results'

    const response = await fetch('/api/console/download', {
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
      throw new Error(message || "Couldn't download the results. Try again.")
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
