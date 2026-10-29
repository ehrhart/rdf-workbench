import { describe, expect, it, vi } from 'vitest'
import { buildNavigation, getVisibleNavItems } from './navigation'

vi.mock('@/lib/access/access-flags', () => ({
  getAccessFlags: async () => ({
    allowAnonymousRead: true,
    allowAnonymousAsk: false,
    allowAnonymousSparql: false
  })
}))

const ADMIN = { id: '1', username: 'admin', role: 'admin' as const }

const FEATURES = new Set([
  'virtuoso-namespaces',
  'virtuoso-fulltext',
  'virtuoso-isql',
  'query-monitor',
  'ai-ask',
  'user-admin'
] as const)

describe('getVisibleNavItems', () => {
  it('hides a group whose children are all filtered out', async () => {
    const nav = buildNavigation('virtuoso', FEATURES)
    const visible = await getVisibleNavItems(nav.navMain, null)
    expect(visible.some((item) => item.title === 'Setup')).toBe(false)
  })

  it('keeps the group with its children for an admin', async () => {
    const nav = buildNavigation('virtuoso', FEATURES)
    const visible = await getVisibleNavItems(nav.navMain, ADMIN)
    const setup = visible.find((item) => item.title === 'Setup')
    expect(setup?.items?.length).toBeGreaterThan(0)
  })

  it('keeps a childless plain link governed by its own access', async () => {
    const visible = await getVisibleNavItems(
      [{ title: 'SPARQL', url: '/sparql', icon: 'braces' }],
      null
    )
    expect(visible.map((item) => item.title)).toEqual(['SPARQL'])
  })

  it('never links a group at a page outside its own children', async () => {
    const nav = buildNavigation('virtuoso', FEATURES)
    const setup = nav.navMain.find((item) => item.title === 'Setup')
    expect(setup?.items?.some((child) => child.url === setup.url)).toBe(true)
  })
})
