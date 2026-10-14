import 'server-only'

import type {
  EndpointOverview,
  GraphReader,
  SparqlTransport
} from '@/lib/runtime/contracts'
import { GENERIC_LABEL } from './config'

export async function getGenericEndpointOverview(
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
    name: GENERIC_LABEL,
    provider: 'generic',
    totalTriples,
    stats: {
      'total-triples': totalTriples,
      'named-graphs': graphList.length
    }
  }
}
