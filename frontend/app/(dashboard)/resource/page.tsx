import ResourceManager from '@/components/resource-manager'
import { getWorkbenchRuntime } from '@/lib/runtime'

export default async function ResourcePage() {
  const runtime = await getWorkbenchRuntime()
  const fileTypes = runtime.sparql
    .getDownloadFormats('construct')
    .map((format) => ({
      name: format.label,
      contentType: format.mime,
      extension: format.extension
    }))

  return <ResourceManager fileTypes={fileTypes} />
}
