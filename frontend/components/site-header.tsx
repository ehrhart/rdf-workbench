import { SidebarTrigger } from '@/components/ui/sidebar'
import { QueryActivity } from './dashboard/query-activity'
import { UserAccountNav } from './dashboard/user-account-nav'

export function SiteHeader({
  user
}: {
  user: { id: string; username: string } | null
}) {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) bg-background/85 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex w-full items-center gap-1 lg:gap-2">
        <SidebarTrigger className="-ml-1" />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-3">
            <QueryActivity />
            <UserAccountNav user={user} />
          </div>
        </div>
      </div>
    </header>
  )
}
