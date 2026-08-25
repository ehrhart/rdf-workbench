import 'server-only'

import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const STALE_MS = 24 * 60 * 60 * 1000
const MIN_INTERVAL_MS = 60 * 60 * 1000

let lastCleanupAt = 0

export async function cleanStaleUploads(): Promise<void> {
  const now = Date.now()
  if (now - lastCleanupAt < MIN_INTERVAL_MS) return
  lastCleanupAt = now

  let names: string[]
  try {
    names = await readdir(UPLOADS_DIR)
  } catch {
    return
  }

  for (const name of names) {
    const target = join(UPLOADS_DIR, name)
    try {
      const info = await stat(target)
      if (now - info.mtimeMs > STALE_MS) {
        await rm(target, { recursive: true, force: true })
      }
    } catch {
      // Skip unreadable entries
    }
  }
}
