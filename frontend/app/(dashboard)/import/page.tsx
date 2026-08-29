import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VirtuosoImportManager from '@/components/import/virtuoso-import-manager'
import { getWorkbenchRuntime } from '@/lib/runtime'

export const metadata: Metadata = {
  title: 'Import',
  description: 'Load RDF data into the configured triplestore'
}

export default async function ImportPage() {
  const runtime = await getWorkbenchRuntime()
  if (runtime.provider !== 'virtuoso') notFound()
  return <VirtuosoImportManager />
}
