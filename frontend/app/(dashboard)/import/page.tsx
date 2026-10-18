import type { Metadata } from 'next'
import GenericImportManager from '@/components/import/generic-import-manager'
import OxigraphImportManager from '@/components/import/oxigraph-import-manager'
import VirtuosoImportManager from '@/components/import/virtuoso-import-manager'
import {
  getWorkbenchRuntime,
  requireAnyFeature,
  requirePageAccess
} from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Import',
  description: 'Load RDF data into the configured triplestore'
}

export default async function ImportPage() {
  await requirePageAccess('admin')
  await requireAnyFeature([
    'virtuoso-import',
    'oxigraph-import',
    'generic-import'
  ])
  const runtime = await getWorkbenchRuntime()
  return runtime.provider === 'virtuoso' ? (
    <VirtuosoImportManager />
  ) : runtime.provider === 'generic' ? (
    <GenericImportManager />
  ) : (
    <OxigraphImportManager />
  )
}
