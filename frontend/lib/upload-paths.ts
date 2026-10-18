import 'server-only'

import { mkdir } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'

const UPLOADS_ROOT = join(process.cwd(), 'uploads')

export async function ensureUserUploadsDir(userId: string): Promise<string> {
  const dir = join(UPLOADS_ROOT, userId)
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Resolves a client-supplied staged file name inside the user's uploads
 * directory. Only the final path segment is kept, and the resolved target
 * must stay inside that directory, so separators and traversal segments
 * cannot land anywhere else on the filesystem.
 */
export function stagedUploadPath(userId: string, filename: string): string {
  const dir = resolve(UPLOADS_ROOT, userId)
  const target = resolve(dir, basename(filename))
  if (!target.startsWith(dir + sep)) {
    throw new Error('Invalid staged file name')
  }
  return target
}
