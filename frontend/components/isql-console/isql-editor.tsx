'use client'

import { useMemo } from 'react'
import type {
  ExportGroup,
  QueryResultView
} from '@/components/query/query-workbench'
import { QueryWorkbench } from '@/components/query/query-workbench'
import { isqlQueryHistoryService } from '@/lib/client/query-history'
import type { SqlStatementResult } from './hooks/use-isql-query'
import { useIsqlQuery } from './hooks/use-isql-query'
import { IsqlResultsRaw } from './results-raw'
import { IsqlResultsTable } from './results-table'
import { SqlEditor } from './sql-editor'

interface IsqlEditorProps {
  defaultQuery?: string
}

const ISQL_EXPORT_GROUPS: ExportGroup[] = [
  {
    label: 'Query',
    isEnabled: (query) => query.trim().length > 0,
    formats: [
      {
        label: 'SQL (.sql)',
        mime: 'application/sql',
        extension: 'sql',
        type: 'query'
      }
    ]
  },
  {
    label: 'Results',
    formats: [
      {
        label: 'JSON',
        mime: 'application/json',
        extension: 'json'
      }
    ]
  }
]

export function IsqlEditor({ defaultQuery = '' }: IsqlEditorProps) {
  const {
    results,
    isLoading,
    error,
    executeQuery,
    downloadResults,
    abortQuery
  } = useIsqlQuery()

  const resultViews = useMemo<QueryResultView<SqlStatementResult[]>[]>(
    () => [
      {
        id: 'table',
        label: 'Table',
        render: (statements) => <IsqlResultsTable statements={statements} />
      },
      {
        id: 'raw',
        label: 'Raw JSON',
        render: (statements) => <IsqlResultsRaw statements={statements} />
      }
    ],
    []
  )

  return (
    <QueryWorkbench<SqlStatementResult[]>
      storageNamespace="isql-editor"
      defaultQuery={defaultQuery}
      historyService={isqlQueryHistoryService}
      runner={{
        results,
        isLoading,
        error,
        executeQuery,
        downloadResults,
        abortQuery
      }}
      queryNoun="ISQL command"
      runButtonLabel="Run Command"
      exportFilename="isql-results"
      exportGroups={ISQL_EXPORT_GROUPS}
      urlSync={{ enabled: true, paramKey: 'query' }}
      renderEditor={({ value, onChange }) => (
        <SqlEditor value={value} onChange={onChange} />
      )}
      resultViews={resultViews}
      initialResultViewId="table"
      emptyResultsMessage="Command executed successfully."
    />
  )
}
