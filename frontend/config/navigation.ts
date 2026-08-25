export type NavIcon =
  | 'braces'
  | 'help'
  | 'import'
  | 'network'
  | 'settings'
  | 'shield'
  | 'activity'
  | 'terminal'

export interface NavItem {
  title: string
  url: string
  icon?: NavIcon
  target?: string
  rel?: string
  requiresAuth?: boolean
  requiredRole?: 'admin'
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

const explore: NavItem = {
  title: 'Explore',
  url: '/graphs',
  icon: 'network',
  items: [
    { title: 'Graphs overview', url: '/graphs' },
    { title: 'Visual graph', url: '/graphs-visualizations' }
  ]
}

const sparql: NavItem = {
  title: 'SPARQL',
  url: '/sparql',
  icon: 'braces'
}

export const virtuosoNavigation: NavigationConfig = {
  navMain: [
    {
      title: 'Import',
      url: '/import',
      icon: 'import',
      requiresAuth: true
    },
    explore,
    sparql,
    {
      title: 'ISQL Console',
      url: '/isql',
      icon: 'terminal',
      requiresAuth: true
    },
    {
      title: 'Monitor',
      url: '/monitor/queries',
      icon: 'activity',
      requiresAuth: true,
      items: [
        { title: 'Queries and update', url: '/monitor/queries' },
        { title: 'System', url: '/monitor/system' }
      ]
    },
    {
      title: 'Setup',
      url: '/namespaces',
      icon: 'settings',
      requiresAuth: true,
      items: [
        { title: 'Namespaces', url: '/namespaces' },
        { title: 'Full-Text Index', url: '/fulltext-index' }
      ]
    },
    {
      title: 'Saved Queries',
      url: '/admin/saved-queries',
      icon: 'settings',
      requiresAuth: true,
      requiredRole: 'admin'
    }
  ],
  navSecondary: [
    {
      title: 'SPARQL docs',
      url: 'https://www.w3.org/TR/sparql11-query/',
      icon: 'help',
      target: '_blank',
      rel: 'noopener noreferrer'
    },
    {
      title: 'Virtuoso docs',
      url: 'https://docs.openlinksw.com/virtuoso/',
      icon: 'help',
      target: '_blank',
      rel: 'noopener noreferrer'
    }
  ]
}

export const qleverNavigation: NavigationConfig = {
  navMain: [
    explore,
    sparql,
    {
      title: 'Endpoint',
      url: '/monitor/system',
      icon: 'activity'
    },
    {
      title: 'Namespaces',
      url: '/namespaces',
      icon: 'settings'
    },
    {
      title: 'Users',
      url: '/admin/users',
      icon: 'shield',
      requiresAuth: true,
      requiredRole: 'admin'
    },
    {
      title: 'Saved Queries',
      url: '/admin/saved-queries',
      icon: 'settings',
      requiresAuth: true,
      requiredRole: 'admin'
    }
  ],
  navSecondary: [
    {
      title: 'SPARQL docs',
      url: 'https://www.w3.org/TR/sparql11-query/',
      icon: 'help',
      target: '_blank',
      rel: 'noopener noreferrer'
    },
    {
      title: 'QLever docs',
      url: 'https://docs.qlever.dev/',
      icon: 'help',
      target: '_blank',
      rel: 'noopener noreferrer'
    }
  ]
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
