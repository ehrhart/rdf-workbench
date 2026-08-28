'use client'

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { SqlQueryRow, SqlStatementResult } from './hooks/use-isql-query'

interface ResultsTableProps {
  statements: SqlStatementResult[]
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (error) {
      console.error('Failed to stringify value:', error)
      return String(value)
    }
  }

  return String(value)
}

function StatementResultTable({ rows }: { rows: SqlQueryRow[] }) {
  const columns = useMemo(() => {
    const keys = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row ?? {}).forEach((key) => {
        keys.add(key)
      })
    })
    return Array.from(keys)
  }, [rows])

  const keyCounter = new Map<string, number>()
  const getRowKey = (row: SqlQueryRow) => {
    const baseKey = columns
      .map((column) => `${column}:${row?.[column] ?? ''}`)
      .join('|')
      .trim()

    if (!baseKey) {
      return crypto.randomUUID?.() ?? Math.random().toString(36)
    }

    const occurrence = keyCounter.get(baseKey) ?? 0
    keyCounter.set(baseKey, occurrence + 1)
    return occurrence === 0 ? baseKey : `${baseKey}#${occurrence}`
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        The statement execution did not return a result set.
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <div className="max-h-[360px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((column) => (
                  <TableCell key={column} className="font-mono text-xs">
                    {formatValue(row?.[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function IsqlResultsTable({ statements }: ResultsTableProps) {
  if (!statements || statements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Query executed successfully but returned no statements.
      </div>
    )
  }

  const hasErrors = statements.some((statement) => statement.status === 'error')

  return (
    <div className="space-y-8">
      {hasErrors ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          One or more statements failed. Successful statements are still shown
          below.
        </div>
      ) : null}
      {statements.map((statement, index) => (
        <div key={`${index}-${statement.statement}`} className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Statement {index + 1}</p>
                <code className="block max-w-full truncate font-mono text-xs text-muted-foreground">
                  {statement.statement}
                </code>
              </div>
              <div className="flex flex-col items-end text-xs">
                <span
                  className={
                    statement.status === 'error'
                      ? 'text-destructive'
                      : 'text-green-600 dark:text-emerald-400'
                  }
                >
                  {statement.status === 'error' ? 'Error' : 'Success'}
                </span>
                <span className="text-muted-foreground">
                  {statement.rowCount <= 0
                    ? 'No result set'
                    : `${statement.rowCount} row(s)`}
                </span>
              </div>
            </div>
          </div>

          {statement.status === 'error' && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">
                {statement.errorMessage ?? 'Statement execution failed.'}
              </p>
              {statement.errorCode ? (
                <p className="text-xs opacity-75">
                  Code: {statement.errorCode}
                </p>
              ) : null}
            </div>
          )}

          {statement.rows.length > 0 ? (
            <StatementResultTable rows={statement.rows} />
          ) : statement.status !== 'error' ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {statement.rowCount > 0
                ? `Statement affected ${statement.rowCount} row(s) but did not return a result set.`
                : 'The statement execution did not return a result set.'}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
