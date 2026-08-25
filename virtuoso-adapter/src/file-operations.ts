import fs from 'node:fs'
import path from 'node:path'

import { promisify } from 'node:util'
import { IMPORTS_PATH, MAX_UPLOAD_BYTES } from './config'
import { logger } from './logger'

// Promisified file system operations for async/await usage
const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)
const statAsync = promisify(fs.stat)
const mkdirAsync = promisify(fs.mkdir)
const accessAsync = promisify(fs.access)

const REMOTE_FETCH_TIMEOUT_MS = 60_000

async function readRemoteBody(
  response: Response,
  limit: number
): Promise<Buffer> {
  if (!response.body) {
    throw new Error('Remote response has no body')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      throw new Error(
        `Remote file exceeds the maximum allowed size of ${limit} bytes`
      )
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/**
 * Ensures the imports directory exists, creating it if necessary.
 * @returns Success confirmation with directory path
 */
export async function ensureImportsDirectory(): Promise<{
  success: boolean
  path: string
}> {
  try {
    // Check if directory exists, create if it doesn't
    try {
      await accessAsync(IMPORTS_PATH, fs.constants.F_OK)
    } catch {
      await mkdirAsync(IMPORTS_PATH, { recursive: true })
    }

    logger.info('Imports directory ensured', { path: IMPORTS_PATH })
    return { success: true, path: IMPORTS_PATH }
  } catch (error) {
    const err = error as Error
    logger.error('Error ensuring imports directory', { error: err.message })
    throw err
  }
}

export function userImportsPath(userId: string): string {
  return path.join(IMPORTS_PATH, userId)
}

export async function ensureUserImportsDirectory(
  userId: string
): Promise<string> {
  const dir = userImportsPath(userId)
  await mkdirAsync(dir, { recursive: true })
  return dir
}

/**
 * Saves an uploaded file to the imports directory.
 * @param filename Original filename
 * @param buffer File buffer
 * @returns File metadata
 */
export async function saveUploadedFile(
  filename: string,
  buffer: Buffer
): Promise<{ filename: string; size: number; path: string }> {
  await ensureImportsDirectory()
  const filePath = path.join(IMPORTS_PATH, filename)

  // Write file to imports folder
  await writeFileAsync(filePath, buffer)

  logger.info('File uploaded to imports folder', {
    filename,
    size: buffer.length,
    path: filePath
  })

  return {
    filename,
    size: buffer.length,
    path: filePath
  }
}

function sanitizeBasename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return cleaned.length > 0 ? cleaned : 'import'
}

function normalizeExtension(extension?: string): string {
  if (!extension) return ''
  return extension.startsWith('.') ? extension : `.${extension}`
}

async function ensureUniqueFilename(
  filename: string,
  userId: string
): Promise<string> {
  if (!(await fileExists(filename, userId))) {
    return filename
  }

  const parsed = path.parse(filename)
  let counter = 1

  // Append incremental suffix until an unused filename is found
  // Example: dataset.ttl -> dataset-1.ttl
  while (await fileExists(`${parsed.name}-${counter}${parsed.ext}`, userId)) {
    counter += 1
  }

  return `${parsed.name}-${counter}${parsed.ext}`
}

async function resolveFilename(options: {
  desiredName?: string
  fallbackBase: string
  fallbackExtension: string
  extensionHint?: string
  userId: string
}): Promise<string> {
  const {
    desiredName,
    fallbackBase,
    fallbackExtension,
    extensionHint,
    userId
  } = options

  const normalizedFallbackExt = normalizeExtension(fallbackExtension)
  const normalizedHintExt = normalizeExtension(extensionHint)

  const trimmedDesiredName = desiredName?.trim()

  let base = sanitizeBasename(fallbackBase)
  let extension = normalizedHintExt || normalizedFallbackExt

  if (trimmedDesiredName) {
    const desiredExt = path.extname(trimmedDesiredName)
    const desiredBase = path.basename(trimmedDesiredName, desiredExt)
    base = sanitizeBasename(desiredBase)
    extension =
      normalizeExtension(desiredExt) ||
      normalizedHintExt ||
      normalizedFallbackExt
  }

  if (!extension) {
    extension = '.ttl'
  }

  const candidate = `${base}${extension}`
  return ensureUniqueFilename(candidate, userId)
}

async function writeBufferToImports(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<{ filename: string; size: number; path: string }> {
  const dir = await ensureUserImportsDirectory(userId)
  const filePath = path.join(dir, filename)
  await writeFileAsync(filePath, buffer)

  logger.info('File written to imports folder', {
    filename,
    size: buffer.length,
    path: filePath
  })

  return {
    filename,
    size: buffer.length,
    path: filePath
  }
}

export async function saveRemoteFile(
  sourceUrl: string,
  preferredFilename?: string,
  extensionHint?: string,
  userId?: string
): Promise<{ filename: string; size: number; path: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(sourceUrl, {
        signal: controller.signal,
        redirect: 'follow'
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`)
    }

    const buffer = await readRemoteBody(response, MAX_UPLOAD_BYTES)

    if (buffer.length === 0) {
      throw new Error('Downloaded file is empty')
    }

    const url = new URL(sourceUrl)
    const urlPath = url.pathname.split('/').filter(Boolean).pop() ?? ''
    const parsed = path.parse(urlPath)

    const fallbackBase = parsed.name || 'remote-import'
    const fallbackExt = parsed.ext || '.ttl'

    const filename = await resolveFilename({
      desiredName: preferredFilename,
      fallbackBase,
      fallbackExtension: fallbackExt,
      extensionHint,
      userId: userId ?? 'shared'
    })

    logger.info('Saving remote RDF import', {
      sourceUrl,
      filename,
      size: buffer.length
    })

    return writeBufferToImports(buffer, filename, userId ?? 'shared')
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching RDF from URL', {
      sourceUrl,
      error: err.message
    })
    throw err
  }
}

export async function saveTextSnippet(
  content: string,
  preferredFilename?: string,
  extensionHint?: string,
  userId?: string
): Promise<{ filename: string; size: number; path: string }> {
  const normalizedContent = content.replace(/^(\uFEFF)/, '') // remove UTF-8 BOM if present
  if (normalizedContent.trim().length === 0) {
    throw new Error('Snippet content is empty')
  }

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')

  const fallbackBase = `snippet-${timestamp}`
  const filename = await resolveFilename({
    desiredName: preferredFilename,
    fallbackBase,
    fallbackExtension: '.ttl',
    extensionHint,
    userId: userId ?? 'shared'
  })

  const buffer = Buffer.from(normalizedContent, 'utf-8')

  logger.info('Saving RDF snippet to imports folder', {
    filename,
    size: buffer.length
  })

  return writeBufferToImports(buffer, filename, userId ?? 'shared')
}

/**
 * Checks if a file exists in the user's imports directory.
 * @param filename Name of the file to check
 * @param userId Owner of the file
 * @returns True if file exists
 */
export async function fileExists(
  filename: string,
  userId?: string
): Promise<boolean> {
  const filePath = path.join(userImportsPath(userId ?? 'shared'), filename)
  try {
    await statAsync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Deletes a file from the user's imports directory.
 * @param filename Name of the file to delete
 * @param userId Owner of the file
 */
export async function deleteFile(
  filename: string,
  userId?: string
): Promise<void> {
  const filePath = path.join(userImportsPath(userId ?? 'shared'), filename)

  try {
    await unlinkAsync(filePath)
    logger.info('File deleted from imports folder', { filename })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn('File not found for deletion', { filename })
    } else {
      throw error // Rethrow other errors
    }
  }
}
