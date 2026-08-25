'use server'

import type { FileHandle } from 'node:fs/promises'
import { mkdir, open, unlink } from 'node:fs/promises'
import { join } from 'node:path'

import type { ChunkUploadHandler } from 'nextjs-chunk-upload-action'
import { getWorkbenchRuntime } from '@/lib/runtime'

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const MAX_CHUNK_SIZE = 10 * 1024 * 1024 // 10MB max per chunk

interface ChunkMetadata {
  name: string
  totalSize: number
  [key: string]: string | number
}

async function userUploadsDir(): Promise<string> {
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  const dir = join(UPLOADS_DIR, principal?.id ?? 'anonymous')
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Server action to handle chunked file uploads.
 * Saves chunks to a per-user temporary uploads directory in the frontend so
 * concurrent uploads of the same filename by different users do not collide.
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

  const filePath = join(await userUploadsDir(), metadata.name)

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
