import type { Request, Response } from 'express'
import { getConnection } from '../database'
import { logger } from '../logger'
import type { ErrorResponse } from '../types'

/**
 * Deletes a graph asynchronously without waiting for completion.
 * The CLEAR GRAPH command is executed in the background, allowing
 * the client to poll triple counts for progress tracking.
 *
 * @param graphUri The URI of the graph to delete (from URL parameter)
 * @returns Immediate 202 Accepted response
 */
export async function deleteGraphAsync(
  req: Request,
  res: Response
): Promise<void> {
  const { graphUri } = req.params

  if (!graphUri) {
    res.status(400).json({
      error: 'Graph URI is required',
      message: 'The graphUri parameter is missing in the request'
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
    // Decode the URI (it will be URL-encoded in the path)
    const decodedGraphUri = decodeURIComponent(graphUri)

    // Start the deletion in the background without waiting
    // Using setImmediate to ensure the response is sent immediately
    setImmediate(async () => {
      let connection: Awaited<ReturnType<typeof getConnection>> | undefined
      try {
        connection = await getConnection(session)
        const command = `SPARQL DEFINE sql:log-enable 3\nCLEAR SILENT GRAPH <${decodedGraphUri}>`

        logger.info('Starting async graph deletion', {
          graphUri: decodedGraphUri
        })

        await connection.query(command)

        logger.info('Graph deletion completed', {
          graphUri: decodedGraphUri
        })
      } catch (error) {
        const err = error as Error
        logger.error('Error during async graph deletion', {
          error: err.message,
          graphUri: decodedGraphUri
        })
      } finally {
        if (connection) {
          await connection.close()
        }
      }
    })

    // Return immediately with 202 Accepted
    res.status(202).json({
      message: 'Graph deletion initiated',
      graphUri: decodedGraphUri
    })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error initiating graph deletion', {
      error: err.message,
      graphUri
    })
    res.status(500).json({
      error: 'Failed to initiate graph deletion',
      message: err.message
    } as ErrorResponse)
    return
  }
}
