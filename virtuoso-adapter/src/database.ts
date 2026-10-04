import * as odbc from 'odbc'
import { config } from './config'
import { logger } from './logger'
import type {
  QueryResponse,
  StatementExecutionResult
} from './types'

interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

let pool: odbc.Pool | null = null

function buildConnectionString(): string {
  const base = `DRIVER=${config.virtuoso.driver};HOST=${config.virtuoso.host};PORT=${config.virtuoso.port}`
  return `${base};UID=${config.virtuoso.user};PWD=${config.virtuoso.password};CHARSET=UTF-8;`
}

export async function initPool(): Promise<void> {
  pool = await odbc.pool({
    connectionString: buildConnectionString(),
    connectionTimeout: config.virtuoso.connectionTimeout,
    loginTimeout: config.virtuoso.loginTimeout
  })
}

function getPool(): odbc.Pool {
  if (!pool) {
    throw new Error('Connection pool not initialized')
  }
  return pool
}

export async function getConnection(): Promise<odbc.Connection> {
  return await getPool().connect()
}

export async function closePool(): Promise<void> {
  if (!pool) return
  await pool.close()
  pool = null
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
  handler: (connection: odbc.Connection) => Promise<T>
): Promise<T> {
  const connection = await getPool().connect()
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
  statement: string
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
      code: normalized.code
    })
  }

  return baseResult
}

export async function executeSqlQuery(query: string): Promise<QueryResponse> {
  const statements = splitSqlStatements(query)
  if (statements.length === 0) {
    throw new Error('No SQL statements to execute')
  }

  logger.info('Executing SQL query', {
    statementCount: statements.length,
    query
  })

  const statementResults = await withConnection(async (connection) => {
    const results: StatementExecutionResult[] = []
    for (const statement of statements) {
      const executionResult = await executeStatement(connection, statement)
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
