import 'server-only'

import { ConnectionError } from '@/lib/errors'
import { tryCatch } from '@/lib/result'
import {
  getRuntimeConfig,
  type VirtuosoRuntimeConfig
} from '@/lib/runtime/config'
import { executeIsqlCommand } from '@/providers/virtuoso/odbc-connection'

export function getVirtuosoConfig(): VirtuosoRuntimeConfig {
  const config = getRuntimeConfig()
  if (config.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    throw new Error('Virtuoso capability requested in a QLever deployment')
  }
  return config
}

export async function cfgItemValue(
  section: string,
  key: string
): Promise<string | null> {
  const result = await tryCatch(async () => {
    const sqlQuery = `SELECT cfg_item_value(virtuoso_ini_path(), '${section}', '${key}') AS "value"`

    const data = await executeIsqlCommand<{ value: string }[]>(sqlQuery, {
      useServiceCredentials: true
    })
    return data[0]?.value
  })

  if (!result.success) {
    if (result.error instanceof ConnectionError) {
      console.warn(
        `Virtuoso adapter unavailable - cannot fetch config ${section}.${key}:`,
        result.error.message
      )
      return null
    }
    console.error('Error executing cfg_item_value:', result.error)
    throw result.error
  }

  return result.data ?? null
}
