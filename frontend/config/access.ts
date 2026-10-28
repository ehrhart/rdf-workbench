import type { FeatureId } from '@/lib/runtime/contracts'

/**
 * Access policy for every page and API route, declared once.
 *
 * Plain module: importable from `proxy.ts` and from server components.
 */

/**
 * - `public`: reachable without a session, flag or no flag.
 * - `anonymousRead`: reachable without a session while the resolved
 *   allow-anonymous-read flag is on (env or a stored UI override);
 *   requires a session otherwise.
 * - `anonymousAsk`: same for the allow-anonymous-ask flag; requires a
 *   session otherwise.
 * - `anonymousSparql`: same for the allow-anonymous-sparql flag; requires
 *   a session otherwise.
 * - `session`: requires an authenticated principal (any role).
 * - `admin`: requires an authenticated principal with the admin role.
 */
export type AccessLevel =
  | 'public'
  | 'anonymousRead'
  | 'anonymousAsk'
  | 'anonymousSparql'
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

export const PASSWORD_CHANGE_PATH = '/change-password'

/**
 * Paths a principal that owes a password change may still request: the
 * change surface itself (its page render and its server-action POST
 * share the path) and logout. Everything else — public and
 * anonymous-read paths included — is denied for flagged sessions, so a
 * flagged user gets strictly less than an anonymous visitor. Exact
 * matching: the proxy gate is the only consumer, and no other file
 * re-declares these paths.
 */
const PASSWORD_CHANGE_ALLOWED: readonly string[] = [
  PASSWORD_CHANGE_PATH,
  '/logout'
]

export function isPasswordChangeAllowed(pathname: string): boolean {
  return PASSWORD_CHANGE_ALLOWED.includes(pathname)
}

/**
 * Accepts only same-origin relative paths ("/x", never "//x" or an
 * absolute URL); anything else collapses to the overview page. Consumed
 * by the login action and the change-password flow.
 */
export function safeInternalRedirect(value: string | null | undefined): string {
  if (
    value?.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
  ) {
    return value
  }
  return '/overview'
}

/**
 * Access rules for page and API routes under `app/`, enumerated from the
 * file tree. Unlisted paths default to `session` (fail closed).
 *
 * Server actions (`app/actions` and per-page `actions.ts` files) are handled
 * through their enclosing page paths and are covered by those rules.
 * `error.tsx`, `loading.tsx`, and layout files do not define routes.
 */
export const ACCESS_RULES: AccessRule[] = [
  { pattern: '/login', access: 'public' },
  { pattern: '/logout', access: 'public' },
  { pattern: '/health', access: 'public' },
  { pattern: '/api/appearance/logo', access: 'public' },
  { pattern: '/change-password', access: 'session' },

  { pattern: '/api/console/download', access: 'anonymousSparql' },

  { pattern: '/api/ask', access: 'anonymousAsk' },
  { pattern: '/ask', access: 'anonymousAsk' },
  { pattern: '/api/conversations', access: 'session' },

  { pattern: '/api/isql', access: 'admin', feature: 'virtuoso-isql' },
  { pattern: '/api/import', access: 'admin', feature: 'virtuoso-import' },
  { pattern: '/api/export', access: 'session', feature: 'virtuoso-export' },
  { pattern: '/isql', access: 'admin', feature: 'virtuoso-isql' },
  {
    pattern: '/fulltext-index',
    access: 'session',
    feature: 'virtuoso-fulltext'
  },
  { pattern: '/import', access: 'admin' },
  { pattern: '/namespaces', access: 'anonymousRead' },
  { pattern: '/monitor/queries', access: 'session' },
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
  { pattern: '/overview', access: 'anonymousRead', exact: true },

  // Dereferenceable resource URLs (`DEREFERENCE_PATHS`).
  { pattern: '/[entity]', access: 'anonymousRead' },
  { pattern: '/[entity]/[...id]', access: 'anonymousRead' }
]

function ruleMatches(rule: AccessRule, pathname: string): boolean {
  if (rule.exact) return pathname === rule.pattern
  if (!rule.pattern.includes('[')) return pathname.startsWith(rule.pattern)

  // Dynamic segment: each `[param]` matches exactly one path segment, and a
  // trailing `[...param]` catch-all matches one or more remaining segments.
  const patternSegments = rule.pattern.split('/')
  const pathSegments = pathname.split('/')
  const lastPattern = patternSegments[patternSegments.length - 1]
  if (lastPattern.startsWith('[...') && lastPattern.endsWith(']')) {
    if (pathSegments.length < patternSegments.length) return false
    return patternSegments
      .slice(0, -1)
      .every(
        (segment, index) =>
          (segment.startsWith('[') && segment.endsWith(']')) ||
          segment === pathSegments[index]
      )
  }
  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every(
    (segment, index) =>
      (segment.startsWith('[') && segment.endsWith(']')) ||
      segment === pathSegments[index]
  )
}

/**
 * Finds the first matching rule for a pathname. Static rules take precedence
 * over dynamic rules, regardless of array order. Within each category,
 * array order determines which matching rule wins.
 */
function findMatchingRule(pathname: string): AccessRule | undefined {
  const isDynamic = (rule: AccessRule) => rule.pattern.includes('[')
  return (
    ACCESS_RULES.find(
      (rule) => !isDynamic(rule) && ruleMatches(rule, pathname)
    ) ??
    ACCESS_RULES.find((rule) => isDynamic(rule) && ruleMatches(rule, pathname))
  )
}

/**
 * Raw access level of the first matching rule, without applying the
 * anonymous-read flag or resolving features. Used by sidebar visibility,
 * where an item's declared policy is what matters (public or
 * anonymous-read items are browsable), not the runtime flag.
 */
export function resolveBaseAccess(pathname: string): AccessLevel {
  const rule = findMatchingRule(pathname)
  return rule?.access ?? 'session'
}

export interface AccessOptions {
  features: ReadonlySet<FeatureId>
  anonymousReadEnabled: boolean
  anonymousAskEnabled: boolean
  anonymousSparqlEnabled: boolean
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
 * becomes `session` the same way when the anonymous-ask flag is off, as
 * does `anonymousSparql` when the anonymous-sparql flag is off;
 * unlisted paths return `session` (fail closed). Callers enforce the
 * decision: `public` passes, `session`/`admin` require a principal
 * (plus the admin role for `admin`), and `featureMissing` means the
 * route should 404.
 */
export function resolveAccess(
  pathname: string,
  options: AccessOptions
): AccessDecision {
  const rule = findMatchingRule(pathname)

  if (!rule) {
    return { access: 'session', featureMissing: false }
  }

  const access: AccessLevel =
    (rule.access === 'anonymousRead' && !options.anonymousReadEnabled) ||
    (rule.access === 'anonymousAsk' && !options.anonymousAskEnabled) ||
    (rule.access === 'anonymousSparql' && !options.anonymousSparqlEnabled)
      ? 'session'
      : rule.access
  const featureMissing = rule.feature
    ? !options.features.has(rule.feature)
    : false

  return { access, featureMissing }
}
