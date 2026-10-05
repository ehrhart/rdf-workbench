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

/**
 * 403 for a valid session that still owes a password change. The copy
 * must not contain "unauthorized" or "Session expired": the dashboard
 * error boundary treats those as an auth failure and redirects to
 * /logout.
 */
export function passwordChangeRequiredResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Password change required' },
    { status: 403 }
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
  if (resolved.principal.mustChangePassword) {
    return { response: passwordChangeRequiredResponse() }
  }
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
  // A flagged principal holds no session privileges on this surface:
  // degrade to anonymous, matching the surface's own anonymous semantics.
  const principal = resolved.principal?.mustChangePassword
    ? null
    : (resolved.principal ?? null)
  if (!principal && !anonymousAskEnabled()) {
    return { response: unauthenticatedResponse() }
  }
  return { principal }
}

/**
 * Resolves the viewer without requiring one: `null` when anonymous, 503
 * when the auth adapter itself fails.
 */
export async function resolveOptionalViewer(): Promise<OptionalViewerGuard> {
  const resolved = await resolvePrincipal()
  if (resolved.response) return { response: resolved.response }
  const viewerId =
    resolved.principal && !resolved.principal.mustChangePassword
      ? resolved.principal.id
      : null
  return { viewerId }
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
