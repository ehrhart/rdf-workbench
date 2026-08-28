'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo } from 'react'
import { Parser } from 'sparqljs'
import type {
  ExportGroup,
  QueryResultView
} from '@/components/query/query-workbench'
import { QueryWorkbench } from '@/components/query/query-workbench'
import { queryHistoryService } from '@/lib/client/query-history'
import type { DownloadFormat } from '@/lib/runtime/contracts'
import type { SparqlQueryResult, User } from '@/types'
import { Skeleton } from '../ui/skeleton'
import { useSparqlQuery } from './hooks/use-sparql-query'
import ResultsRaw from './results-raw'
import ResultsTable from './results-table'

const QueryEditor = dynamic(() => import('./query-editor'), {
  loading: () => <Skeleton className="h-[320px] w-full" />,
  ssr: false
})

const detectQueryKind = (
  query: string
): 'select' | 'describe' | 'construct' | 'ask' | 'update' | 'unknown' => {
  try {
    const parser = new Parser({ skipUngroupedVariableCheck: true })
    const parsed = parser.parse(query)
    if ('queryType' in parsed) {
      return parsed.queryType.toLowerCase() as
        | 'select'
        | 'describe'
        | 'construct'
        | 'ask'
    } else if ('updates' in parsed) {
      return 'update'
    }
  } catch {
    // Ignore parsing errors
  }
  return 'unknown'
}

const QUERY_EXPORT_GROUP: ExportGroup = {
  label: 'Query',
  isEnabled: (query) => query.trim().length > 0,
  formats: [
    {
      label: 'SPARQL (.rq)',
      mime: 'application/sparql-query',
      extension: 'rq',
      type: 'query'
    }
  ]
}

export interface SparqlEditorProps {
  endpoint: string
  defaultQuery?: string
  prefixes?: Record<string, string>
  onQuerySuccess?: (results: unknown) => void
  onQueryError?: (error: Error) => void
  currentUser?: User | null
  downloadFormats: {
    select: readonly DownloadFormat[]
    ask: readonly DownloadFormat[]
    graph: readonly DownloadFormat[]
  }
}

export default function SparqlEditor({
  endpoint,
  defaultQuery = '',
  prefixes = {},
  onQuerySuccess,
  onQueryError,
  currentUser,
  downloadFormats
}: SparqlEditorProps) {
  const {
    results,
    isLoading,
    error,
    executeQuery,
    downloadResults,
    abortQuery
  } = useSparqlQuery(endpoint)

  // Notify parent of query results
  useEffect(() => {
    if (results && onQuerySuccess) {
      onQuerySuccess(results)
    }
    if (error && onQueryError) {
      onQueryError(error)
    }
  }, [results, error, onQuerySuccess, onQueryError])

  const resultViews = useMemo<QueryResultView<SparqlQueryResult>[]>(
    () => [
      {
        id: 'table',
        label: 'Table',
        render: (value) => <ResultsTable results={value} />
      },
      {
        id: 'raw',
        label: 'Raw Response',
        render: (value) => <ResultsRaw results={value} />
      }
    ],
    []
  )

  const exportGroups = useMemo<ExportGroup[]>(() => {
    const asFormats = (formats: readonly DownloadFormat[]) =>
      formats.map((format) => ({ ...format, mime: format.mime }))

    return [
      QUERY_EXPORT_GROUP,
      {
        label: 'Results',
        isEnabled: (query: string) => {
          const kind = detectQueryKind(query)
          return kind === 'select' || kind === 'unknown'
        },
        formats: asFormats(downloadFormats.select)
      },
      {
        label: 'Results',
        isEnabled: (query: string) => detectQueryKind(query) === 'ask',
        formats: asFormats(downloadFormats.ask)
      },
      {
        label: 'Results',
        isEnabled: (query: string) => {
          const kind = detectQueryKind(query)
          return kind === 'construct' || kind === 'describe'
        },
        formats: asFormats(downloadFormats.graph)
      }
    ].filter((group) => group.formats.length > 0)
  }, [downloadFormats])

  return (
    <QueryWorkbench<SparqlQueryResult>
      storageNamespace="sparql-editor"
      defaultQuery={defaultQuery}
      historyService={queryHistoryService}
      runner={{
        results,
        isLoading,
        error,
        executeQuery,
        downloadResults,
        abortQuery
      }}
      queryNoun="SPARQL query"
      urlSync={{ enabled: true, paramKey: 'query' }}
      exportGroups={exportGroups}
      exportFilename="sparql-results"
      enableSavedQueries
      currentUser={currentUser ?? null}
      renderEditor={({ value, onChange, activeTabId }) => (
        <QueryEditor
          key={activeTabId}
          value={value}
          onChange={(editor) => onChange(editor.getValue())}
          prefixes={prefixes}
        />
      )}
      resultViews={resultViews}
      initialResultViewId="table"
    />
  )
}
