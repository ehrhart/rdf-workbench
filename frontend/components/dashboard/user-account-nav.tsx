'use client'

import { KeyRoundIcon, LogOutIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { PASSWORD_CHANGE_PATH } from '@/config/access'
import { getUserInitials } from '@/lib/utils'
import type { User } from '@/types'

interface UserAccountNavProps {
  user: User | null
}

export function UserAccountNav({ user }: UserAccountNavProps) {
  const pathname = usePathname()
  if (!user) {
    return (
      <Button asChild variant="default" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-8 rounded-full">
          <Avatar>
            <AvatarFallback>{getUserInitials(user.username)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{user.username}</p>
          </div>
        </div>
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link
            href={`${PASSWORD_CHANGE_PATH}?redirect=${encodeURIComponent(pathname)}`}
            className="flex items-center w-full"
          >
            <KeyRoundIcon />
            <span>Change password</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" asChild>
          <a href="/logout" className="flex items-center w-full">
            <LogOutIcon />
            <span>Sign out</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
