import type { Metadata } from 'next'
import OxigraphImportManager from '@/components/import/oxigraph-import-manager'
import VirtuosoImportManager from '@/components/import/virtuoso-import-manager'
import { getWorkbenchRuntime, requirePageAccess } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Import',
  description: 'Load RDF data into the configured triplestore'
}

export default async function ImportPage() {
  await requirePageAccess('session')
  const runtime = await getWorkbenchRuntime()
  return runtime.provider === 'virtuoso' ? (
    <VirtuosoImportManager />
  ) : (
    <OxigraphImportManager />
  )
}
