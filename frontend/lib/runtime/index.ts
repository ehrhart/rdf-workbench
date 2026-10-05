import 'server-only'

import { notFound, redirect } from 'next/navigation'
import type { AccessLevel } from '@/config/access'
import {
  anonymousAskEnabled,
  anonymousReadEnabled,
  PASSWORD_CHANGE_PATH
} from '@/config/access'
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
    (await import('@/providers/virtuoso/runtime')).virtuosoRuntime,
  oxigraph: async () =>
    (await import('@/providers/oxigraph/runtime')).oxigraphRuntime
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

/**
 * Page-level access guard. Follows the same rules as the existing admin
 * pages: anonymous users are redirected to `/logout` (with an optional
 * `redirect` target, as `/admin/users` hardcodes today) and non-admins
 * opening an `admin` page get a 404. `public` and flag-backed
 * `anonymousRead`/`anonymousAsk` pass through.
 */
export async function requirePageAccess(
  access: AccessLevel,
  redirectPath?: string
): Promise<void> {
  const requiresPrincipal =
    access === 'session' ||
    access === 'admin' ||
    (access === 'anonymousRead' && !anonymousReadEnabled()) ||
    (access === 'anonymousAsk' && !anonymousAskEnabled())
  if (!requiresPrincipal) return

  const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
  if (!principal) {
    redirect(redirectPath ? `/logout?redirect=${redirectPath}` : '/logout')
  }
  // No page guard is satisfiable while a password change is owed. The
  // change-password page does not call this guard — it would catch
  // exactly the one principal that must proceed — and guards its
  // principal inline instead.
  if (principal.mustChangePassword) redirect(PASSWORD_CHANGE_PATH)
  if (access === 'admin' && principal.role !== 'admin') notFound()
}
