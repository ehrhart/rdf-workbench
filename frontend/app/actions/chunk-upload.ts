'use server'

import type { FileHandle } from 'node:fs/promises'
import { mkdir, open, unlink } from 'node:fs/promises'
import { join } from 'node:path'

import type { ChunkUploadHandler } from 'nextjs-chunk-upload-action'

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const MAX_CHUNK_SIZE = 10 * 1024 * 1024 // 10MB max per chunk

interface ChunkMetadata {
  name: string
  totalSize: number
  [key: string]: string | number
}

/**
 * Server action to handle chunked file uploads.
 * Saves chunks to a temporary uploads directory in the frontend.
 */
export const chunkUploadAction: ChunkUploadHandler<ChunkMetadata> = async (
  chunkFormData,
  metadata
) => {
  const blob = chunkFormData.get('blob')
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Invalid chunk data')
  }

  // Validate chunk size
  if (blob.size > MAX_CHUNK_SIZE) {
    throw new Error(`Chunk size ${blob.size} exceeds maximum ${MAX_CHUNK_SIZE}`)
  }

  const offset = Number(chunkFormData.get('offset'))
  if (Number.isNaN(offset) || offset < 0) {
    throw new Error('Invalid offset')
  }

  const buffer = Buffer.from(await blob.arrayBuffer())

  // Ensure uploads directory exists
  await mkdir(UPLOADS_DIR, { recursive: true })

  const filePath = join(UPLOADS_DIR, metadata.name)

  let fileHandle: FileHandle | undefined
  try {
    // Open for writing (create if doesn't exist) or for read/write (if exists)
    fileHandle = await open(filePath, offset === 0 ? 'w' : 'r+')
    await fileHandle.write(buffer, 0, buffer.length, offset)
  } catch (error) {
    // Clean up partial file on error
    try {
      await unlink(filePath)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  } finally {
    await fileHandle?.close()
  }
}
