'use server'

import { AuthError, ConnectionError, QueryError } from '@/lib/errors'
import { getRuntimeConfig } from '@/lib/runtime/config'
import { deleteSession, getAuthTokenFromCookie } from './session'

export type StatementExecutionStatus = 'success' | 'error'

export interface StatementExecutionResult<T = Record<string, unknown>> {
  statement: string
  rows: T[]
  rowCount: number
  status: StatementExecutionStatus
  errorMessage?: string
  errorCode?: string
}

export interface VirtuosoAdapterResponse<T = Record<string, unknown>> {
  results: T[]
  statements?: StatementExecutionResult<T>[]
  hasErrors?: boolean
  errorMessage?: string
}

type RawVirtuosoAdapterResponse<T> = Partial<VirtuosoAdapterResponse<T>> & {
  error?: string
  message?: string
  statements?: unknown
  results?: unknown
}

function normalizeStatementResult<T>(
  statement: Partial<StatementExecutionResult<T>> | undefined,
  index: number
): StatementExecutionResult<T> {
  const rows = Array.isArray(statement?.rows)
    ? (statement.rows as T[])
    : ([] as T[])
  const rowCount =
    typeof statement?.rowCount === 'number' ? statement.rowCount : rows.length
  const resolvedStatement = statement?.statement?.toString().trim()
  return {
    statement: resolvedStatement?.length
      ? resolvedStatement
      : `Statement ${index + 1}`,
    rows,
    rowCount,
    status: statement?.status === 'error' ? 'error' : 'success',
    errorMessage: statement?.errorMessage,
    errorCode: statement?.errorCode
  }
}

function normalizeAdapterResponse<T>(
  raw: RawVirtuosoAdapterResponse<T>,
  command: string
): VirtuosoAdapterResponse<T> {
  const normalizedStatements = Array.isArray(raw.statements)
    ? raw.statements.map((statement, index) =>
        normalizeStatementResult(
          statement as Partial<StatementExecutionResult<T>>,
          index
        )
      )
    : []

  if (normalizedStatements.length === 0) {
    const fallbackRows = Array.isArray(raw.results)
      ? (raw.results as T[])
      : ([] as T[])
    normalizedStatements.push({
      statement: command.trim() || 'Statement 1',
      rows: fallbackRows,
      rowCount: fallbackRows.length,
      status: raw.hasErrors ? 'error' : 'success',
      errorMessage: raw.errorMessage ?? raw.error
    })
  }

  const hasErrors =
    raw.hasErrors ??
    normalizedStatements.some((statement) => statement.status === 'error')
  const results = normalizedStatements.at(-1)?.rows ?? []

  return {
    results,
    statements: normalizedStatements,
    hasErrors,
    errorMessage: raw.errorMessage
  }
}

interface ExecuteOptions {
  useServiceCredentials?: boolean
  authToken?: string
  onAuthError?: () => Promise<void>
}

async function fetchVirtuosoAdapterResponse<T = Record<string, unknown>>(
  command: string,
  options: ExecuteOptions = {}
): Promise<VirtuosoAdapterResponse<T>> {
  const runtime = getRuntimeConfig()
  if (runtime.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    throw new ConnectionError('Virtuoso adapter is unavailable for QLever')
  }
  const isqlServerUrl = runtime.VIRTUOSO_ADAPTER_URL

  const authToken = options.authToken
  if (!authToken && !options.useServiceCredentials) {
    throw new AuthError('Session expired')
  }

  const sendQuery = async (): Promise<Response> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (options.useServiceCredentials) {
        headers['X-Adapter-Token'] = runtime.VIRTUOSO_ADAPTER_TOKEN
      } else if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      }

      return await fetch(`${isqlServerUrl}/api/query/sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: command })
      })
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown network error'
      console.warn(
        'Network error while contacting Virtuoso adapter:',
        errorMessage
      )
      throw new ConnectionError(
        `Unable to connect to the Virtuoso adapter (${errorMessage}). The service may be temporarily unavailable.`
      )
    }
  }

  const res: Response = await sendQuery()

  if (res.status === 401) {
    if (options.onAuthError) {
      await options.onAuthError()
    }
    throw new AuthError('Session expired')
  }

  let payload: RawVirtuosoAdapterResponse<T> | null = null
  try {
    payload = (await res.json()) as RawVirtuosoAdapterResponse<T>
  } catch (parseErr) {
    console.error('Virtuoso adapter responded with non-JSON payload', parseErr)
    throw new QueryError(
      `Virtuoso adapter error: ${res.status} ${res.statusText}`
    )
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new AuthError('Session expired')
    }

    const message =
      payload?.error || payload?.message || 'Virtuoso adapter request failed'
    console.error('Virtuoso adapter responded with error:', message)
    throw new QueryError(message)
  }

  if (payload?.error && !payload.statements) {
    console.error('Virtuoso adapter returned an error:', payload.error)
    throw new QueryError(payload.error)
  }

  return normalizeAdapterResponse(payload ?? {}, command)
}

export async function executeIsqlCommand<T = unknown>(
  command: string,
  options: ExecuteOptions = {}
): Promise<T> {
  const data = await fetchVirtuosoAdapterResponse<T>(command, options)
  if (data.hasErrors) {
    const firstError = data.statements?.find(
      (statement) => statement.status === 'error'
    )
    const message =
      firstError?.errorMessage || data.errorMessage || 'SQL statement failed'
    throw new QueryError(message)
  }
  return data.results as T
}

export async function executeIsqlCommandDetailed<T = unknown>(
  command: string,
  options: ExecuteOptions = {}
): Promise<VirtuosoAdapterResponse<T>> {
  return fetchVirtuosoAdapterResponse<T>(command, options)
}

/**
 * Convenience wrapper that automatically uses the current user's auth token.
 * Deletes session cookie on 401 errors.
 * Use this from Server Actions.
 */
export async function executeIsqlWithAuth<T = unknown>(
  command: string
): Promise<T> {
  const token = await getAuthTokenFromCookie()

  if (!token) {
    throw new AuthError('No auth token available')
  }

  try {
    return await executeIsqlCommand<T>(command, {
      authToken: token,
      onAuthError: async () => {
        await deleteSession()
      }
    })
  } catch (error) {
    if (error instanceof AuthError) {
      await deleteSession()
    }
    throw error
  }
}
