import 'server-only'

import { notFound } from 'next/navigation'
import { getRuntimeConfig } from './config'
import type { FeatureId, WorkbenchRuntime } from './contracts'

let runtime: WorkbenchRuntime | undefined

export async function getWorkbenchRuntime(): Promise<WorkbenchRuntime> {
  if (runtime) return runtime

  const config = getRuntimeConfig()
  runtime =
    config.TRIPLESTORE_PROVIDER === 'qlever'
      ? (await import('@/providers/qlever/runtime')).qleverRuntime
      : (await import('@/providers/virtuoso/runtime')).virtuosoRuntime
  return runtime
}

export async function hasFeature(feature: FeatureId): Promise<boolean> {
  return (await getWorkbenchRuntime()).features.has(feature)
}

export async function requireFeature(feature: FeatureId): Promise<void> {
  if (!(await hasFeature(feature))) notFound()
}
