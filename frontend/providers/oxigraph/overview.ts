import 'server-only'

import type { EndpointOverview } from '@/lib/runtime/contracts'
import { listOxigraphNamedGraphs } from './graphs'
import { oxigraphSparqlTransport } from './sparql'

export async function getOxigraphEndpointOverview(): Promise<EndpointOverview> {
  const [graphs, total] = await Promise.all([
    listOxigraphNamedGraphs(),
    oxigraphSparqlTransport.execute(
      'SELECT (COUNT(*) AS ?total) WHERE { ?subject ?predicate ?object }'
    )
  ])
  const totalTriples =
    total.kind === 'bindings'
      ? Number.parseInt(total.bindings[0]?.total?.value ?? '0', 10) || 0
      : 0

  return {
    healthy: true,
    name: 'Oxigraph',
    provider: 'oxigraph',
    stats: {
      'num-triples-normal': totalTriples,
      'named-graphs': graphs.length
    }
  }
}
