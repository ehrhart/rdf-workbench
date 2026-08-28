import type React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getWorkbenchRuntime } from '@/lib/runtime'
import { getWorkbenchName } from '@/lib/runtime/config'

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
        navMainItems={runtime.navigation.navMain}
        navSecondaryItems={runtime.navigation.navSecondary}
        appName={getWorkbenchName()}
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
