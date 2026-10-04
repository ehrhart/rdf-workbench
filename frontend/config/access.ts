import type { FeatureId } from '@/lib/runtime/contracts'

/**
 * Access policy for every page and API route, declared once.
 *
 * Plain module: importable from `proxy.ts` and from server components.
 */

/**
 * - `public`: reachable without a session, flag or no flag.
 * - `anonymousRead`: reachable without a session while
 *   `ALLOW_ANONYMOUS_READ` is set; requires a session otherwise.
 * - `anonymousAsk`: reachable without a session while
 *   `ALLOW_ANONYMOUS_ASK` is set; requires a session otherwise.
 * - `session`: requires an authenticated principal (any role).
 * - `admin`: requires an authenticated principal with the admin role.
 */
export type AccessLevel =
  | 'public'
  | 'anonymousRead'
  | 'anonymousAsk'
  | 'session'
  | 'admin'

export interface AccessRule {
  /**
   * Path prefix matched against the pathname. `[param]` segments match
   * exactly one path segment (Next.js dynamic routes, e.g.
   * `/[entity]/[id]`).
   */
  pattern: string
  access: AccessLevel
  /** Match `pattern` as the whole path instead of a prefix. */
  exact?: boolean
  /**
   * When set, the route returns a 404 unless the active provider exposes
   * this feature. Only one feature can be listed here; routes that are
   * allowed for several providers (or blocked for only some) leave this
   * unset and rely on their per-page/per-route `requireFeature` checks.
   */
  feature?: FeatureId
}

/**
 * Every page and API route under `app/`, enumerated from the file tree.
 * First matching pattern wins: specific patterns are listed before broad
 * ones, and unlisted paths fall through to `session` (fail closed).
 *
 * Server actions (`app/actions` and the per-page `actions.ts` files) are
 * POSTs to their enclosing page paths and are covered by those rules. `error.tsx`,
 * `loading.tsx` and layout files are not routes.
 */
export const ACCESS_RULES: AccessRule[] = [
  { pattern: '/login', access: 'public' },
  { pattern: '/logout', access: 'public' },
  { pattern: '/health', access: 'public' },

  // Read access is intentionally left open here; mutation protection is
  // handled at the endpoint layer, not in this list.
  { pattern: '/api/sparql', access: 'public' },

  // Ask spends the deployment's LLM budget: ALLOW_ANONYMOUS_ASK lets
  // anonymous visitors chat, otherwise a session is required. Anonymous
  // chats are not saved, so /api/conversations stays session-only; the
  // profile rebuild stays admin-gated in-route.
  { pattern: '/api/ask', access: 'anonymousAsk' },
  { pattern: '/ask', access: 'anonymousAsk' },
  { pattern: '/api/conversations', access: 'session' },

  { pattern: '/api/isql', access: 'session', feature: 'virtuoso-isql' },
  { pattern: '/api/import', access: 'session', feature: 'virtuoso-import' },
  { pattern: '/api/export', access: 'session', feature: 'virtuoso-export' },
  { pattern: '/isql', access: 'session', feature: 'virtuoso-isql' },
  {
    pattern: '/fulltext-index',
    access: 'session',
    feature: 'virtuoso-fulltext'
  },
  { pattern: '/import', access: 'session' },
  { pattern: '/namespaces', access: 'session' },
  { pattern: '/monitor/queries', access: 'session' },
  // The monitor layout requires a session (and the admin role on
  // qlever/oxigraph) for the whole subtree, so the sidebar item and the
  // layout stay consistent.
  { pattern: '/monitor/system', access: 'session' },

  { pattern: '/admin', access: 'admin' },

  { pattern: '/graphs-visualizations', access: 'anonymousRead' },
  { pattern: '/graphs', access: 'anonymousRead' },
  { pattern: '/sparql', access: 'anonymousRead' },
  { pattern: '/resource', access: 'anonymousRead' },
  { pattern: '/api/prefixes', access: 'anonymousRead' },
  { pattern: '/api/classes', access: 'anonymousRead' },
  { pattern: '/api/properties', access: 'anonymousRead' },
  { pattern: '/api/graphs', access: 'anonymousRead' },
  { pattern: '/api/saved-queries', access: 'anonymousRead' },
  { pattern: '/[entity]/[id]', access: 'anonymousRead' },
  { pattern: '/', access: 'anonymousRead', exact: true }
]

function ruleMatches(rule: AccessRule, pathname: string): boolean {
  if (rule.exact) return pathname === rule.pattern
  if (!rule.pattern.includes('[')) return pathname.startsWith(rule.pattern)

  // Dynamic segment: each `[param]` matches exactly one path segment.
  const patternSegments = rule.pattern.split('/')
  const pathSegments = pathname.split('/')
  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every(
    (segment, index) =>
      (segment.startsWith('[') && segment.endsWith(']')) ||
      segment === pathSegments[index]
  )
}

export function anonymousReadEnabled(): boolean {
  const value = process.env.ALLOW_ANONYMOUS_READ
  return value === '1' || value?.toLowerCase() === 'true'
}

export function anonymousAskEnabled(): boolean {
  const value = process.env.ALLOW_ANONYMOUS_ASK
  return value === '1' || value?.toLowerCase() === 'true'
}

/**
 * Raw access level of the first matching rule, without applying the
 * anonymous-read flag or resolving features. Used by sidebar visibility,
 * where an item's declared policy is what matters (public or
 * anonymous-read items are browsable), not the runtime flag.
 */
export function resolveBaseAccess(pathname: string): AccessLevel {
  const rule = ACCESS_RULES.find((candidate) =>
    ruleMatches(candidate, pathname)
  )
  return rule?.access ?? 'session'
}

export interface AccessOptions {
  features: ReadonlySet<FeatureId>
  anonymousReadEnabled: boolean
  anonymousAskEnabled: boolean
}

export interface AccessDecision {
  access: AccessLevel
  /** True when the matched rule's feature is missing for this provider. */
  featureMissing: boolean
}

/**
 * Resolves the access decision for a pathname against the manifest.
 * Returns the first matching rule's level; `anonymousRead` becomes
 * `session` when the anonymous-read flag is off, and `anonymousAsk`
 * becomes `session` the same way when the anonymous-ask flag is off;
 * unlisted paths return `session` (fail closed). Callers enforce the
 * decision: `public` passes, `session`/`admin` require a principal
 * (plus the admin role for `admin`), and `featureMissing` means the
 * route should 404.
 */
export function resolveAccess(
  pathname: string,
  options: AccessOptions
): AccessDecision {
  const rule = ACCESS_RULES.find((candidate) =>
    ruleMatches(candidate, pathname)
  )

  if (!rule) {
    return { access: 'session', featureMissing: false }
  }

  const access: AccessLevel =
    (rule.access === 'anonymousRead' && !options.anonymousReadEnabled) ||
    (rule.access === 'anonymousAsk' && !options.anonymousAskEnabled)
      ? 'session'
      : rule.access
  const featureMissing = rule.feature
    ? !options.features.has(rule.feature)
    : false

  return { access, featureMissing }
}
