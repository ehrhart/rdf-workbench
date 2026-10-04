import 'server-only'

import { NextResponse } from 'next/server'
import { anonymousAskEnabled } from '@/config/access'
import { getWorkbenchRuntime } from '@/lib/runtime'
import type { Principal } from '@/lib/runtime/contracts'

/** 401 body shared by every API-layer auth denial. */
export function unauthenticatedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  )
}

/** 503 for an auth adapter or session store failure. */
export function serviceUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Authentication service is temporarily unavailable' },
    { status: 503 }
  )
}

/**
 * Either a resolved principal or a ready-to-return 401 response, so API
 * handlers write:
 *
 * const auth = await requirePrincipal()
 * if (auth.response) return auth.response
 */
export type PrincipalGuard =
  | { principal: Principal; response?: undefined }
  | { principal?: undefined; response: NextResponse }

/**
 * Either a viewer id (`null` when anonymous) or a ready-to-return
 * response, for handlers that treat anonymous callers as valid viewers.
 */
export type OptionalViewerGuard =
  | { viewerId: string | null; response?: undefined }
  | { viewerId?: undefined; response: NextResponse }

/**
 * API-level access guard. Resolves the principal through the runtime auth
 * adapter (adapter-validated for virtuoso, SQLite-backed for the local
 * providers). A missing principal answers 401; a throwing adapter answers
 * 503 so an outage is not mistaken for an anonymous caller.
 */
export async function requirePrincipal(): Promise<PrincipalGuard> {
  const resolved = await resolvePrincipal()
  if (resolved.response) return { response: resolved.response }
  if (!resolved.principal) return { response: unauthenticatedResponse() }
  return { principal: resolved.principal }
}

export type MaybeAnonymousGuard =
  | { principal: Principal | null; response?: undefined }
  | { principal?: undefined; response: NextResponse }

/**
 * Like requirePrincipal, but resolves to a null principal for
 * unauthenticated callers when the anonymous-ask flag is on. Auth
 * adapter failures still answer 503: an outage is not the same as an
 * anonymous caller.
 */
export async function requireAskPrincipal(): Promise<MaybeAnonymousGuard> {
  const resolved = await resolvePrincipal()
  if (resolved.response) return { response: resolved.response }
  if (!resolved.principal && !anonymousAskEnabled()) {
    return { response: unauthenticatedResponse() }
  }
  return { principal: resolved.principal ?? null }
}

/**
 * Resolves the viewer without requiring one: `null` when anonymous, 503
 * when the auth adapter itself fails.
 */
export async function resolveOptionalViewer(): Promise<OptionalViewerGuard> {
  const resolved = await resolvePrincipal()
  if (resolved.response) return { response: resolved.response }
  return { viewerId: resolved.principal?.id ?? null }
}

async function resolvePrincipal(): Promise<
  | { principal: Principal | null; response?: undefined }
  | { principal?: undefined; response: NextResponse }
> {
  try {
    const principal = await (await getWorkbenchRuntime()).auth.getPrincipal()
    return { principal }
  } catch (error) {
    console.error('Principal lookup failed:', error)
    return { response: serviceUnavailableResponse() }
  }
}
