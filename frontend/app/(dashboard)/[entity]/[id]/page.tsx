import { notFound } from 'next/navigation'
import ResourceManager from '@/components/resource-manager'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getRuntimeConfig } from '@/lib/runtime/config'

export default async function ResourceDereferencePage({
  params
}: {
  params: Promise<{ entity: string; id: string }>
}) {
  const { entity, id } = await params

  const runtime = await getWorkbenchRuntime()
  const configuredPaths = await runtime.dereference.list()
  if (!configuredPaths.some((entry) => entry.path === entity)) notFound()

  const { RESOURCE_BASE_URI } = getRuntimeConfig()
  const resourceUri = `${RESOURCE_BASE_URI.replace(/\/$/, '')}/${entity}/${id}`

  const fileTypes = runtime.sparql
    .getDownloadFormats('construct')
    .map((format) => ({
      name: format.label,
      contentType: format.mime,
      extension: format.extension
    }))

  return <ResourceManager fileTypes={fileTypes} uri={resourceUri} />
}
