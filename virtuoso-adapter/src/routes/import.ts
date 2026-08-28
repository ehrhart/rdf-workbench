import type { Request, Response } from 'express'
import multer from 'multer'
import {
  cancelBulkLoadJob,
  getAllBulkLoadJobs,
  getBulkLoadJobStatus,
  registerBulkLoadJob,
  removeBulkLoadJobsForFile,
  startBulkLoad
} from '../bulk-load'
import { IMPORTS_PATH, MAX_UPLOAD_BYTES } from '../config'
import {
  deleteFile,
  ensureImportsDirectory,
  fileExists,
  saveRemoteFile,
  saveTextSnippet
} from '../file-operations'
import { logger } from '../logger'
import type { VirtuosoSession } from '../session-manager'
import type {
  BulkLoadRequest,
  BulkLoadResponse,
  ErrorResponse,
  TextImportRequest,
  UrlImportRequest
} from '../types'

// Configure multer to stream directly to disk for large file support (>2GB)
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await ensureImportsDirectory()
      cb(null, IMPORTS_PATH)
    } catch (error) {
      cb(error as Error, IMPORTS_PATH)
    }
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
})

/**
 * Ensures the imports directory exists, creating it if necessary.
 * @returns Success confirmation with directory path
 */
function ensureSession(req: Request, res: Response): VirtuosoSession | null {
  const session = req.dbSession
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Database session is not available'
    } as ErrorResponse)
    return null
  }
  return session
}

export async function ensureDirectory(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await ensureImportsDirectory()
    res.json(result)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error ensuring imports directory', { error: err.message })
    res.status(500).json({
      error: 'Failed to ensure imports directory',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Uploads an RDF file to the local imports directory for bulk loading.
 * Uses diskStorage to stream large files (>2GB) directly to disk.
 * @param file Multipart file upload
 * @returns File metadata or error response
 */
export const uploadFile = [
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now()

    if (!req.file) {
      res.status(400).json({
        error: 'No file uploaded',
        message: 'No file was found in the request'
      } as ErrorResponse)
      return
    }

    try {
      const uploadDuration = Date.now() - startTime
      const fileSizeMB = (req.file.size / 1024 / 1024).toFixed(2)
      const throughputMBps = (
        req.file.size /
        1024 /
        1024 /
        (uploadDuration / 1000)
      ).toFixed(2)

      // File is already saved by multer's diskStorage
      logger.info('File uploaded to imports folder', {
        filename: req.file.originalname,
        size: req.file.size,
        sizeMB: fileSizeMB,
        durationMs: uploadDuration,
        throughputMBps,
        path: IMPORTS_PATH
      })

      res.json({
        filename: req.file.originalname,
        size: req.file.size,
        path: IMPORTS_PATH
      })
      return
    } catch (error) {
      const err = error as Error
      logger.error('Error uploading file to imports folder', {
        error: err.message,
        filename: req.file.originalname,
        durationMs: Date.now() - startTime
      })
      res.status(500).json({
        error: 'Failed to upload file to imports folder',
        message: err.message
      } as ErrorResponse)
      return
    }
  }
]

export async function uploadFromUrl(
  req: Request,
  res: Response
): Promise<void> {
  const { url, extension }: UrlImportRequest = req.body

  if (!url || typeof url !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'URL is required'
    } as ErrorResponse)
    return
  }

  try {
    const result = await saveRemoteFile(url, undefined, extension)
    res.json(result)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error importing RDF from URL', {
      url,
      error: err.message
    })
    res.status(500).json({
      error: 'Failed to import from URL',
      message: err.message
    } as ErrorResponse)
    return
  }
}

export async function uploadSnippet(
  req: Request,
  res: Response
): Promise<void> {
  const { content, extension }: TextImportRequest = req.body

  if (!content || typeof content !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Content is required'
    } as ErrorResponse)
    return
  }

  try {
    const result = await saveTextSnippet(content, undefined, extension)
    res.json(result)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error saving RDF snippet', {
      error: err.message
    })
    res.status(500).json({
      error: 'Failed to save snippet',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Initiates bulk RDF loading for an uploaded file into a specified graph.
 * Registers the file in Virtuoso's LOAD_LIST and starts the loader process.
 * @param filename Name of the uploaded file in imports directory
 * @param graphIri Target graph IRI for the RDF data
 * @returns Job ID and status or error response
 */
export async function bulkLoad(req: Request, res: Response): Promise<void> {
  const { filename, graphIri } = req.body as BulkLoadRequest

  if (!filename || !graphIri) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Filename and graphIri are required'
    } as ErrorResponse)
    return
  }

  // Check if file exists in imports folder
  const exists = await fileExists(filename)
  if (!exists) {
    res.status(404).json({
      error: 'File not found',
      message: `File ${filename} does not exist in the imports directory`
    } as ErrorResponse)
    return
  }

  const session = ensureSession(req, res)
  if (!session) {
    return
  }

  try {
    const jobId = await registerBulkLoadJob(session, filename, graphIri)

    startBulkLoad(session).catch((error) => {
      logger.error('Background bulk load failed to start', {
        error: (error as Error).message
      })
    })

    res.json({
      jobId,
      status: 'queued',
      message: 'Bulk load job queued successfully'
    } as BulkLoadResponse)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error creating bulk load job', {
      error: err.message,
      filename,
      graphIri
    })
    res.status(500).json({
      error: 'Failed to create bulk load job',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Retrieves the status of a specific bulk load job.
 * @param jobId Job identifier in format "filename|graphIri"
 * @returns Job status details or error response
 */
export async function getJobStatus(req: Request, res: Response): Promise<void> {
  const jobId = req.params.jobId

  const session = ensureSession(req, res)
  if (!session) {
    return
  }

  try {
    const jobStatus = await getBulkLoadJobStatus(session, jobId)
    res.json(jobStatus)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching job status', { error: err.message, jobId })
    res.status(500).json({
      error: 'Failed to fetch job status',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Retrieves all bulk load jobs from the LOAD_LIST table.
 * @returns Array of all job statuses
 */
export async function getAllJobs(req: Request, res: Response): Promise<void> {
  const session = ensureSession(req, res)
  if (!session) {
    return
  }

  try {
    const jobs = await getAllBulkLoadJobs(session)
    res.json({ jobs })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching all jobs', { error: err.message })
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Cancels a running or queued bulk load job.
 * Stops the loader and removes the job from LOAD_LIST.
 * @param jobId Job identifier in format "filename|graphIri"
 * @returns Success confirmation or error response
 */
export async function cancelJob(req: Request, res: Response): Promise<void> {
  const jobId = req.params.jobId

  const session = ensureSession(req, res)
  if (!session) {
    return
  }

  try {
    await cancelBulkLoadJob(session, jobId)
    res.json({ success: true, message: 'Job cancelled successfully' })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error cancelling job', { error: err.message, jobId })
    res.status(500).json({
      error: 'Failed to cancel job',
      message: err.message
    } as ErrorResponse)
    return
  }
}

/**
 * Deletes an uploaded file from the imports directory.
 * Also removes any associated bulk load jobs from LOAD_LIST.
 * @param filename Name of the file to delete
 * @returns Success confirmation or error response
 */
export async function deleteFileHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { filename } = req.params

  const session = ensureSession(req, res)
  if (!session) {
    return
  }

  try {
    // Delete the file
    await deleteFile(filename)

    // Delete any related jobs from LOAD_LIST if needed
    await removeBulkLoadJobsForFile(session, filename)

    res.json({ success: true, message: 'File deleted successfully' })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error deleting file from imports folder', {
      error: err.message,
      filename
    })
    res.status(500).json({
      error: 'Failed to delete file',
      message: err.message
    } as ErrorResponse)
    return
  }
}
