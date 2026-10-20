'use server'

import type { FileHandle } from 'node:fs/promises'
import { open, unlink } from 'node:fs/promises'

import type { ChunkUploadHandler } from 'nextjs-chunk-upload-action'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { ensureUserUploadsDir, stagedUploadPath } from '@/lib/upload-paths'

const MAX_CHUNK_SIZE = 10 * 1024 * 1024 // 10MB max per chunk
const MAX_STAGED_SIZE = 100 * 1024 * 1024 * 1024

interface ChunkMetadata {
  name: string
  totalSize: number
  [key: string]: string | number
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
  const runtime = await getWorkbenchRuntime()
  const principal = await runtime.auth.getPrincipal()
  if (!principal) {
    throw new Error('Sign in to upload files.')
  }

  const blob = chunkFormData.get('blob')
  if (!blob || !(blob instanceof Blob)) {
    throw new Error("Part of the upload didn't transfer. Try again.")
  }

  // Validate chunk size
  if (blob.size > MAX_CHUNK_SIZE) {
    throw new Error(
      `A chunk was larger than the ${MAX_CHUNK_SIZE / (1024 * 1024)} MB limit.`
    )
  }

  const offset = Number(chunkFormData.get('offset'))
  if (Number.isNaN(offset) || offset < 0) {
    throw new Error("The upload didn't line up. Try again.")
  }

  const totalSize = Number(metadata.totalSize)
  if (
    !Number.isInteger(totalSize) ||
    totalSize < 0 ||
    totalSize > MAX_STAGED_SIZE
  ) {
    throw new Error('The file size looks wrong. Try again.')
  }
  if (offset + blob.size > totalSize) {
    throw new Error("The upload doesn't match the file size. Try again.")
  }

  const buffer = Buffer.from(await blob.arrayBuffer())

  await ensureUserUploadsDir(principal.id)
  const filePath = stagedUploadPath(principal.id, metadata.name)

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
