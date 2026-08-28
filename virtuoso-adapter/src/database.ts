import type * as odbc from 'odbc'
import { logger } from './logger'
import type { VirtuosoSession } from './session-manager'
import type {
  QueryResponse,
  SparqlResult,
  StatementExecutionResult
} from './types'

interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

async function runQuery(
  connection: odbc.Connection,
  query: string
): Promise<QueryResult> {
  const result = (await connection.query(query)) as odbc.Result<
    Record<string, unknown>
  >
  const rows = result as Record<string, unknown>[]
  const rowCount = typeof result.count === 'number' ? result.count : rows.length
  return { rows, rowCount }
}

async function withConnection<T>(
  session: VirtuosoSession,
  handler: (connection: odbc.Connection) => Promise<T>
): Promise<T> {
  const connection = await session.pool.connect()
  try {
    return await handler(connection)
  } finally {
    await connection.close()
  }
}

interface NormalizedOdbcError {
  message: string
  code?: string
}

type OdbcDriverError = Error & {
  odbcErrors?: Array<{
    message?: string
    state?: string
    code?: string
  }>
  code?: string
}

function normalizeOdbcError(error: unknown): NormalizedOdbcError {
  const fallback: NormalizedOdbcError = {
    message: error instanceof Error ? error.message : 'Unknown SQL error'
  }

  const driverError = error as OdbcDriverError
  const first = driverError?.odbcErrors?.[0]
  if (first) {
    return {
      message: first.message ?? fallback.message,
      code: first.code ?? first.state
    }
  }

  if (driverError?.message) {
    return {
      message: driverError.message,
      code: driverError.code ?? undefined
    }
  }

  return fallback
}

function splitSqlStatements(query: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBracketIdentifier = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < query.length; i++) {
    const char = query[i]
    const next = query[i + 1]

    if (inLineComment) {
      current += char
      if (char === '\n') {
        inLineComment = false
      }
      continue
    }

    if (inBlockComment) {
      current += char
      if (char === '*' && next === '/') {
        current += next
        i++
        inBlockComment = false
      }
      continue
    }

    if (inSingleQuote) {
      current += char
      if (char === "'" && next === "'") {
        current += next
        i++
        continue
      }
      if (char === "'") {
        inSingleQuote = false
      }
      continue
    }

    if (inDoubleQuote) {
      current += char
      if (char === '"' && next === '"') {
        current += next
        i++
        continue
      }
      if (char === '"') {
        inDoubleQuote = false
      }
      continue
    }

    if (inBracketIdentifier) {
      current += char
      if (char === ']') {
        inBracketIdentifier = false
      }
      continue
    }

    if (char === '-' && next === '-') {
      current += char
      current += next
      i++
      inLineComment = true
      continue
    }

    if (char === '/' && next === '*') {
      current += char
      current += next
      i++
      inBlockComment = true
      continue
    }

    if (char === "'") {
      current += char
      inSingleQuote = true
      continue
    }

    if (char === '"') {
      current += char
      inDoubleQuote = true
      continue
    }

    if (char === '[') {
      current += char
      inBracketIdentifier = true
      continue
    }

    if (char === ';') {
      const statement = current.trim()
      if (statement.length > 0) {
        statements.push(statement)
      }
      current = ''
      continue
    }

    current += char
  }

  const tail = current.trim()
  if (tail.length > 0) {
    statements.push(tail)
  }

  return statements
}

async function executeStatement(
  connection: odbc.Connection,
  statement: string,
  username: string
): Promise<StatementExecutionResult> {
  const normalizedStatement = statement.trim()
  const baseResult: StatementExecutionResult = {
    statement: normalizedStatement,
    rows: [],
    rowCount: 0,
    status: 'success'
  }

  if (!normalizedStatement) {
    return baseResult
  }

  try {
    const { rows, rowCount } = await runQuery(connection, normalizedStatement)
    baseResult.rows = rows
    baseResult.rowCount = rowCount
  } catch (error) {
    const normalized = normalizeOdbcError(error)
    baseResult.status = 'error'
    baseResult.errorMessage = normalized.message
    baseResult.errorCode = normalized.code
    logger.error('SQL statement failed', {
      statement: normalizedStatement,
      error: normalized.message,
      code: normalized.code,
      user: username
    })
  }

  return baseResult
}

export async function executeSparqlQuery(query: string): Promise<SparqlResult> {
  logger.info('Executing SPARQL query', {
    query
  })

  const { config } = await import('./config')
  const endpoint = config.sparqlEndpoint

  const searchParams = new URLSearchParams()
  searchParams.set('query', query)
  searchParams.set('format', 'application/sparql-results+json')

  const auth = btoa(`${config.virtuoso.user}:${config.virtuoso.password}`)

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      Authorization: `Basic ${auth}`
    },
    body: searchParams.toString()
  }

  const response = await fetch(endpoint, requestInit)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to execute query: ${response.status} - ${errorText}`
    )
  }

  const result = (await response.json()) as SparqlResult
  if ('boolean' in result && typeof result.boolean === 'boolean') {
    return result
  }
  if (
    !('head' in result) ||
    !result.head ||
    !('results' in result) ||
    !result.results ||
    !Array.isArray(result.results.bindings)
  ) {
    throw new Error('Invalid SPARQL result format')
  }

  return result
}

export async function executeSqlQuery(
  session: VirtuosoSession,
  query: string
): Promise<QueryResponse> {
  const statements = splitSqlStatements(query)
  if (statements.length === 0) {
    throw new Error('No SQL statements to execute')
  }

  logger.info('Executing SQL query', {
    user: session.username,
    statementCount: statements.length,
    query
  })

  const statementResults = await withConnection(session, async (connection) => {
    const results: StatementExecutionResult[] = []
    for (const statement of statements) {
      const executionResult = await executeStatement(
        connection,
        statement,
        session.username
      )
      results.push(executionResult)
    }
    return results
  })

  const lastSuccessfulRows =
    [...statementResults]
      .reverse()
      .find((statement) => statement.status === 'success')?.rows ?? []
  const hasErrors = statementResults.some(
    (statement) => statement.status === 'error'
  )
  const firstError = statementResults.find(
    (statement) => statement.status === 'error'
  )

  return {
    results: lastSuccessfulRows,
    statements: statementResults,
    hasErrors,
    errorMessage: firstError?.errorMessage
  }
}

export async function getConnection(
  session: VirtuosoSession
): Promise<odbc.Connection> {
  return await session.pool.connect()
}
