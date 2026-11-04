import type { Request, Response } from 'express'
import { getConnection } from '../database'
import { logger } from '../logger'
import type { ErrorResponse } from '../types'

/**
 * The CLEAR GRAPH command is executed in the background, allowing
 * the client to poll triple counts for progress tracking.
 */
export async function deleteGraphAsync(
  req: Request<{ graphUri: string }>,
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

  try {
    // An IRIREF cannot contain these characters, so any occurrence means
    // the value is either malformed or trying to break out of the graph
    // token. Express already percent-decodes route params.
    if (/[\s<>"{}|^`\\]/.test(graphUri)) {
      res.status(400).json({
        error: 'Invalid graph URI',
        message: 'The graph URI contains characters not allowed in an IRI'
      } as ErrorResponse)
      return
    }

    // Using setImmediate to ensure the response is sent immediately
    setImmediate(async () => {
      let connection: Awaited<ReturnType<typeof getConnection>> | undefined
      try {
        connection = await getConnection()
        const command = `SPARQL DEFINE sql:log-enable 3\nCLEAR SILENT GRAPH <${graphUri}>`

        logger.info('Starting async graph deletion', {
          graphUri
        })

        await connection.query(command)

        logger.info('Graph deletion completed', {
          graphUri
        })
      } catch (error) {
        const err = error as Error
        logger.error('Error during async graph deletion', {
          error: err.message,
          graphUri
        })
      } finally {
        if (connection) {
          await connection.close()
        }
      }
    })

    res.status(202).json({
      message: 'Graph deletion initiated',
      graphUri
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
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}
