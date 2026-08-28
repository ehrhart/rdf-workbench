import {
  createReadStream,
  constants as fsConstants,
  promises as fsp
} from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import type { Request, Response } from 'express'
import { IMPORTS_PATH } from '../config'
import { logger } from '../logger'
import type { ErrorResponse } from '../types'

const SHARED_ROOT = path.resolve(IMPORTS_PATH)
const EXPORTS_SUBDIRECTORY = 'exports'
const EXPORTS_DIRECTORY = path.join(SHARED_ROOT, EXPORTS_SUBDIRECTORY)

export async function ensureExportsDirectory(): Promise<void> {
  await fsp.mkdir(EXPORTS_DIRECTORY, { recursive: true })
}

function sanitizeRelativePath(value: string): string {
  const trimmed = value.trim().replace(/^[/\\]+/, '')
  const normalized = path.normalize(trimmed)
  if (normalized === '' || normalized === '.' || normalized === path.sep) {
    return ''
  }
  return normalized.replace(/^\.\.(?:[/\\]|$)/g, '')
}

function resolveSafePath(relativePath: string): string {
  const sanitized = sanitizeRelativePath(relativePath)
  const target = path.resolve(SHARED_ROOT, sanitized)
  if (!target.startsWith(SHARED_ROOT)) {
    throw new Error('Path is outside of shared directory')
  }
  return target
}

interface SharedFileEntry {
  name: string
  relativePath: string
  size: number
  modified: string
}

export async function listSharedFiles(
  req: Request,
  res: Response
): Promise<void> {
  const subdirParam =
    typeof req.query.subdir === 'string' ? req.query.subdir : ''
  const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : ''
  const extensionParam =
    typeof req.query.extension === 'string' ? req.query.extension : ''

  const extension = extensionParam.trim().replace(/^\.+/, '').toLowerCase()

  try {
    if (!subdirParam || subdirParam === EXPORTS_SUBDIRECTORY) {
      await ensureExportsDirectory()
    }

    const targetDir = resolveSafePath(subdirParam || '.')
    const entries = await fsp.readdir(targetDir, { withFileTypes: true })

    const files: SharedFileEntry[] = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (prefix && !entry.name.startsWith(prefix)) continue
      if (extension && !entry.name.toLowerCase().endsWith(`.${extension}`))
        continue

      const absolutePath = path.join(targetDir, entry.name)
      const stats = await fsp.stat(absolutePath)
      const relativePath = path
        .relative(SHARED_ROOT, absolutePath)
        .replace(/\\/g, '/')

      files.push({
        name: entry.name,
        relativePath,
        size: stats.size,
        modified: stats.mtime.toISOString()
      })
    }

    files.sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      directory:
        path.relative(SHARED_ROOT, targetDir).replace(/\\/g, '/') || '.',
      files
    })
    return
  } catch (error) {
    const err = error as Error
    logger.error('Failed to list shared files', {
      error: err.message,
      subdir: subdirParam,
      prefix,
      extension
    })
    res.status(500).json({
      error: 'Failed to list files',
      message: err.message
    } as ErrorResponse)
  }
}

export async function downloadSharedFile(
  req: Request,
  res: Response
): Promise<void> {
  const relativePathParam =
    typeof req.query.path === 'string' ? req.query.path : ''
  const decompress =
    req.query.decompress === 'true' || req.query.decompress === '1'

  if (!relativePathParam) {
    res.status(400).json({
      error: 'Missing path',
      message: 'Query parameter "path" is required'
    } as ErrorResponse)
    return
  }

  try {
    if (relativePathParam.startsWith(`${EXPORTS_SUBDIRECTORY}/`)) {
      await ensureExportsDirectory()
    }

    const absolutePath = resolveSafePath(relativePathParam)
    await fsp.access(absolutePath, fsConstants.R_OK)

    const stat = await fsp.stat(absolutePath)
    const fileName = path.basename(absolutePath)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName.replace(/"/g, '')}"`
    )
    if (!decompress) {
      res.setHeader('Content-Length', stat.size.toString())
    }

    const sourceStream = createReadStream(absolutePath)

    if (decompress && absolutePath.toLowerCase().endsWith('.gz')) {
      await pipeline(sourceStream, createGunzip(), res)
      return
    }

    await pipeline(sourceStream, res)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      res.status(404).json({
        error: 'File not found',
        message: `No file found for path ${relativePathParam}`
      } as ErrorResponse)
      return
    }

    logger.error('Failed to stream shared file', {
      error: err.message,
      path: relativePathParam
    })
    res.status(500).json({
      error: 'Failed to stream file',
      message: err.message
    } as ErrorResponse)
  }
}

export async function deleteSharedFiles(
  req: Request,
  res: Response
): Promise<void> {
  const paths = Array.isArray(req.body?.paths)
    ? req.body.paths.filter(
        (value: unknown): value is string =>
          typeof value === 'string' && value.trim().length > 0
      )
    : []

  if (paths.length === 0) {
    res.status(400).json({
      error: 'No files specified',
      message: 'Provide at least one relative path in the "paths" array'
    } as ErrorResponse)
    return
  }

  try {
    await Promise.all(
      paths.map(async (relativePath: string) => {
        const absolutePath = resolveSafePath(relativePath)
        await fsp.unlink(absolutePath)
      })
    )

    res.json({ success: true, deleted: paths.length })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      res.status(404).json({
        error: 'File not found',
        message: err.message
      } as ErrorResponse)
      return
    }

    logger.error('Failed to delete shared files', {
      error: err.message,
      paths
    })
    res.status(500).json({
      error: 'Failed to delete files',
      message: err.message
    } as ErrorResponse)
  }
}
