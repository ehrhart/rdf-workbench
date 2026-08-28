import 'server-only'

import { getRuntimeConfig } from '@/lib/runtime/config'
import type { EndpointOverview } from '@/lib/runtime/contracts'

function endpointUrl(pathname = '', search = ''): URL {
  const config = getRuntimeConfig()
  if (config.TRIPLESTORE_PROVIDER !== 'qlever') {
    throw new Error('QLever overview requested in a Virtuoso deployment')
  }
  const url = new URL(config.SPARQL_ENDPOINT)
  if (pathname) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${pathname.replace(/^\//, '')}`
  }
  url.search = search
  return url
}

async function fetchJson(
  url: URL
): Promise<Record<string, string | number | boolean | null>> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`QLever returned ${response.status}`)
  return (await response.json()) as Record<
    string,
    string | number | boolean | null
  >
}

export async function getQleverEndpointOverview(): Promise<EndpointOverview> {
  const [ping, stats, settings] = await Promise.all([
    fetch(endpointUrl('ping'), { cache: 'no-store' }),
    fetchJson(endpointUrl('', '?cmd=stats')),
    fetchJson(endpointUrl('', '?cmd=get-settings'))
  ])

  return {
    healthy: ping.ok,
    name: String(stats['name-index'] || 'QLever endpoint'),
    provider: 'qlever',
    stats,
    settings
  }
}
