import 'server-only'

import type {
  EndpointOverview,
  GraphReader,
  SparqlTransport
} from '@/lib/runtime/contracts'

export async function getOxigraphEndpointOverview(
  graphs: GraphReader,
  sparql: SparqlTransport
): Promise<EndpointOverview> {
  const [graphList, total] = await Promise.all([
    graphs.listNamedGraphs(),
    sparql.execute(
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
    totalTriples,
    stats: {
      'num-triples-normal': totalTriples,
      'named-graphs': graphList.length
    }
  }
}
