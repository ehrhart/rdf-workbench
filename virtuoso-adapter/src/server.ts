import bodyParser from 'body-parser'
import express, {
  type NextFunction,
  type Request,
  type Response
} from 'express'
import { config, IMPORTS_PATH } from './config'
import { logger } from './logger'
import { authenticateRequest } from './middleware/auth'
import { login, logout } from './routes/auth'
import {
  deleteSharedFiles,
  downloadSharedFile,
  ensureExportsDirectory,
  listSharedFiles
} from './routes/files'
import { deleteGraphAsync } from './routes/graphs'
import { healthCheck } from './routes/health'
import {
  bulkLoad,
  cancelJob,
  deleteFileHandler,
  ensureDirectory,
  getAllJobs,
  getJobStatus,
  uploadFile,
  uploadFromUrl,
  uploadSnippet
} from './routes/import'
import { sqlQuery } from './routes/query'
import { adminPool, destroyAllSessions, initAdminPool } from './session-manager'
import { loadSqlScripts } from './sql-loader'
import type { ErrorResponse } from './types'

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Middleware to log all incoming requests
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip
  })
  next()
})

/**
 * Global error handler for Express middleware.
 * Logs errors and returns standardized error response.
 */
const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle multer file size errors
  if (err.message?.includes('File too large')) {
    logger.error('File size limit exceeded', { error: err.message })
    res.status(413).json({
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum allowed size'
    } as ErrorResponse)
    return
  }

  logger.error('Error occurred', { error: err.message })
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  } as ErrorResponse)
}

// API Routes
app.get('/health', healthCheck)
app.post('/api/auth/login', login)
app.post('/api/auth/logout', logout)
app.post('/api/query/sql', authenticateRequest, sqlQuery)
app.post('/api/import/ensure-directory', authenticateRequest, ensureDirectory)
app.post('/api/import/upload', authenticateRequest, ...uploadFile)
app.post('/api/import/url', authenticateRequest, uploadFromUrl)
app.post('/api/import/snippet', authenticateRequest, uploadSnippet)
app.post('/api/import/bulk-load', authenticateRequest, bulkLoad)
app.get('/api/import/status/:jobId', authenticateRequest, getJobStatus)
app.get('/api/import/jobs', authenticateRequest, getAllJobs)
app.post('/api/import/cancel/:jobId', authenticateRequest, cancelJob)
app.delete('/api/import/file/:filename', authenticateRequest, deleteFileHandler)
app.get('/api/files', authenticateRequest, listSharedFiles)
app.get('/api/files/download', authenticateRequest, downloadSharedFile)
app.delete('/api/files', authenticateRequest, deleteSharedFiles)
app.delete('/api/graphs/:graphUri', authenticateRequest, deleteGraphAsync)

app.use(errorHandler)

/**
 * Starts the Express server after preparing shared directories.
 */
async function startServer(): Promise<void> {
  if (!config.adapterToken || config.adapterToken.length < 32) {
    logger.error('VIRTUOSO_ADAPTER_TOKEN must contain at least 32 characters')
    process.exitCode = 1
    return
  }
  if (!config.virtuoso.user || !config.virtuoso.password) {
    logger.error('VIRTUOSO_DBA_USER and VIRTUOSO_DBA_PASSWORD are required')
    process.exitCode = 1
    return
  }

  try {
    await ensureExportsDirectory()
    await initAdminPool()
    if (adminPool) {
      try {
        await loadSqlScripts()
      } catch (error) {
        logger.error('Failed to load SQL scripts on startup', {
          error: (error as Error).message
        })
      }
    }
  } catch (error) {
    logger.error('Failed to initialize exports directory', {
      error: (error as Error).message
    })
  }

  app.listen(config.port, () => {
    logger.info(`API server started on port ${config.port}`)
    logger.info(`Imports directory configured to: ${IMPORTS_PATH}`)
  })
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...')
  await destroyAllSessions()
  process.exit(0)
})

startServer()

export default app
