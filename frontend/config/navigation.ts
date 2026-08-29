import type { FeatureId } from '@/lib/runtime/contracts'

export type NavIcon =
  | 'activity'
  | 'braces'
  | 'help'
  | 'import'
  | 'network'
  | 'settings'
  | 'terminal'

export interface NavItem {
  title: string
  url?: string
  icon?: NavIcon
  target?: string
  rel?: string
  requiresAuth?: boolean
  requiredRole?: 'admin'
  /** Item is visible when the provider exposes any of these features. */
  requiredFeature?: FeatureId | readonly FeatureId[]
  items?: NavItem[]
}

export interface NavUser {
  id: string
  username: string
  role?: 'admin' | 'user'
}

export interface NavigationConfig {
  navMain: NavItem[]
  navSecondary: NavItem[]
}

const sparqlDocs: NavItem = {
  title: 'SPARQL docs',
  url: 'https://www.w3.org/TR/sparql11-query/',
  target: '_blank',
  rel: 'noopener noreferrer'
}

const virtuosoDocs: NavItem = {
  title: 'Virtuoso docs',
  url: 'https://docs.openlinksw.com/virtuoso/',
  target: '_blank',
  rel: 'noopener noreferrer'
}

const qleverDocs: NavItem = {
  title: 'QLever docs',
  url: 'https://docs.qlever.dev/',
  target: '_blank',
  rel: 'noopener noreferrer'
}

const navMain: NavItem[] = [
  {
    title: 'Import',
    url: '/import',
    icon: 'import',
    requiresAuth: true,
    requiredFeature: 'virtuoso-import'
  },
  {
    title: 'Explore',
    url: '/graphs',
    icon: 'network',
    items: [
      { title: 'Graphs overview', url: '/graphs' },
      { title: 'Visual graph', url: '/graphs-visualizations' }
    ]
  },
  {
    title: 'SPARQL',
    url: '/sparql',
    icon: 'braces'
  },
  {
    title: 'ISQL Console',
    url: '/isql',
    icon: 'terminal',
    requiresAuth: true,
    requiredFeature: 'virtuoso-isql'
  },
  {
    title: 'Monitor',
    url: '/monitor/queries',
    icon: 'activity',
    requiresAuth: true,
    items: [
      {
        title: 'Queries and update',
        url: '/monitor/queries',
        requiredFeature: ['qlever-query-monitor', 'virtuoso-query-monitor']
      },
      { title: 'System', url: '/monitor/system' }
    ]
  },
  {
    title: 'Setup',
    url: '/namespaces',
    icon: 'settings',
    requiresAuth: true,
    items: [
      {
        title: 'Namespaces',
        url: '/namespaces',
        requiredFeature: ['qlever-namespaces', 'virtuoso-namespaces']
      },
      {
        title: 'Full-Text Index',
        url: '/fulltext-index',
        requiredFeature: 'virtuoso-fulltext'
      },
      {
        title: 'Dereferencing',
        url: '/admin/dereference',
        requiresAuth: true,
        requiredRole: 'admin'
      },
      {
        title: 'Saved Queries',
        url: '/admin/saved-queries',
        requiresAuth: true,
        requiredRole: 'admin'
      },
      {
        title: 'Users',
        url: '/admin/users',
        requiresAuth: true,
        requiredRole: 'admin',
        requiredFeature: 'qlever-user-admin'
      }
    ]
  }
]

function hasFeature(
  features: ReadonlySet<FeatureId>,
  required: FeatureId | readonly FeatureId[] | undefined
): boolean {
  if (!required) return true
  const requiredList = Array.isArray(required) ? required : [required]
  return requiredList.some((feature) => features.has(feature))
}

function filterByFeatures(
  items: NavItem[],
  features: ReadonlySet<FeatureId>
): NavItem[] {
  return items.flatMap((item) => {
    if (!hasFeature(features, item.requiredFeature)) return []

    if (!item.items) return [item]

    const children = filterByFeatures(item.items, features)
    if (children.length === 0 && !item.url) return []
    return [{ ...item, items: children }]
  })
}

export function buildNavigation(
  provider: 'virtuoso' | 'qlever',
  features: ReadonlySet<FeatureId>
): NavigationConfig {
  return {
    navMain: filterByFeatures(navMain, features),
    navSecondary: [
      {
        title: 'Help',
        icon: 'help',
        items: [sparqlDocs, provider === 'virtuoso' ? virtuosoDocs : qleverDocs]
      }
    ]
  }
}

function isVisible(item: NavItem, user: NavUser | null): boolean {
  if (item.requiresAuth && !user) return false
  if (item.requiredRole && user?.role !== item.requiredRole) return false
  return true
}

export function getVisibleNavItems(
  items: NavItem[],
  user: NavUser | null
): NavItem[] {
  return items
    .filter((item) => isVisible(item, user))
    .map((item) => ({
      ...item,
      items: item.items?.filter((child) => isVisible(child, user))
    }))
}
