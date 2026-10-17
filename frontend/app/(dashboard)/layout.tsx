import type React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getVisibleNavItems } from '@/config/navigation'
import {
  getAppearanceAssetMeta,
  getInstanceName
} from '@/lib/appearance/appearance-settings'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getUpdateInfo } from '@/lib/update-check'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const runtime = await getWorkbenchRuntime()
  const session = await runtime.auth.getPrincipal()
  const user = session
    ? {
        id: session.id,
        username: session.username,
        role: session.role
      }
    : null
  const updateInfo = session ? await getUpdateInfo() : null
  const [appName, logoMeta] = await Promise.all([
    getInstanceName(),
    getAppearanceAssetMeta('logo')
  ])

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 16)'
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="floating"
        user={user}
        updateInfo={updateInfo}
        navMainItems={getVisibleNavItems(runtime.navigation.navMain, user)}
        navSecondaryItems={getVisibleNavItems(
          runtime.navigation.navSecondary,
          user
        )}
        appName={appName}
        brandLogoVersion={logoMeta?.updatedAt ?? null}
      />
      <SidebarInset>
        <SiteHeader user={user} />
        <main className="@container/main px-4 lg:px-6 pb-4 flex flex-1 flex-col min-h-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
