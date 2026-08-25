'use server'

import { AuthError, ConnectionError } from '@/lib/errors'
import { tryCatch } from '@/lib/result'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type {
  EndpointStats,
  NamedGraph,
  ResourceSuggestion,
  SparqlBindingValue
} from '@/types'
import { executeIsqlCommand, executeIsqlWithAuth } from './odbc-connection'
import { deleteSession, getAuthTokenFromCookie } from './session'
import { virtuosoSparqlTransport } from './sparql'

const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''")

function config() {
  const runtime = getRuntimeConfig()
  if (runtime.TRIPLESTORE_PROVIDER !== 'virtuoso') {
    throw new Error('Virtuoso integration requested in a QLever deployment')
  }
  return runtime
}

export async function getResourceSuggestions(
  searchTerm: string
): Promise<ResourceSuggestion[]> {
  if (!searchTerm || searchTerm.length < 2) {
    return []
  }

  const result = await tryCatch(async () => {
    const escapedTerm = searchTerm.replace(/"/g, '\\"')

    const query = `
      DEFINE input:same-as "SAME_AS_OFF"
      SELECT ?resource, 
         (bif:search_excerpt (bif:vector ('${escapedTerm}'), ?o)) AS ?excerpt,
         ?sc,
         ?graph
      WHERE {
        GRAPH ?graph {
          ?resource ?p ?o .
          ?o bif:contains '"${escapedTerm}"' OPTION (score ?sc) .
        }
      }
      ORDER BY DESC(?sc)
      LIMIT 10
    `

    return virtuosoSparqlTransport.execute(query)
  })

  if (!result.success) {
    console.error('Error fetching resource suggestions:', result.error)
    return []
  }

  if (!result.data || result.data.kind !== 'bindings') {
    return []
  }

  return result.data.bindings.map((binding, index: number) => ({
    id: index.toString(),
    resource: binding.resource?.value || '',
    excerpt: binding.excerpt?.value || '',
    score: parseFloat(binding.score?.value || '0'),
    rank: parseFloat(binding.rank?.value || '0'),
    graph: binding.graph?.value || ''
  }))
}

// Prefix management
export async function getPrefixes(): Promise<Record<string, string>> {
  const result = await executeIsqlWithAuth<
    {
      NS_PREFIX: string
      NS_URL: string
    }[]
  >(
    'SELECT NS_PREFIX, NS_URL FROM DB.DBA.SYS_XML_PERSISTENT_NS_DECL ORDER BY LOWER(NS_PREFIX)'
  )
  if (!result || !Array.isArray(result)) {
    throw new Error('Failed to retrieve prefixes')
  }
  return result.reduce(
    (acc, { NS_PREFIX, NS_URL }) => {
      acc[NS_PREFIX] = NS_URL
      return acc
    },
    {} as Record<string, string>
  )
}

export async function addPrefix(
  prefix: string,
  namespace: string
): Promise<Record<string, string>> {
  const sanitizedPrefix = escapeSqlLiteral(prefix)
  const sanitizedNamespace = escapeSqlLiteral(namespace)

  await executeIsqlWithAuth(
    `DB.DBA.XML_SET_NS_DECL('${sanitizedPrefix}', '${sanitizedNamespace}', 2)`
  )

  const allPrefixes = await getPrefixes()
  const newNamespace = allPrefixes[prefix]

  if (!newNamespace) {
    throw new Error("Prefix was added but couldn't be retrieved")
  }

  return {
    [prefix]: newNamespace
  }
}

export async function updatePrefix(
  oldPrefix: string,
  newPrefix: string,
  namespace: string
) {
  const sanitizedOldPrefix = escapeSqlLiteral(oldPrefix)
  const sanitizedNewPrefix = escapeSqlLiteral(newPrefix)
  const sanitizedNamespace = escapeSqlLiteral(namespace)

  const currentNamespaces = await getPrefixes()
  const currentNamespace = currentNamespaces[oldPrefix]

  if (!currentNamespace) {
    throw new Error('Namespace not found')
  }

  const sanitizedCurrentNamespace = escapeSqlLiteral(currentNamespace)

  const result = await tryCatch(async () => {
    await executeIsqlWithAuth(
      `DB.DBA.XML_REMOVE_NS_BY_PREFIX('${sanitizedOldPrefix}', 2)`
    )

    await executeIsqlWithAuth(
      `DB.DBA.XML_SET_NS_DECL('${sanitizedNewPrefix}', '${sanitizedNamespace}', 2)`
    )
  })

  if (!result.success) {
    // Rollback: restore the old prefix
    await tryCatch(async () =>
      executeIsqlWithAuth(
        `DB.DBA.XML_SET_NS_DECL('${sanitizedOldPrefix}', '${sanitizedCurrentNamespace}', 2)`
      )
    )
    throw result.error
  }

  const updatedNamespaces = await getPrefixes()
  const updatedNamespace = updatedNamespaces[newPrefix]

  if (!updatedNamespace) {
    throw new Error("Namespace was updated but couldn't be retrieved")
  }

  return {
    [newPrefix]: updatedNamespace
  }
}

export async function deletePrefix(prefix: string): Promise<void> {
  const currentPrefixes = await getPrefixes()
  const prefixToDelete = currentPrefixes[prefix]

  if (!prefixToDelete) {
    throw new Error('Prefix not found')
  }

  const sanitizedPrefix = escapeSqlLiteral(prefix)

  await executeIsqlWithAuth(
    `DB.DBA.XML_REMOVE_NS_BY_PREFIX('${sanitizedPrefix}', 2)`
  )
}

export async function getNamedGraphs(): Promise<NamedGraph[]> {
  // It seems faster to query the RDF_QUAD table directly than using SPARQL for this
  // Equivalent SPARQL query: `SELECT ?graph (COUNT(*) AS ?triples) WHERE { GRAPH ?graph { ?s ?p ?o } } GROUP BY ?graph`
  const result = await tryCatch(async () =>
    executeIsqlCommand<
      {
        graph: string
        triples: number
      }[]
    >(
      'SELECT ID_TO_IRI(g) AS graph, COUNT(*) AS triples FROM DB.DBA.RDF_QUAD GROUP BY g',
      { useServiceCredentials: true }
    )
  )

  if (!result.success) {
    if (result.error instanceof ConnectionError) {
      console.warn(
        'Virtuoso adapter unavailable - returning empty graphs:',
        result.error.message
      )
    } else {
      console.warn('Error fetching named graphs:', result.error)
    }
    return []
  }

  if (!result.data || !Array.isArray(result.data)) {
    console.warn('Invalid result format from getNamedGraphs')
    return []
  }

  return result.data.map((row) => ({
    uri: row.graph,
    tripleCount: row.triples
  }))
}

export async function getGraphTripleCount(uri: string): Promise<number> {
  const sanitizedUri = escapeSqlLiteral(uri)

  const result = await executeIsqlCommand<
    {
      triples: number
    }[]
  >(
    `SELECT COUNT(*) AS triples FROM DB.DBA.RDF_QUAD WHERE g = IRI_TO_ID('${sanitizedUri}')`,
    { useServiceCredentials: true }
  )

  if (!result || !Array.isArray(result)) {
    throw new Error('Failed to retrieve triple count for graph')
  }

  const triples = result[0]?.triples ?? 0
  if (typeof triples !== 'number') {
    return Number.parseInt(String(triples), 10) || 0
  }
  return triples
}

export async function deleteGraph(uri: string): Promise<void> {
  // Call the Virtuoso adapter directly with proper session handling
  // The deletion returns immediately (202 Accepted) while the
  // actual CLEAR GRAPH runs in the background on the server
  const token = await getAuthTokenFromCookie()

  if (!token) {
    throw new AuthError('No valid session')
  }

  const response = await fetch(
    `${config().VIRTUOSO_ADAPTER_URL}/api/graphs/${encodeURIComponent(uri)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  if (response.status === 401) {
    await deleteSession()
    throw new AuthError('Session expired')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      error.error || `Failed to initiate graph deletion: ${response.status}`
    )
  }
}

export async function clearRepository(): Promise<void> {
  await executeIsqlWithAuth('log_enable(3,1); RDF_GLOBAL_RESET()')
}

export async function getEndpointStats(): Promise<EndpointStats> {
  const result = await tryCatch(async () => getNamedGraphs())

  if (!result.success) {
    console.warn(
      'Error fetching endpoint stats - returning defaults:',
      result.error
    )
    return {
      totalTriples: 0,
      namedGraphs: 0,
      recentQueries: 0
    }
  }

  const namedGraphs = result.data
  return {
    totalTriples: namedGraphs.reduce(
      (sum, graph) => sum + graph.tripleCount,
      0
    ),
    namedGraphs: namedGraphs.length,
    recentQueries: 0
  }
}

export async function getProperties(): Promise<string[]> {
  const query = `
    SELECT DISTINCT ?property
    WHERE {
      ?s ?property ?o .
    }
    ORDER BY ?property
    LIMIT 1000
  `

  const result = await virtuosoSparqlTransport.execute(query)

  if (result.kind !== 'bindings') {
    return []
  }

  return result.bindings.map(
    (binding: Record<string, SparqlBindingValue>) =>
      binding.property?.value || ''
  )
}

export async function getClasses(): Promise<string[]> {
  const query = `
    SELECT DISTINCT ?class
    WHERE {
      ?s a ?class .
    }
    ORDER BY ?class
    LIMIT 1000
  `

  const result = await virtuosoSparqlTransport.execute(query)

  if (result.kind !== 'bindings') {
    return []
  }

  return result.bindings.map(
    (binding: Record<string, { value: string }>) => binding.class?.value || ''
  )
}
