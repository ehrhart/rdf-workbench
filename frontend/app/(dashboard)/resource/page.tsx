import { PrefixesProvider } from '@/components/prefixes/prefix-context'
import ResourceManager from '@/components/resource-manager'
import { getWorkbenchRuntime, requirePageAccess } from '@/lib/runtime'

export default async function ResourcePage() {
  await requirePageAccess('anonymousRead')
  const runtime = await getWorkbenchRuntime()
  const prefixes = await runtime.prefixes.list().catch(() => ({}))
  const fileTypes = runtime.sparql
    .getDownloadFormats('construct')
    .map((format) => ({
      name: format.label,
      contentType: format.mime,
      extension: format.extension
    }))

  return (
    <PrefixesProvider prefixes={prefixes}>
      <ResourceManager fileTypes={fileTypes} />
    </PrefixesProvider>
  )
}
