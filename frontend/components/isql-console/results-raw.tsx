'use client'

import type { SqlStatementResult } from './hooks/use-isql-query'

interface ResultsRawProps {
  statements: SqlStatementResult[]
}

export function IsqlResultsRaw({ statements }: ResultsRawProps) {
  return (
    <div className="rounded-lg border bg-muted/10 p-4">
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm">
        {JSON.stringify(statements, null, 2)}
      </pre>
    </div>
  )
}
