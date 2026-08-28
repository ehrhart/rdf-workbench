import type { Request, Response } from 'express'
import { executeSparqlQuery, executeSqlQuery } from '../database'
import { logger } from '../logger'
import type { ErrorResponse, QueryRequest } from '../types'

/**
 * Executes a SPARQL query against the Virtuoso database.
 * @param query SPARQL query string in request body
 * @returns Query results or error response
 */
export async function sparqlQuery(req: Request, res: Response): Promise<void> {
  const { query } = req.body as QueryRequest

  if (!query) {
    res.status(400).json({
      error: 'Query is required',
      message: 'The query parameter is missing in the request body'
    } as ErrorResponse)
    return
  }

  try {
    const result = await executeSparqlQuery(query)
    res.json(result)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error executing SPARQL query', {
      error: err.message,
      query
    })
    res.status(400).json({
      error: 'Query execution failed',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Executes a SQL query against the Virtuoso database.
 * @param query SQL query string in request body
 * @returns Query results or error response
 */
export async function sqlQuery(req: Request, res: Response): Promise<void> {
  const { query } = req.body as QueryRequest

  if (!query) {
    res.status(400).json({
      error: 'Query is required',
      message: 'The query parameter is missing in the request body'
    } as ErrorResponse)
    return
  }

  const session = req.dbSession
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Database session is not available'
    } as ErrorResponse)
    return
  }

  try {
    const result = await executeSqlQuery(session, query)
    res.json(result)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error executing SQL query', { error: err.message, query })
    res.status(400).json({
      error: 'Query execution failed',
      message: err.message
    } as ErrorResponse)
    return
  }
}
