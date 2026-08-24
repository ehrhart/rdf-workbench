import { notFound } from 'next/navigation'
import ResourceManager from '@/components/resource-manager'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'

const RESOURCE_ENTITIES = new Set([
  'claim-review',
  'review',
  'tweet',
  'news-article',
  'organization',
  'rating',
  'claim',
  'entity',
  'emotion',
  'conspiracy'
])

export default async function ResourceDereferencePage({
  params
}: {
  params: Promise<{ entity: string; id: string }>
}) {
  const { entity, id } = await params
  if (!RESOURCE_ENTITIES.has(entity) || !id) notFound()

  const { RESOURCE_BASE_URI } = getRuntimeConfig()
  const resourceUri = `${RESOURCE_BASE_URI.replace(/\/$/, '')}/${entity}/${id}`

  const runtime = await getWorkbenchRuntime()
  const fileTypes = runtime.sparql
    .getDownloadFormats('construct')
    .map((format) => ({
      name: format.label,
      contentType: format.mime,
      extension: format.extension
    }))

  return <ResourceManager fileTypes={fileTypes} uri={resourceUri} />
}
