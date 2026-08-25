export class SparqlTimeoutError extends Error {
  readonly code = 'timeout' as const

  constructor(timeoutMs?: number) {
    super(
      timeoutMs && timeoutMs > 0
        ? `Query timed out after ${Math.round(timeoutMs / 1000)}s`
        : 'Query timed out'
    )
    this.name = 'SparqlTimeoutError'
  }
}
