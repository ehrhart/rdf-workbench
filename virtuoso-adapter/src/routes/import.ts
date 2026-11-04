import crypto from 'node:crypto'
import path from 'node:path'
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
import type {
  BulkLoadRequest,
  BulkLoadResponse,
  ErrorResponse,
  TextImportRequest,
  UrlImportRequest
} from '../types'

// Configure multer to stream directly to disk for large file support (>2GB).
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
    // Server-generated name: the client never controls where its upload
    // lands. The extension decides how the bulk loader parses the file.
    const ext = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '')
      .slice(0, 16)
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
})

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
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}

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

      logger.info('File uploaded to imports folder', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        sizeMB: fileSizeMB,
        durationMs: uploadDuration,
        throughputMBps,
        path: IMPORTS_PATH
      })

      res.json({
        filename: req.file.filename,
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
        message: 'The request could not be completed'
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
      message: 'The request could not be completed'
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
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}

export async function bulkLoad(req: Request, res: Response): Promise<void> {
  const { filename, graphIri } = req.body as BulkLoadRequest

  if (!filename || !graphIri) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Filename and graphIri are required'
    } as ErrorResponse)
    return
  }

  const exists = await fileExists(filename)
  if (!exists) {
    res.status(404).json({
      error: 'File not found',
      message: `File ${filename} does not exist in the imports directory`
    } as ErrorResponse)
    return
  }

  try {
    const jobId = await registerBulkLoadJob(filename, graphIri)

    startBulkLoad().catch((error) => {
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
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}

export async function getJobStatus(req: Request, res: Response): Promise<void> {
  const jobId = String(req.params.jobId)

  try {
    const jobStatus = await getBulkLoadJobStatus(jobId)
    res.json(jobStatus)
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching job status', { error: err.message, jobId })
    res.status(500).json({
      error: 'Failed to fetch job status',
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}

export async function getAllJobs(req: Request, res: Response): Promise<void> {
  try {
    const jobs = await getAllBulkLoadJobs()
    res.json({ jobs })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching all jobs', { error: err.message })
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  const jobId = String(req.params.jobId)

  try {
    await cancelBulkLoadJob(jobId)
    res.json({ success: true, message: 'Job cancelled successfully' })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Error cancelling job', { error: err.message, jobId })
    res.status(500).json({
      error: 'Failed to cancel job',
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}

export async function deleteFileHandler(
  req: Request,
  res: Response
): Promise<void> {
  const filename = String(req.params.filename)

  try {
    await deleteFile(filename)

    await removeBulkLoadJobsForFile(filename)

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
      message: 'The request could not be completed'
    } as ErrorResponse)
    return
  }
}
