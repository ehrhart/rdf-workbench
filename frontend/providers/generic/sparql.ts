import 'server-only'

import { createSpecSparqlTransport } from '@/providers/spec/sparql'
import { GENERIC_LABEL, genericConfig } from './config'

export const genericSparqlTransport = createSpecSparqlTransport({
  resolveConnection: () => {
    const value = genericConfig()
    return {
      label: GENERIC_LABEL,
      endpoint: value.SPARQL_ENDPOINT,
      timeoutMs: value.SPARQL_TIMEOUT_MS
    }
  }
})
