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
import {
  getVisibleNavItems,
  type NavItem,
  type NavUser as NavUserType
} from '@/config/navigation'
import { cn } from '@/lib/utils'
import RDFIcon from './rdf-icon'

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: NavUserType | null
  navMainItems?: NavItem[]
  navSecondaryItems?: NavItem[]
  isAuthenticated?: boolean
  appName?: string
  appIcon?: React.ComponentType<{ className?: string }>
}

export function AppSidebar({
  user,
  navMainItems,
  navSecondaryItems,
  appName = 'RDF Workbench',
  appIcon: AppIcon = RDFIcon,
  ...props
}: AppSidebarProps) {
  // Filter navigation items based on authentication
  const visibleMainItems = getVisibleNavItems(navMainItems ?? [], user)
  const visibleSecondaryItems = getVisibleNavItems(
    navSecondaryItems ?? [],
    user
  )

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
                <span className="text-base font-semibold">{appName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavItems items={visibleMainItems} />
        <NavItems items={visibleSecondaryItems} className="mt-auto" />
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
