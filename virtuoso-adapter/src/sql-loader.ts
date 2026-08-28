import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { logger } from './logger'
import { getAdminConnection } from './session-manager'

const SQL_DIR = path.resolve(process.cwd(), 'sql')
const SQL_EXTENSION = '.sql'

export async function loadSqlScripts(): Promise<void> {
  let dirEntries: import('fs').Dirent[]

  try {
    dirEntries = await fsp.readdir(SQL_DIR, { withFileTypes: true })
  } catch (error) {
    throw new Error(
      `SQL directory not found at ${SQL_DIR}: ${(error as Error).message}`
    )
  }

  const scripts: { filename: string; content: string }[] = []

  for (const entry of dirEntries) {
    if (!entry.isFile() || !entry.name.endsWith(SQL_EXTENSION)) {
      continue
    }

    const filePath = path.join(SQL_DIR, entry.name)
    const content = await fsp.readFile(filePath, 'utf-8')

    scripts.push({ filename: entry.name, content })
  }

  if (scripts.length === 0) {
    logger.info('No SQL scripts found; skipping execution')
    return
  }

  const connection = await getAdminConnection()

  try {
    logger.info('Executing SQL scripts')
    let failedCount = 0

    for (const script of scripts) {
      try {
        await connection.query(script.content)
      } catch (error) {
        const err = error as any
        logger.error('Failed to execute SQL script', {
          filename: script.filename,
          error: err.message,
          odbcErrors: err.odbcErrors
        })
        failedCount++
      }
    }

    if (failedCount > 0) {
      logger.warn(`${failedCount} SQL scripts failed`)
    } else {
      logger.info('SQL scripts executed successfully')
    }
  } finally {
    await connection.close()
  }
}
