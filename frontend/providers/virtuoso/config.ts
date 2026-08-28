import 'server-only'

import {
  getRuntimeConfig,
  type VirtuosoRuntimeConfig
} from '@/lib/runtime/config'

export function getVirtuosoConfig(): VirtuosoRuntimeConfig {
  const config = getRuntimeConfig()
  if (config.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    throw new Error('Virtuoso capability requested in a QLever deployment')
  }
  return config
}
