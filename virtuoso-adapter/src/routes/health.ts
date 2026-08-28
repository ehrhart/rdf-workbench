import type { Request, Response } from 'express'
import { getAdminConnection } from '../session-manager'
import type { HealthResponse } from '../types'

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  try {
    const connection = await getAdminConnection()
    try {
      await connection.query('SELECT 1 AS test')
    } finally {
      await connection.close()
    }

    res.status(200).json({
      status: 'healthy',
      message: 'Virtuoso adapter and ODBC connection are healthy'
    } as HealthResponse)
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message:
        error instanceof Error
          ? error.message
          : 'Virtuoso ODBC connection is unavailable'
    } as HealthResponse)
  }
}
