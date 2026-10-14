import 'server-only'

import {
  getRuntimeConfig,
  type OxigraphRuntimeConfig
} from '@/lib/runtime/config'
import { createSpecSparqlTransport } from '@/providers/spec/sparql'

function config(): OxigraphRuntimeConfig {
  const value = getRuntimeConfig()
  if (value.TRIPLESTORE_PROVIDER !== 'oxigraph') {
    throw new Error('Oxigraph transport requested in a different deployment')
  }
  return value
}

export const oxigraphSparqlTransport = createSpecSparqlTransport({
  resolveConnection: () => {
    const value = config()
    return {
      label: 'Oxigraph',
      endpoint: value.SPARQL_ENDPOINT,
      timeoutMs: value.SPARQL_TIMEOUT_MS
    }
  }
})
