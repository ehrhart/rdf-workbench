import { NextResponse } from 'next/server'
import { getRuntimeConfig } from '@/lib/runtime/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getRuntimeConfig()

  try {
    if (config.TRIPLESTORE_PROVIDER === 'qlever') {
      const [{ getWorkbenchDatabase }, ping] = await Promise.all([
        import('@/lib/workbench-database'),
        fetch(
          new URL('ping', `${config.SPARQL_ENDPOINT.replace(/\/$/, '')}/`),
          {
            cache: 'no-store'
          }
        )
      ])
      const db = await getWorkbenchDatabase()
      db.prepare('SELECT 1').get()
      if (!ping.ok) throw new Error(`QLever ping returned ${ping.status}`)

      return NextResponse.json({
        status: 'healthy',
        provider: 'qlever',
        services: { sqlite: 'healthy', endpoint: 'healthy' }
      })
    }

    const [{ getWorkbenchDatabase }, adapter, endpoint] = await Promise.all([
      import('@/lib/workbench-database'),
      fetch(new URL('/health', config.VIRTUOSO_ADAPTER_URL), {
        cache: 'no-store'
      }),
      fetch(config.SPARQL_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ query: 'ASK { ?s ?p ?o }' }),
        cache: 'no-store'
      })
    ])
    const db = await getWorkbenchDatabase()
    db.prepare('SELECT 1').get()
    if (!adapter.ok || !endpoint.ok) {
      throw new Error(
        `Virtuoso health failure (adapter ${adapter.status}, endpoint ${endpoint.status})`
      )
    }

    return NextResponse.json({
      status: 'healthy',
      provider: 'virtuoso',
      services: { sqlite: 'healthy', adapter: 'healthy', endpoint: 'healthy' }
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        provider: config.TRIPLESTORE_PROVIDER,
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 503 }
    )
  }
}
