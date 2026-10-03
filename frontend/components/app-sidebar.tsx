'use client'

import Link from 'next/link'
import type * as React from 'react'
import { NavItems } from '@/components/nav-items'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import type { NavItem, NavUser as NavUserType } from '@/config/navigation'
import type { UpdateInfo } from '@/lib/update-check'
import { cn } from '@/lib/utils'
import RDFIcon from './rdf-icon'

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: NavUserType | null
  updateInfo?: UpdateInfo | null
  navMainItems?: NavItem[]
  navSecondaryItems?: NavItem[]
  isAuthenticated?: boolean
  appName?: string
  appIcon?: React.ComponentType<{ className?: string }>
}

export function AppSidebar({
  user,
  updateInfo,
  navMainItems,
  navSecondaryItems,
  appName = 'RDF Workbench',
  appIcon: AppIcon = RDFIcon,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className={cn('select-none', props.className)}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <AppIcon className="size-5!" />
                <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                  {appName}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavItems items={navMainItems ?? []} />
        <NavItems items={navSecondaryItems ?? []} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} />}
        <div className="flex items-center gap-2 overflow-hidden px-2 pb-2 text-xs whitespace-nowrap text-muted-foreground group-data-[collapsible=icon]:hidden">
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}</span>
          {updateInfo?.updateAvailable && updateInfo.releaseUrl ? (
            <Link
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noreferrer"
              title={`v${updateInfo.latestVersion} available (running v${updateInfo.currentVersion})`}
              className="flex items-center gap-1.5 rounded-md font-medium text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              Update available
            </Link>
          ) : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
