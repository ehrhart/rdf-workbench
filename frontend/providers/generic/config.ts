import 'server-only'

import {
  type GenericRuntimeConfig,
  getRuntimeConfig
} from '@/lib/runtime/config'

export const GENERIC_LABEL = 'Generic SPARQL'

export function genericConfig(): GenericRuntimeConfig {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'generic') {
    throw new Error('Generic provider requested in a different deployment')
  }
  return value
}
