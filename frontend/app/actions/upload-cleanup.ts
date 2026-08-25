'use server'

import { cleanStaleUploads } from '@/lib/upload-cleanup'

export async function cleanupStaleUploads(): Promise<void> {
  await cleanStaleUploads()
}
