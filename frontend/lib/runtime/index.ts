import 'server-only'

import { notFound } from 'next/navigation'
import { getRuntimeConfig } from './config'
import type {
  FeatureId,
  TriplestoreProvider,
  WorkbenchRuntime
} from './contracts'

let runtime: WorkbenchRuntime | undefined

const runtimeFactories: Record<
  TriplestoreProvider,
  () => Promise<WorkbenchRuntime>
> = {
  qlever: async () =>
    (await import('@/providers/qlever/runtime')).qleverRuntime,
  virtuoso: async () =>
    (await import('@/providers/virtuoso/runtime')).virtuosoRuntime
}

export async function getWorkbenchRuntime(): Promise<WorkbenchRuntime> {
  if (runtime) return runtime

  const config = getRuntimeConfig()
  runtime = await runtimeFactories[config.TRIPLESTORE_PROVIDER]()
  return runtime
}

export async function hasFeature(feature: FeatureId): Promise<boolean> {
  return (await getWorkbenchRuntime()).features.has(feature)
}

export async function hasAnyFeature(
  features: readonly FeatureId[]
): Promise<boolean> {
  const runtime = await getWorkbenchRuntime()
  return features.some((feature) => runtime.features.has(feature))
}

export async function requireFeature(feature: FeatureId): Promise<void> {
  if (!(await hasFeature(feature))) notFound()
}

export async function requireAnyFeature(
  features: readonly FeatureId[]
): Promise<void> {
  if (!(await hasAnyFeature(features))) notFound()
}
