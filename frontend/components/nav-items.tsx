'use client'

import {
  BracesIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  ImportIcon,
  type LucideIcon,
  NetworkIcon,
  SettingsIcon,
  ShieldIcon,
  SquareActivityIcon,
  TerminalIcon
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from '@/components/ui/sidebar'
import type { NavIcon, NavItem } from '@/config/navigation'

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  braces: BracesIcon,
  help: HelpCircleIcon,
  import: ImportIcon,
  network: NetworkIcon,
  settings: SettingsIcon,
  shield: ShieldIcon,
  activity: SquareActivityIcon,
  terminal: TerminalIcon
}

export function NavItems({
  items,
  ...props
}: {
  items: NavItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu className="font-medium gap-2">
          {items.map((item) => {
            const ItemIcon = item.icon ? NAV_ICONS[item.icon] : null
            const hasSubitems = item.items && item.items.length > 0
            const isItemActive = pathname === item.url
            const hasActiveSubitem =
              hasSubitems &&
              item.items?.some(
                (subItem) =>
                  pathname === subItem.url ||
                  pathname.startsWith(`${subItem.url}/`)
              )
            const shouldBeOpen = isItemActive || hasActiveSubitem

            if (!hasSubitems) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className="data-[active=true]:bg-primary/10"
                    tooltip={item.title}
                    isActive={isItemActive}
                    asChild
                  >
                    <Link href={item.url} target={item.target} rel={item.rel}>
                      {ItemIcon && <ItemIcon />}
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            if (state === 'collapsed') {
              return (
                <DropdownMenu key={item.title}>
                  <SidebarMenuItem>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        className="data-[active=true]:bg-primary/10"
                        tooltip={item.title}
                        isActive={isItemActive || hasActiveSubitem}
                      >
                        {ItemIcon && <ItemIcon />}
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                  </SidebarMenuItem>
                  <DropdownMenuContent
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    side="right"
                    align="start"
                    className="min-w-48"
                  >
                    {item.items?.map((subItem) => {
                      const isSubItemActive =
                        pathname === subItem.url ||
                        pathname.startsWith(`${subItem.url}/`)

                      return (
                        <DropdownMenuItem key={subItem.title} asChild>
                          <Link
                            href={subItem.url}
                            target={subItem.target}
                            rel={subItem.rel}
                            className={isSubItemActive ? 'bg-primary/10' : ''}
                          >
                            {subItem.title}
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }

            const isOpen =
              openItems[item.title] !== undefined
                ? openItems[item.title]
                : shouldBeOpen

            return (
              <Collapsible
                key={item.title}
                open={isOpen}
                onOpenChange={(open) =>
                  setOpenItems({ ...openItems, [item.title]: open })
                }
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      className="data-[active=true]:bg-primary/10"
                    >
                      {ItemIcon && <ItemIcon />}
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                      <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => {
                        const isSubItemActive =
                          pathname === subItem.url ||
                          pathname.startsWith(`${subItem.url}/`)

                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isSubItemActive}
                              className="data-[active=true]:bg-primary/10"
                            >
                              <Link
                                href={subItem.url}
                                target={subItem.target}
                                rel={subItem.rel}
                              >
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
